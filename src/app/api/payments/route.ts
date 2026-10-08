import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter, orgCreate } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { validateRequest, paymentCreateSchema } from '@/lib/api-validation';
import { requireStepUp2FA } from '@/lib/auth/step-up-2fa';
import { log } from '@/lib/logger';
import { parsePaginationParams, buildPaginationMeta, calculateSkip } from '../utils/pagination';
import { insensitiveContains } from '../utils/db';
import { sanitizeObject } from '@/lib/security/sanitize';
import { cachedQuery, invalidateCache, CACHE_TTL, buildCacheKey } from '@/lib/cache/query-cache';
import { cacheGet, cacheSet, cacheDeletePattern } from '@/lib/cache/redis';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { invoiceService } from '@/lib/services/invoice.service';
import { createExpenseJournalEntry } from '@/lib/services/accounting.service';

/**
 * @openapi
 * /api/payments:
 *   get:
 *     tags: [Payments]
 *     summary: List payments
 *     description: Retrieve a paginated list of payments scoped to the user's organization. Requires PAYMENT_READ permission.
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: status
 *         in: query
 *         schema: { type: string, enum: [PENDING, APPROVED, COMPLETED, CANCELLED] }
 *       - name: invoiceId
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated list of payments }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — PAYMENT_READ required }
 */
