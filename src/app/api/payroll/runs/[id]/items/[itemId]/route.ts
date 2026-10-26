import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

// ============================================
// Payroll Item (بند راتب موظف)
// - edit:       مسموح في المسودات فقط (بدلات/استقطاعات) والصافي يحسب سيرفر سايد
// - toggle-paid: بعد الاعتماد، وآخر بند يتصرف يقفل المسير تلقائياً PAID
// ============================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function recalcRunTotals(runId: string): Promise<void> {
  const items = await db.payrollItem.findMany({
    where: { runId, deletedAt: null },
    select: { baseSalary: true, allowances: true, deductions: true, netAmount: true },
  });
  const totalGross = round2(items.reduce((s, i) => s + num(i.baseSalary) + num(i.allowances), 0));
  const totalDeductions = round2(items.reduce((s, i) => s + num(i.deductions), 0));
  const totalNet = round2(items.reduce((s, i) => s + num(i.netAmount), 0));
  await db.payrollRun.update({
    where: { id: runId },
    data: { totalGross, totalDeductions, totalNet, employeeCount: items.length },
  });
}

/**
 * PATCH /api/payroll/runs/[id]/items/[itemId]
 * Body: { action: "edit", allowances?, deductions?, notes? }
 *     | { action: "toggle-paid" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.BUDGET_MANAGE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId, itemId: rawItemId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const itemResult = validateIdParam(rawItemId);
    if (!itemResult.success) return itemResult.response;

    const run = await db.payrollRun.findFirst({
      where: { id: idResult.id, deletedAt: null, ...orgFilter(ctx) },
      select: { id: true, status: true, paidAt: true },
    });
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const item = await db.payrollItem.findFirst({
      where: { id: itemResult.id, runId: run.id, deletedAt: null },
      select: { id: true, baseSalary: true, allowances: true, deductions: true, notes: true, paid: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Payroll item not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const action = body?.action;

    // ── تعديل البدلات والاستقطاعات (مسودة فقط) ──
    if (action === "edit") {
      if (run.status !== "DRAFT") {
        return NextResponse.json({ error: "التعديل مسموح قبل الاعتماد فقط" }, { status: 400 });
      }
      const baseSalary = num(item.baseSalary);
      const allowances = body.allowances === undefined ? num(item.allowances) : round2(num(body.allowances));
      const deductions = body.deductions === undefined ? num(item.deductions) : round2(num(body.deductions));
      if (allowances < 0 || deductions < 0) {
        return NextResponse.json({ error: "البدلات والاستقطاعات لازم تكون أرقام موجبة" }, { status: 400 });
      }
      if (deductions > baseSalary + allowances) {
        return NextResponse.json(
          { error: "الاستقطاعات أكبر من الراتب والبدلات — الصافي هيبقى بالسالب" },
          { status: 400 }
        );
      }
      const netAmount = round2(baseSalary + allowances - deductions);
      const updated = await db.payrollItem.update({
        where: { id: item.id },
        data: {
          allowances,
          deductions,
          netAmount,
          notes: typeof body.notes === "string" ? body.notes.trim() : item.notes,
        },
      });
      await recalcRunTotals(run.id);
      return NextResponse.json({
        item: {
          id: updated.id,
          allowances: num(updated.allowances),
          deductions: num(updated.deductions),
          netAmount: num(updated.netAmount),
          notes: updated.notes,
        },
      });
    }

    // ── تسجيل صرف بند واحد (بعد الاعتماد) ──
    if (action === "toggle-paid") {
      if (run.status === "DRAFT") {
        return NextResponse.json({ error: "اعتمد المسير الأول قبل تسجيل الصرف" }, { status: 400 });
      }
      if (run.status === "PAID") {
        return NextResponse.json({ error: "المسير مقفول — كل الرواتب اتصرفت" }, { status: 400 });
      }
      const newPaid = !item.paid;
      const updated = await db.payrollItem.update({
        where: { id: item.id },
        data: { paid: newPaid, paidAt: newPaid ? new Date() : null },
      });

      // لو كل البنود اتصرفت → اقفل المسير تلقائياً
      const remaining = await db.payrollItem.count({
        where: { runId: run.id, deletedAt: null, paid: false },
      });
      let runStatus = run.status;
      if (remaining === 0) {
        await db.payrollRun.update({ where: { id: run.id }, data: { status: "PAID", paidAt: new Date() } });
        runStatus = "PAID";
      }
      return NextResponse.json({
        item: { id: updated.id, paid: updated.paid, paidAt: updated.paidAt },
        runStatus,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    log.error("PATCH /api/payroll/runs/[id]/items/[itemId] error:", error);
    return NextResponse.json({ error: "Failed to update payroll item" }, { status: 500 });
  }
}
