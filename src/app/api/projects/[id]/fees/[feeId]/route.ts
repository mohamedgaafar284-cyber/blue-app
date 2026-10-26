import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

// ============================================
// Single Project Fee — update / soft delete
// ============================================

const FEE_CATEGORIES = ["DESIGN", "SUPERVISION", "EXPENSES", "CONTRACTOR_SHARE", "OTHER"];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * PATCH /api/projects/[id]/fees/[feeId]
 * Edit fee title / category / amount / notes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId, feeId: rawFeeId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;
    const feeIdResult = validateIdParam(rawFeeId);
    if (!feeIdResult.success) return feeIdResult.response;
    const feeId = feeIdResult.id;

    // Fee must exist, belong to this project AND to the caller's org
    const fee = await db.projectFee.findFirst({
      where: { id: feeId, projectId, deletedAt: null, ...orgFilter(ctx) },
    });
    if (!fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const title = String(body.title || "").trim();
      if (!title) {
        return NextResponse.json({ error: "Fee title is required" }, { status: 400 });
      }
      data.title = title;
    }
    if (body.category !== undefined) {
      data.category = FEE_CATEGORIES.includes(body.category) ? body.category : "DESIGN";
    }
    if (body.amount !== undefined) {
      const amount = num(body.amount);
      if (amount <= 0) {
        return NextResponse.json({ error: "Fee amount must be greater than zero" }, { status: 400 });
      }
      data.amount = round2(amount);
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes || "").trim();
    }

    const updated = await db.projectFee.update({ where: { id: feeId }, data });
    return NextResponse.json({ fee: updated });
  } catch (error) {
    log.error("Error updating project fee:", error);
    return NextResponse.json({ error: "Failed to update project fee" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/fees/[feeId]
 * Soft delete — historical collections stay intact (feeId kept for reporting).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId, feeId: rawFeeId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;
    const feeIdResult = validateIdParam(rawFeeId);
    if (!feeIdResult.success) return feeIdResult.response;
    const feeId = feeIdResult.id;

    const fee = await db.projectFee.findFirst({
      where: { id: feeId, projectId, deletedAt: null, ...orgFilter(ctx) },
    });
    if (!fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 });
    }

    await db.projectFee.update({ where: { id: feeId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting project fee:", error);
    return NextResponse.json({ error: "Failed to delete project fee" }, { status: 500 });
  }
}