export async function GET(request: NextRequest) {
  try {
    const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(rlResult);
    if (blocked) return blocked;

    // RBAC CHECK (JWT-verified for payments)
    const rbac = await requireVerifiedPermission(request, Permission.INVOICE_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const { page, limit, search } = parsePaginationParams(searchParams);

    const where: Record<string, unknown> = { ...orgFilter(ctx) };
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;
    if (search) {
      where.OR = [
        { beneficiary: insensitiveContains(search) },
        { referenceNumber: insensitiveContains(search) },
        { voucherNumber: insensitiveContains(search) },
        { project: { name: insensitiveContains(search) } },
      ];
    }

    const cacheKey = buildCacheKey('payments', 'list', ctx.organizationId || 'global', `p${page}`, `l${limit}`, status || '', projectId || '', search || '');

    const { payments, total } = await cachedQuery(cacheKey, async () => {
      const [payments, total] = await Promise.all([
        db.payment.findMany({
          where: Object.keys(where).length > 0 ? where : undefined,
          include: {
            approver: { select: { id: true, name: true } },
            project: { select: { id: true, name: true, nameEn: true, number: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: calculateSkip(page, limit),
          take: limit,
        }),
        db.payment.count({ where }),
      ]);
      return { payments, total };
    }, CACHE_TTL.PAYMENTS);

    return NextResponse.json({ data: payments, pagination: buildPaginationMeta(page, limit, total) });
  } catch (error) {
    log.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'strict');
    const blocked = rateLimitResponse(rlResult);
    if (blocked) return blocked;

    // RBAC CHECK (JWT-verified for payments)
    const rbac = await requireVerifiedPermission(request, Permission.PAYMENT_CREATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    // ── Step-up 2FA: required for payment creation (sensitive financial operation) ──
    const stepUpResult = await requireStepUp2FA(request, ctx);
    if ('error' in stepUpResult) return stepUpResult.error;

    const body = await request.json();
    const validation = validateRequest(paymentCreateSchema, body);

    // Zod validation for payment fields
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }
    const _sanitizedBody = sanitizeObject(validation.data);

    const { voucherNumber, projectId, amount, payMethod, beneficiary, referenceNumber, description, invoiceId } = validation.data;

    // Verify project belongs to organization (if provided)
    if (projectId) {
      const project = await db.project.findFirst({
        where: { id: projectId, organizationId: ctx.organizationId || '__DENIED__' },
      });
      if (!project) {
        return NextResponse.json({ error: "المشروع المحدد غير موجود أو لا ينتمي لمؤسستك" }, { status: 400 });
      }
    }

    // Idempotency / Double-charge prevention
    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey) {
      const redisKey = `idempotency:payment:${ctx.userId}:${idempotencyKey}`;
      const cachedResult = await cacheGet(redisKey);
      if (cachedResult) {
        log.info("Idempotency key hit. Returning cached payment response.", { userId: ctx.userId, idempotencyKey });
        return NextResponse.json(cachedResult, { status: 200 });
      }
    }
    
    // Check for exact duplicate payment within the last 2 minutes (prevents double-clicks)
    const recentDuplicate = await db.payment.findFirst({
      where: {
        organizationId: ctx.organizationId || undefined,
        createdById: ctx.userId,
        amount,
        projectId: projectId || null,
        beneficiary: beneficiary || "",
        createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
      }
    });

    if (recentDuplicate) {
      log.warn("Prevented double-charge (time-based)", { userId: ctx.userId, amount, projectId });
      return NextResponse.json(recentDuplicate, { status: 200 });
    }

    // ── Customer payment applied to an invoice ──
    // Routes through invoiceService.recordPayment: atomically updates paidAmount/status,
    // applies overpayment protection, and posts the AR journal entry (Debit Cash/Bank,
    // Credit Accounts Receivable). The voucher row below links the payment to the
    // invoice so statements and the payments list stay consistent.
    if (invoiceId) {
      if (!ctx.organizationId) {
        return NextResponse.json({ error: "Organization context is required" }, { status: 400 });
      }
      const invoice = await db.invoice.findFirst({
        where: { id: invoiceId, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true, number: true },
      });
      if (!invoice) {
        return NextResponse.json({ error: "الفاتورة المحددة غير موجودة أو لا تنتمي لمؤسستك" }, { status: 400 });
      }

      try {
        // Money state first (atomic: paidAmount + status + journal entry + audit log)
        const updatedInvoice = await invoiceService.recordPayment(
          invoiceId,
          amount,
          ctx.organizationId,
          ctx.userId,
          payMethod === 'cash' ? 'cash' : 'bank'
        );

        // Voucher row linked to the invoice for lists/statements
        const payment = await db.payment.create({
          data: {
            voucherNumber: voucherNumber || "",
            projectId: projectId || null,
            invoiceId,
            amount,
            payMethod: payMethod,
            beneficiary: beneficiary || "",
            referenceNumber: referenceNumber || "",
            description: description || `دفعة على الفاتورة ${updatedInvoice.number}`,
            status: "APPROVED",
            ...orgCreate(ctx),
            createdById: ctx.userId,
          },
          include: {
            approver: { select: { id: true, name: true } },
            project: { select: { id: true, name: true, nameEn: true, number: true } },
            invoice: { select: { id: true, number: true, status: true, paidAmount: true, remaining: true } },
          },
        });

        // Invalidate payment + invoice + dashboard caches after creation
        await invalidateCache('payments');
        await invalidateCache('invoices');
        await cacheDeletePattern(`dashboard:${ctx.organizationId || 'global'}:*`);

        if (idempotencyKey) {
          const redisKey = `idempotency:payment:${ctx.userId}:${idempotencyKey}`;
          await cacheSet(redisKey, payment, 86400);
        }

        log.info("Invoice payment recorded", {
          userId: ctx.userId,
          invoiceId,
          invoiceNumber: updatedInvoice.number,
          amount,
          newStatus: updatedInvoice.status,
        });
        return NextResponse.json(payment, { status: 201 });
      } catch (paymentError) {
        // recordPayment throws clear business errors (overpayment, concurrent update)
        const message = paymentError instanceof Error ? paymentError.message : "Failed to record payment";
        log.error("Error recording invoice payment:", paymentError);
        return NextResponse.json(
          { error: message.includes('exceeds remaining balance') || message.includes('positive') || message.includes('CONCURRENT') ? message : "Failed to record payment" },
          { status: message.includes('CONCURRENT') ? 409 : 400 }
        );
      }
    }

    const payment = await db.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          voucherNumber: voucherNumber || "",
          projectId: projectId || null,
          amount,
          payMethod: payMethod,
          beneficiary: beneficiary || "",
          referenceNumber: referenceNumber || "",
          description: description || "",
          status: "APPROVED",
          ...orgCreate(ctx),
          createdById: ctx.userId,
        },
        include: {
          approver: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, nameEn: true, number: true } },
        },
      });

      // GL Auto-Posting: post general payment as operating expense to ledger atomically
      if (ctx.organizationId) {
        try {
          await createExpenseJournalEntry(
            tx,
            ctx.organizationId,
            createdPayment.voucherNumber || `PAY-${createdPayment.id.slice(-6)}`,
            createdPayment.description || `Payment to ${beneficiary || 'supplier'}`,
            amount,
            'general',
            payMethod === 'cash' ? 'cash' : 'bank',
            ctx.userId
          );
        } catch (glErr) {
          log.error('GL: Failed to create journal entry for direct payment', {
            paymentId: createdPayment.id,
            error: glErr instanceof Error ? glErr.message : String(glErr),
          });
          throw glErr;
        }
      }

      return createdPayment;
    });

    // Invalidate payment and dashboard caches after creation
    await invalidateCache('payments');
    await cacheDeletePattern(`dashboard:${ctx.organizationId || 'global'}:*`);

    if (idempotencyKey) {
      const redisKey = `idempotency:payment:${ctx.userId}:${idempotencyKey}`;
      // Cache the result for 24 hours (86400 seconds)
      await cacheSet(redisKey, payment, 86400);
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    log.error("Error creating payment:", error);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
