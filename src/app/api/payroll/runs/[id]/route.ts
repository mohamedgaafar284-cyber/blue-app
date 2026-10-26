import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

// ============================================
// Payroll Run detail (تفاصيل مسير الشهر)
// Lifecycle: DRAFT → APPROVED → PAID
//   - DRAFT:    items editable, run deletable
//   - APPROVED: per-employee "paid" toggles, reopen (before any payment)
//   - PAID:     frozen — auto-posted journal entry lives in the ledger
// ============================================

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const MONTHS_AR = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/**
 * Post the payroll journal entry: debit Salaries Expense (5010),
 * credit Cash (1010) or Bank (1020) with the net amount actually paid.
 * Non-blocking: if the Chart of Accounts is not seeded we log and skip,
 * so salary payment is never blocked by missing ledger accounts.
 */
async function postPayrollJournalEntry(
  organizationId: string,
  run: { runNumber: string; year: number; month: number; totalNet: number },
  paymentMethod: string
) {
  try {
    const [expenseAcc, cashAcc, bankAcc] = await Promise.all([
      db.account.findFirst({ where: { organizationId, code: "5010", isActive: true }, select: { id: true } }),
      db.account.findFirst({ where: { organizationId, code: "1010", isActive: true }, select: { id: true } }),
      db.account.findFirst({ where: { organizationId, code: "1020", isActive: true }, select: { id: true } }),
    ]);
    const creditAcc = paymentMethod === "cash" ? cashAcc : bankAcc;
    if (!expenseAcc || !creditAcc || run.totalNet <= 0) return null;

    const header = await db.journalEntry.create({
      data: {
        date: new Date(),
        reference: run.runNumber,
        description: `صرف مسير رواتب ${MONTHS_AR[run.month]} ${run.year}`,
        organizationId,
      },
    });
    await db.journalLine.createMany({
      data: [
        { journalEntryId: header.id, accountId: expenseAcc.id, debit: run.totalNet, credit: 0 },
        { journalEntryId: header.id, accountId: creditAcc.id, debit: 0, credit: run.totalNet },
      ],
    });
    return header.id;
  } catch (glError) {
    log.error("Payroll GL posting skipped:", glError);
    return null;
  }
}

