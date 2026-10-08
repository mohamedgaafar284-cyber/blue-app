import { NextRequest } from "next/server";
import { AccountingService } from "@/lib/services/accounting.service";
import { requireVerifiedPermission } from "../../utils/auth";
import { Permission } from "@/lib/auth/types";
import { errorResponse, successResponse } from "../../utils/response";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/finance/summary
 * QW4: Unified real-time financial health snapshot for dashboard.
 * Returns:
 * - totalRevenue: Total recognized revenue from journal entries
 * - totalExpenses: Total recognized operating expenses from journal entries
 * - netProfit: Net profit / margin (Revenue - Expenses)
 * - receivables: Total outstanding Accounts Receivable (Customer dues)
 * - payables: Total outstanding Accounts Payable (Supplier / Contractor dues)
 * - cashAndBankBalance: Total liquid assets on hand
 */
export async function GET(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.REPORTS_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    if (!user.organizationId) {
      return errorResponse("غير مصرح بالدخول - لم يتم تحديد المؤسسة", "FORBIDDEN", 403);
    }

    const orgId = user.organizationId;

    // 1. Fetch Income Statement aggregates from GL
    const incomeStatement = await AccountingService.getIncomeStatement(orgId);

    // 2. Fetch Accounts Receivable (Account 1100) balance directly from GL lines
    const arLines = await db.journalLine.findMany({
      where: {
        journalEntry: { organizationId: orgId },
        account: { code: "1100" },
      },
      select: { debit: true, credit: true },
    });
    const receivables = arLines.reduce(
      (sum, l) => sum.add(new Prisma.Decimal(l.debit)).sub(new Prisma.Decimal(l.credit)),
      new Prisma.Decimal(0)
    );

    // 3. Fetch Accounts Payable (Account 2100) balance directly from GL lines
    const apLines = await db.journalLine.findMany({
      where: {
        journalEntry: { organizationId: orgId },
        account: { code: "2100" },
      },
      select: { debit: true, credit: true },
    });
    const payables = apLines.reduce(
      (sum, l) => sum.add(new Prisma.Decimal(l.credit)).sub(new Prisma.Decimal(l.debit)),
      new Prisma.Decimal(0)
    );

    // 4. Liquid funds (Cash on hand 1010 + Bank Account 1020)
    const liquidLines = await db.journalLine.findMany({
      where: {
        journalEntry: { organizationId: orgId },
        account: { code: { in: ["1010", "1020"] } },
      },
      select: { debit: true, credit: true },
    });
    const liquidFunds = liquidLines.reduce(
      (sum, l) => sum.add(new Prisma.Decimal(l.debit)).sub(new Prisma.Decimal(l.credit)),
      new Prisma.Decimal(0)
    );

    return successResponse({
      totalRevenue: incomeStatement.totalRevenue,
      totalExpenses: incomeStatement.totalExpense,
      netProfit: incomeStatement.netProfit,
      receivables: Math.max(0, receivables.toNumber()),
      payables: Math.max(0, payables.toNumber()),
      liquidFunds: liquidFunds.toNumber(),
      hasData: (incomeStatement.totalRevenue > 0 || incomeStatement.totalExpense > 0 || receivables.gt(0)),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal Server Error";
    return errorResponse(msg, "INTERNAL_ERROR", 500);
  }
}
