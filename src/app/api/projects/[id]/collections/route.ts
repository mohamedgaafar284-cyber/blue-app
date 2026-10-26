import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter, orgCreate } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

// ============================================
// Fee Collections (تحصيلات الأتعاب)
// Money actually received. The financing bank deducts a
// retention % (owner guarantee / maintenance) and a tax %
// from every payment — computed server-side and stored per
// record so historical vouchers never change.
// ============================================

const PAYMENT_METHODS = ["cash", "cheque", "transfer", "online"];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampRate(value: unknown, fallback: number): number {
  const n = num(value, fallback);
  return Math.min(100, Math.max(0, n));
}

async function nextVoucherNumber(organizationId: string): Promise<string> {
  const latest = await db.feeCollection.findFirst({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { voucherNumber: true },
  });
  const lastSeq = Number(latest?.voucherNumber?.replace(/[^0-9]/g, "") || 0) || 0;
  return `REC-${String(lastSeq + 1).padStart(4, "0")}`;
}

/**
 * POST /api/projects/[id]/collections
 * Record a collection against project fees.
 * Body: { feeId?, grossAmount, retentionRate?, taxRate?, method?, referenceNumber?, status?, notes?, collectedAt? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    // RBAC CHECK — money management (ADMIN/MANAGER/ACCOUNTANT via budget:manage)
    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null, ...orgFilter(ctx) },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const grossAmount = num(body.grossAmount);
    if (grossAmount <= 0) {
      return NextResponse.json({ error: "Collection amount must be greater than zero" }, { status: 400 });
    }

    // Optional fee link must belong to the same project/org
    let feeId: string | null = null;
    if (body.feeId) {
      const fee = await db.projectFee.findFirst({
        where: { id: String(body.feeId), projectId, deletedAt: null, ...orgFilter(ctx) },
        select: { id: true },
      });
      if (!fee) {
        return NextResponse.json({ error: "Linked fee not found for this project" }, { status: 400 });
      }
      feeId = fee.id;
    }

    // Deduction rates (clamped 0..100) — defaults match the bank guarantee model
    const retentionRate = clampRate(body.retentionRate, 10);
    const taxRate = clampRate(body.taxRate, 5);
    const retentionAmount = round2((grossAmount * retentionRate) / 100);
    const taxAmount = round2((grossAmount * taxRate) / 100);
    const netAmount = round2(grossAmount - retentionAmount - taxAmount);

    const method = PAYMENT_METHODS.includes(body.method) ? body.method : "transfer";
    const status = body.status === "PENDING" ? "PENDING" : "RECEIVED";
    const collectedAt = body.collectedAt ? new Date(body.collectedAt) : new Date();
    if (Number.isNaN(collectedAt.getTime())) {
      return NextResponse.json({ error: "Invalid collection date" }, { status: 400 });
    }

    const collection = await db.feeCollection.create({
      data: {
        projectId,
        feeId,
        ...orgCreate(ctx),
        voucherNumber: await nextVoucherNumber(ctx.organizationId || ""),
        grossAmount: round2(grossAmount),
        retentionRate,
        retentionAmount,
        taxRate,
        taxAmount,
        netAmount,
        method,
        referenceNumber: String(body.referenceNumber || "").trim(),
        status,
        notes: String(body.notes || "").trim(),
        createdById: ctx.userId,
        createdAt: collectedAt,
      },
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (error) {
    log.error("Error creating fee collection:", error);
    return NextResponse.json({ error: "Failed to create fee collection" }, { status: 500 });
  }
}