/**
 * GET /api/payroll/runs/[id] — run + items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;

    const run = await db.payrollRun.findFirst({
      where: { id: idResult.id, deletedAt: null, ...orgFilter(ctx) },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    return NextResponse.json({
      run: {
        id: run.id,
        runNumber: run.runNumber,
        year: run.year,
        month: run.month,
        status: run.status,
        notes: run.notes,
        paymentMethod: run.paymentMethod,
        totalGross: num(run.totalGross),
        totalDeductions: num(run.totalDeductions),
        totalNet: num(run.totalNet),
        employeeCount: run.employeeCount,
        approvedAt: run.approvedAt,
        paidAt: run.paidAt,
        createdAt: run.createdAt,
      },
      items: run.items.map((i) => ({
        id: i.id,
        employeeId: i.employeeId,
        employeeName: i.employeeName,
        position: i.position,
        baseSalary: num(i.baseSalary),
        allowances: num(i.allowances),
        deductions: num(i.deductions),
        netAmount: num(i.netAmount),
        paid: i.paid,
        paidAt: i.paidAt,
        notes: i.notes,
      })),
    });
  } catch (error) {
    log.error("GET /api/payroll/runs/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch payroll run" }, { status: 500 });
  }
}

/**
 * PATCH /api/payroll/runs/[id]
 * Body: { action: "approve" | "mark-paid" | "reopen" | "update", notes?, paymentMethod? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;

    const run = await db.payrollRun.findFirst({
      where: { id: idResult.id, deletedAt: null, ...orgFilter(ctx) },
      include: { items: { where: { deletedAt: null }, select: { id: true, paid: true, netAmount: true } } },
    });
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const action = body?.action;

    // ── اعتماد المسير: DRAFT → APPROVED ──
    if (action === "approve") {
      if (run.status !== "DRAFT") {
        return NextResponse.json({ error: "المسير معتمد بالفعل" }, { status: 400 });
      }
      if (run.items.length === 0) {
        return NextResponse.json({ error: "المسير فاضي — مفيش بنود للاعتماد" }, { status: 400 });
      }
      const updated = await db.payrollRun.update({
        where: { id: run.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
      return NextResponse.json({ run: { id: updated.id, status: updated.status, approvedAt: updated.approvedAt } });
    }

    // ── تسجيل الصرف: APPROVED → PAID + قيد محاسبي ──
    if (action === "mark-paid") {
      if (run.status === "PAID") {
        return NextResponse.json({ error: "المسير مصروف بالفعل" }, { status: 400 });
      }
      if (run.status !== "APPROVED") {
        return NextResponse.json({ error: "اعتمد المسير الأول قبل تسجيل الصرف" }, { status: 400 });
      }
      const paidAt = new Date();
      const [, updated] = await db.$transaction([
        db.payrollItem.updateMany({
          where: { runId: run.id, deletedAt: null },
          data: { paid: true, paidAt },
        }),
        db.payrollRun.update({
          where: { id: run.id },
          data: { status: "PAID", paidAt },
        }),
      ]);
      await postPayrollJournalEntry(
        ctx.organizationId || "",
        { runNumber: run.runNumber, year: run.year, month: run.month, totalNet: num(run.totalNet) },
        run.paymentMethod
      );
      return NextResponse.json({ run: { id: updated.id, status: updated.status, paidAt: updated.paidAt } });
    }

    // ── إعادة فتح: APPROVED → DRAFT (قبل ما حد يستلم) ──
    if (action === "reopen") {
      if (run.status !== "APPROVED") {
        return NextResponse.json({ error: "يمكن إعادة الفتح فقط للمعتمد قبل الصرف" }, { status: 400 });
      }
      if (run.items.some((i) => i.paid)) {
        return NextResponse.json({ error: "مفيش إعادة فتح بعد ما اتصرفت رواتب — اعمل مسير جديد بالتعديلات" }, { status: 400 });
      }
      const updated = await db.payrollRun.update({
        where: { id: run.id },
        data: { status: "DRAFT", approvedAt: null },
      });
      return NextResponse.json({ run: { id: updated.id, status: updated.status } });
    }

    // ── تعديل بيانات المسير (مسودة فقط) ──
    if (action === "update") {
      if (run.status !== "DRAFT") {
        return NextResponse.json({ error: "التعديل مسموح في المسودات فقط" }, { status: 400 });
      }
      const data: Record<string, unknown> = {};
      if (typeof body.notes === "string") data.notes = body.notes.trim();
      if (body.paymentMethod === "bank" || body.paymentMethod === "cash") data.paymentMethod = body.paymentMethod;
      const updated = await db.payrollRun.update({ where: { id: run.id }, data });
      return NextResponse.json({ run: { id: updated.id, notes: updated.notes, paymentMethod: updated.paymentMethod } });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    log.error("PATCH /api/payroll/runs/[id] error:", error);
    return NextResponse.json({ error: "Failed to update payroll run" }, { status: 500 });
  }
}

/**
 * DELETE /api/payroll/runs/[id] — drafts only (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;

    const run = await db.payrollRun.findFirst({
      where: { id: idResult.id, deletedAt: null, ...orgFilter(ctx) },
      select: { id: true, status: true },
    });
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }
    if (run.status !== "DRAFT") {
      return NextResponse.json({ error: "لا يمكن حذف مسير معتمد أو مصروف" }, { status: 400 });
    }

    const now = new Date();
    await db.$transaction([
      db.payrollItem.updateMany({ where: { runId: run.id, deletedAt: null }, data: { deletedAt: now } }),
      db.payrollRun.update({ where: { id: run.id }, data: { deletedAt: now } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("DELETE /api/payroll/runs/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete payroll run" }, { status: 500 });
  }
}
