import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter, orgCreate } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

// ============================================
// Project Fees (الأتعاب حسب الاتفاق)
// Fee lines agreed with the client — amounts are
// entered manually per the signed agreement.
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
 * GET /api/projects/[id]/fees
 * Returns fees, collections and an aggregated summary + last-used default rates.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    // RBAC CHECK — fee data is financial but project-scoped
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;

    // Verify project exists and belongs to org
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null, ...orgFilter(ctx) },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [fees, collections] = await Promise.all([
      db.projectFee.findMany({
        where: { projectId, deletedAt: null, ...orgFilter(ctx) },
        orderBy: { createdAt: "asc" },
      }),
      db.feeCollection.findMany({
        where: { projectId, deletedAt: null, ...orgFilter(ctx) },
        orderBy: { createdAt: "desc" },
        include: { fee: { select: { title: true } } },
      }),
    ]);

    const feesData = fees.map((f) => ({
      id: f.id,
      title: f.title,
      category: f.category,
      amount: num(f.amount),
      notes: f.notes,
      createdAt: f.createdAt,
    }));

    const collectionsData = collections.map((c) => ({
      id: c.id,
      voucherNumber: c.voucherNumber,
      feeId: c.feeId,
      feeTitle: c.fee?.title || "",
      grossAmount: num(c.grossAmount),
      retentionRate: num(c.retentionRate),
      retentionAmount: num(c.retentionAmount),
      taxRate: num(c.taxRate),
      taxAmount: num(c.taxAmount),
      netAmount: num(c.netAmount),
      method: c.method,
      referenceNumber: c.referenceNumber,
      status: c.status,
      notes: c.notes,
      retentionReleasedAt: c.retentionReleasedAt,
      createdAt: c.createdAt,
    }));

    // Aggregated summary
    const totalFees = round2(feesData.reduce((s, f) => s + f.amount, 0));
    const received = collectionsData.filter((c) => c.status === "RECEIVED");
    const grossCollected = round2(received.reduce((s, c) => s + c.grossAmount, 0));
    const netCollected = round2(received.reduce((s, c) => s + c.netAmount, 0));
    const taxWithheld = round2(received.reduce((s, c) => s + c.taxAmount, 0));
    const retentionHeld = round2(
      received.filter((c) => !c.retentionReleasedAt).reduce((s, c) => s + c.retentionAmount, 0)
    );
    const retentionReleased = round2(
      received.filter((c) => c.retentionReleasedAt).reduce((s, c) => s + c.retentionAmount, 0)
    );

    // Last-used deduction rates as defaults for the next voucher
    const latest = collectionsData[0];
    const defaults = {
      retentionRate: latest ? latest.retentionRate : 10,
      taxRate: latest ? latest.taxRate : 5,
    };

    return NextResponse.json({
      fees: feesData,
      collections: collectionsData,
      summary: {
        totalFees,
        grossCollected,
        netCollected,
        taxWithheld,
        retentionHeld,
        retentionReleased,
        remaining: round2(totalFees - grossCollected),
      },
      defaults,
    });
  } catch (error) {
    log.error("Error fetching project fees:", error);
    return NextResponse.json({ error: "Failed to fetch project fees" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/fees
 * Add a fee line agreed with the client.
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

    const title = String(body.title || "").trim();
    const amount = num(body.amount);
    if (!title) {
      return NextResponse.json({ error: "Fee title is required" }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ error: "Fee amount must be greater than zero" }, { status: 400 });
    }

    const category = FEE_CATEGORIES.includes(body.category) ? body.category : "DESIGN";

    const fee = await db.projectFee.create({
      data: {
        projectId,
        ...orgCreate(ctx),
        title,
        category,
        amount: round2(amount),
        notes: String(body.notes || "").trim(),
        createdById: ctx.userId,
      },
    });

    return NextResponse.json({ fee }, { status: 201 });
  } catch (error) {
    log.error("Error creating project fee:", error);
    return NextResponse.json({ error: "Failed to create project fee" }, { status: 500 });
  }
}
