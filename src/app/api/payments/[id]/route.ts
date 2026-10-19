import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { validateRequest, paymentUpdateSchema, validateIdParam } from '@/lib/api-validation';
import { log } from '@/lib/logger';
import { sanitizeObject } from '@/lib/security/sanitize';
import { requireStepUp2FA } from '@/lib/auth/step-up-2fa';

import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { reverseJournalEntriesForReference } from '@/lib/services/accounting.service';
import { invalidateCache } from '@/lib/cache/query-cache';
import { cacheDeletePattern } from '@/lib/cache/redis';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(rlResult);
    if (blocked) return blocked;

    const result = await requireVerifiedPermission(request, Permission.PAYMENT_READ);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;
    const orgWhere = orgFilter(ctx);
    const payment = await db.payment.findFirst({
      where: { id, ...orgWhere },
      include: {
        approver: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, nameEn: true, number: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    log.error("Error fetching payment:", error);
    return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'strict');
    const blocked = rateLimitResponse(rlResult);
    if (blocked) return blocked;

    const result = await requireVerifiedPermission(request, Permission.PAYMENT_UPDATE);
    if ('error' in result) return result.error;
    const ctx = result.user;

    // ── Step-up 2FA: required for payment updates (sensitive financial operation) ──
    const stepUpResult = await requireStepUp2FA(request, ctx);
    if ('error' in stepUpResult) return stepUpResult.error;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;
    const body = await request.json();
    const validation = validateRequest(paymentUpdateSchema, body);

    // Zod validation for payment update fields
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }
    const _sanitizedBody = sanitizeObject(validation.data);

    const { status, amount, payMethod, beneficiary, referenceNumber, description } = validation.data;

    const orgWhere = orgFilter(ctx);
    const existing = await db.payment.findFirst({ where: { id, ...orgWhere } });
    if (!existing) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // ── FINANCIAL INTEGRITY GUARD: Prevent mutating amounts on posted/approved payments ──
    const isPosted = existing.status === 'APPROVED' || existing.status === 'COMPLETED';
    if (isPosted && amount !== undefined && Number(amount) !== Number(existing.amount)) {
      return NextResponse.json(
        { error: "لا يمكن تعديل مبلغ دفعة معتمدة ومرحّلة محاسبياً. يرجى إلغاء الدفعة وإنشاء دفعة جديدة." },
        { status: 400 }
      );
    }

    // Auto-set approvedById when status transitions to APPROVED
    const isApproving = status === 'APPROVED' && existing.status !== 'APPROVED';
    const isCancelling = status === 'CANCELLED' && existing.status !== 'CANCELLED';

    // Execute update and optional GL reversal atomically in transaction
    const updatedPayment = await db.$transaction(async (tx) => {
      // Optimistic Concurrency Control (OCC): match on existing updatedAt to prevent race conditions
      const updateResult = await tx.payment.updateMany({
        where: { id, ...orgWhere, updatedAt: existing.updatedAt },
        data: {
          ...(status !== undefined && { status: status }),
          ...(isApproving && { approvedById: ctx.userId }),
          ...(amount !== undefined && { amount }),
          ...(payMethod !== undefined && { payMethod: payMethod }),
          ...(beneficiary !== undefined && { beneficiary }),
          ...(referenceNumber !== undefined && { referenceNumber }),
          ...(description !== undefined && { description }),
          updatedById: ctx.userId,
        },
      });

      if (updateResult.count === 0) {
        throw new Error("CONCURRENT_UPDATE_ERROR");
      }

      // If cancelling an already approved/posted payment, reverse its GL entry atomically!
      if (isCancelling && ctx.organizationId) {
        const paymentRef = existing.voucherNumber || `PAY-${existing.id.slice(-6)}`;
        // Try reversing both direct payment ref and invoice payment ref
        await reverseJournalEntriesForReference(
          tx,
          ctx.organizationId,
          paymentRef,
          `Cancelled payment ${paymentRef}`,
          ctx.userId
        );

        if (existing.invoiceId) {
          const invoice = await tx.invoice.findUnique({
            where: { id: existing.invoiceId },
            select: { id: true, number: true, total: true, paidAmount: true },
          });
          if (invoice) {
            await reverseJournalEntriesForReference(
              tx,
              ctx.organizationId,
              `PAYMENT-${invoice.number}`,
              `Cancelled payment for invoice ${invoice.number}`,
              ctx.userId
            );

            // Recredit invoice remaining balance accurately
            const paidReduction = Number(existing.amount);
            const currentPaid = Number(invoice.paidAmount);
            const total = Number(invoice.total);
            const newPaid = Math.max(0, currentPaid - paidReduction);
            const newRemaining = Math.max(0, total - newPaid);
            const newStatus = newPaid <= 0 ? 'SENT' : (newPaid >= total ? 'PAID' : 'PARTIALLY_PAID');

            await tx.invoice.update({
              where: { id: existing.invoiceId },
              data: {
                paidAmount: newPaid,
                remaining: newRemaining,
                status: newStatus,
              },
            });
          }
        }
      }

      return await tx.payment.findFirst({
        where: { id, ...orgWhere },
        include: {
          approver: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, nameEn: true, number: true } },
        },
      });
    });

    if (!updatedPayment) {
      return NextResponse.json({ error: "Failed to retrieve updated payment" }, { status: 500 });
    }

    // Invalidate caches
    await invalidateCache('payments');
    if (existing.invoiceId) await invalidateCache('invoices');
    await cacheDeletePattern(`dashboard:${ctx.organizationId || 'global'}:*`);
    await cacheDeletePattern(`finance:summary:*`);

    // Create audit log entry in ActivityLog
    // SECURITY: Use structured JSON instead of string concatenation to prevent
    // log injection (if status/amount ever contain attacker-controlled chars)
    // and to make the audit trail machine-queryable.
    await db.activityLog.create({
      data: {
        userId: ctx.userId,
        organizationId: ctx.organizationId || '',
        action: "UPDATE",
        entityType: "payment",
        entityId: id,
        details: JSON.stringify({
          action: 'update',
          previousStatus: existing.status,
          newStatus: status ?? existing.status,
          amountChanged: amount !== undefined,
          previousAmount: existing.amount,
          newAmount: amount ?? existing.amount,
          fieldsUpdated: Object.keys(validation.data),
          approverChanged: isApproving,
          approverId: isApproving ? ctx.userId : undefined,
        }),
        projectId: existing.projectId,
      }
    });

    return NextResponse.json(updatedPayment);
  } catch (error) {
    if (error instanceof Error && error.message === "CONCURRENT_UPDATE_ERROR") {
      return NextResponse.json(
        { error: "تم تحديث الدفعة بواسطة مستخدم آخر، يرجى إعادة المحاولة" },
        { status: 409 }
      );
    }
    log.error("Error updating payment:", error);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}
