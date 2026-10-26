import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

// ============================================
// Single Fee Collection — edit / release retention / soft delete
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

/**
 * PATCH /api/projects/[id]/collections/[collectionId]
 * Edit amounts/rates (recomputed server-side), metadata, status —
 * or action: "releaseRetention" to mark the bank-held 10% as released.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId, collectionId: rawCollectionId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;
    const colIdResult = validateIdParam(rawCollectionId);
    if (!colIdResult.success) return colIdResult.response;
    const collectionId = colIdResult.id;

    const collection = await db.feeCollection.findFirst({
      where: { id: collectionId, projectId, deletedAt: null, ...orgFilter(ctx) },
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // One-click release of the bank-held retention
    if (body.action === "releaseRetention") {
      if (collection.retentionReleasedAt) {
        return NextResponse.json({ error: "Retention already released" }, { status: 400 });
      }
      const updated = await db.feeCollection.update({
        where: { id: collectionId },
        data: { retentionReleasedAt: new Date() },
      });
      return NextResponse.json({ collection: updated });
    }

    const data: Record<string, unknown> = {};

    // Re-editable financials — always recomputed as a whole to stay consistent
    const grossAmount =
      body.grossAmount !== undefined ? num(body.grossAmount) : num(collection.grossAmount);
    if (grossAmount <= 0) {
      return NextResponse.json({ error: "Collection amount must be greater than zero" }, { status: 400 });
    }
    const retentionRate =
      body.retentionRate !== undefined ? clampRate(body.retentionRate, 10) : num(collection.retentionRate, 10);
    const taxRate =
      body.taxRate !== undefined ? clampRate(body.taxRate, 5) : num(collection.taxRate, 5);

    data.grossAmount = round2(grossAmount);
    data.retentionRate = retentionRate;
    data.retentionAmount = round2((grossAmount * retentionRate) / 100);
    data.taxRate = taxRate;
    data.taxAmount = round2((grossAmount * taxRate) / 100);
    data.netAmount = round2(grossAmount - (data.retentionAmount as number) - (data.taxAmount as number));

    if (body.method !== undefined) {
      data.method = PAYMENT_METHODS.includes(body.method) ? body.method : "transfer";
    }
    if (body.referenceNumber !== undefined) {
      data.referenceNumber = String(body.referenceNumber || "").trim();
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes || "").trim();
    }
    if (body.status !== undefined) {
      data.status = body.status === "PENDING" ? "PENDING" : "RECEIVED";
    }
    if (body.feeId !== undefined) {
      if (body.feeId) {
        const fee = await db.projectFee.findFirst({
          where: { id: String(body.feeId), projectId, deletedAt: null, ...orgFilter(ctx) },
          select: { id: true },
        });
        if (!fee) {
          return NextResponse.json({ error: "Linked fee not found for this project" }, { status: 400 });
        }
        data.feeId = fee.id;
      } else {
        data.feeId = null;
      }
    }

    const updated = await db.feeCollection.update({ where: { id: collectionId }, data });
    return NextResponse.json({ collection: updated });
  } catch (error) {
    log.error("Error updating fee collection:", error);
    return NextResponse.json({ error: "Failed to update fee collection" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/collections/[collectionId]
 * Soft delete — voucher stays in DB for audit.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId, collectionId: rawCollectionId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;
    const colIdResult = validateIdParam(rawCollectionId);
    if (!colIdResult.success) return colIdResult.response;
    const collectionId = colIdResult.id;

    const collection = await db.feeCollection.findFirst({
      where: { id: collectionId, projectId, deletedAt: null, ...orgFilter(ctx) },
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    await db.feeCollection.update({ where: { id: collectionId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting fee collection:", error);
    return NextResponse.json({ error: "Failed to delete fee collection" }, { status: 500 });
  }
}
