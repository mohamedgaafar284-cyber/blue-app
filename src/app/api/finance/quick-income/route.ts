import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

// ============================================
// Quick Income (سجل عملية — قبض سريع)
// The novice-accountant "money in" path. Resolves the Chart of
// Accounts codes SERVER-SIDE (the old client used literal ids like
// "1010" which violated the JournalLine→Account FK and always 500'd):
//   Debit  1010 (Cash on Hand) / 1020 (Bank Account)
//   Credit 4010 (Consulting Revenue) | 4020 (Supervision Revenue)
//        | 4100 (Other Income)
// ============================================

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const REVENUE_CODES: Record<string, string> = {
  service: "4010", // إيرادات الخدمات الاستشارية
  supervision: "4020", // إيرادات الإشراف
  other: "4100", // إيرادات أخرى
};

/**
 * POST /api/finance/quick-income
 * Body: { amount, method? ("cash"|"bank"), category? ("service"|"supervision"|"other"), description? }
 */
export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    // RBAC CHECK — money management (ADMIN/MANAGER/ACCOUNTANT via budget:manage)
    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const organizationId = ctx.organizationId || "";
    if (!organizationId) {
      return NextResponse.json({ error: "لا توجد مؤسسة مرتبطة بالحساب" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const amount = round2(num(body.amount));
    if (amount <= 0) {
      return NextResponse.json({ error: "المبلغ لازم يكون أكبر من الصفر" }, { status: 400 });
    }

    const method = body.method === "cash" ? "cash" : "bank";
    const category = REVENUE_CODES[body.category] ? body.category : "other";
    const description = String(body.description || "").trim() || "إيراد مباشر";

    const [assetAcc, revenueAcc] = await Promise.all([
      db.account.findFirst({
        where: { organizationId, code: method === "cash" ? "1010" : "1020", isActive: true },
        select: { id: true, code: true },
      }),
      db.account.findFirst({
        where: { organizationId, code: REVENUE_CODES[category], isActive: true },
        select: { id: true, code: true },
      }),
    ]);

    if (!assetAcc || !revenueAcc) {
      return NextResponse.json(
        { error: "شجرة الحسابات غير مهيأة — شغّل الـ setup أو أضف الحسابات الافتراضية أولاً" },
        { status: 400 }
      );
    }

    const header = await db.journalEntry.create({
      data: {
        date: new Date(),
        reference: `INC-${Date.now().toString().slice(-6)}`,
        description,
        organizationId,
      },
    });
    await db.journalLine.createMany({
      data: [
        { journalEntryId: header.id, accountId: assetAcc.id, debit: amount, credit: 0 },
        { journalEntryId: header.id, accountId: revenueAcc.id, debit: 0, credit: amount },
      ],
    });

    return NextResponse.json(
      { entry: { id: header.id, reference: header.reference, description: header.description, amount } },
      { status: 201 }
    );
  } catch (error) {
    log.error("POST /api/finance/quick-income error:", error);
    return NextResponse.json({ error: "Failed to record income" }, { status: 500 });
  }
}
