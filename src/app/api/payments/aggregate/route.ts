import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerifiedPermission, orgFilter } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(rlResult);
    if (blocked) return blocked;

    const rbac = await requireVerifiedPermission(request, Permission.INVOICE_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'expense' or 'invoice'
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = { ...orgFilter(ctx) };
    if (projectId) where.projectId = projectId;
    if (type === "expense") {
      where.invoiceId = null;
    } else if (type === "invoice") {
      where.invoiceId = { not: null };
    }

    const [totalAgg, completedAgg, pendingAgg] = await Promise.all([
      db.payment.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { ...where, status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),
      db.payment.aggregate({
        where: { ...where, status: { in: ["PENDING", "APPROVED"] } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      totalAmount: Number(totalAgg._sum.amount || 0),
      totalCount: totalAgg._count || 0,
      completedAmount: Number(completedAgg._sum.amount || 0),
      completedCount: completedAgg._count || 0,
      pendingAmount: Number(pendingAgg._sum.amount || 0),
      pendingCount: pendingAgg._count || 0,
    });
  } catch (error) {
    log.error("Error aggregating payments:", error);
    return NextResponse.json({ error: "Failed to aggregate payments" }, { status: 500 });
  }
}
