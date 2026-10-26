"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  Coins,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import { useLang } from "@/hooks/use-lang";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { getMutationHeaders } from "@/lib/csrf-client";
import { extractErrorMessage } from "@/lib/api/fetch-client";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

// ===== Types =====
interface RunSummary {
  id: string;
  runNumber: string;
  year: number;
  month: number;
  status: string;
  notes: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  paymentMethod: string;
  approvedAt: string | null;
  paidAt: string | null;
}

interface PayrollItem {
  id: string;
  employeeId: string | null;
  employeeName: string;
  position: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netAmount: number;
  paid: boolean;
  paidAt: string | null;
  notes: string;
}

interface RunsData {
  data: RunSummary[];
  summary: { year: number; runsCount: number; totalNet: number; paidNet: number; pendingCount: number };
}

interface RunDetail {
  run: RunSummary;
  items: PayrollItem[];
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthName(month: number, isAr: boolean): string {
  return isAr ? MONTHS_AR[month - 1] : MONTHS_EN[month - 1];
}

function StatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: isAr ? "مسودة" : "Draft", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200" },
    APPROVED: { label: isAr ? "معتمد" : "Approved", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200" },
    PAID: { label: isAr ? "مصروف" : "Paid", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200" },
  };
  const s = map[status] || map.DRAFT;
  return <Badge variant="outline" className={cn("text-[11px] font-bold", s.cls)}>{s.label}</Badge>;
}

// ===== Page =====
export default function FinancePayrollPage() {
  const lang = useLang();
  const isAr = lang === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const toast = useToastFeedback({ ar: isAr });
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showCreate, setShowCreate] = useState(false);
  const [newMonth, setNewMonth] = useState(String(new Date().getMonth() + 1));
  const [newYear, setNewYear] = useState(String(currentYear));
  const [newMethod, setNewMethod] = useState("bank");
  const [newNotes, setNewNotes] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  // Edit item dialog state
  const [editingItem, setEditingItem] = useState<PayrollItem | null>(null);
  const [editAllow, setEditAllow] = useState("");
  const [editDeduct, setEditDeduct] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const years = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i);

  const runsQuery = useQuery<RunsData>({
    queryKey: ["payroll-runs", year],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/runs?year=${year}`);
      if (!res.ok) throw new Error("Failed to fetch payroll runs");
      return res.json();
    },
  });

  const detailQuery = useQuery<RunDetail>({
    queryKey: ["payroll-run", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await fetch(`/api/payroll/runs/${detailId}`);
      if (!res.ok) throw new Error("Failed to fetch payroll run");
      return res.json();
    },
  });

  const invalidateRuns = () => {
    queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
    queryClient.invalidateQueries({ queryKey: ["payroll-run", detailId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // ── إنشاء مسير شهر جديد ──
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({ year: Number(newYear), month: Number(newMonth), paymentMethod: newMethod, notes: newNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to create payroll run"));
      }
      return res.json();
    },
    onSuccess: (data: { run: RunSummary }) => {
      setYear(Number(newYear));
      invalidateRuns();
      setShowCreate(false);
      setNewNotes("");
      toast.created(t("مسير الرواتب", "Payroll run"));
      setDetailId(data.run.id);
    },
    onError: (e: Error) => toast.showError(t(`فشل إنشاء المسير: ${e.message}`, `Failed to create run: ${e.message}`)),
  });

  // ── أفعال المسير: اعتماد / صرف / إعادة فتح / حذف ──
  const runActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      if (action === "delete") {
        const res = await fetch(`/api/payroll/runs/${id}`, { method: "DELETE", headers: getMutationHeaders() });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(extractErrorMessage(err.error, "Failed to delete run"));
        }
        return res.json();
      }
      const res = await fetch(`/api/payroll/runs/${id}`, {
        method: "PATCH",
        headers: getMutationHeaders(),
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to update run"));
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      invalidateRuns();
      if (vars.action === "delete") {
        setDetailId(null);
        toast.deleted(t("المسير", "Run"));
      } else if (vars.action === "approve") {
        toast.showSuccess(t("تم اعتماد المسير — باقي تسجيل الصرف", "Run approved — mark it paid when salaries are out"));
      } else if (vars.action === "mark-paid") {
        toast.showSuccess(t("تم تسجيل صرف كل الرواتب وترحيل القيد", "All salaries marked paid and journal posted"));
      } else if (vars.action === "reopen") {
        toast.showSuccess(t("المسير رجع مسودة", "Run reopened as draft"));
      }
    },
    onError: (e: Error) => toast.showError(e.message),
  });

  // ── تعديل بند موظف (بدلات/استقطاعات) ──
  const editItemMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/payroll/runs/${detailId}/items/${editingItem?.id}`, {
        method: "PATCH",
        headers: getMutationHeaders(),
        body: JSON.stringify({ action: "edit", allowances: Number(editAllow || 0), deductions: Number(editDeduct || 0), notes: editNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to update item"));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateRuns();
      setEditingItem(null);
      toast.updated(t("بند الراتب", "Payroll item"));
    },
    onError: (e: Error) => toast.showError(t(`فشل تعديل البند: ${e.message}`, `Failed to update item: ${e.message}`)),
  });

  // ── تسجيل صرف بند واحد ──
  const toggleItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/payroll/runs/${detailId}/items/${itemId}`, {
        method: "PATCH",
        headers: getMutationHeaders(),
        body: JSON.stringify({ action: "toggle-paid" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to toggle payment"));
      }
      return res.json();
    },
    onSuccess: () => invalidateRuns(),
    onError: (e: Error) => toast.showError(e.message),
  });

  const openEditItem = (item: PayrollItem) => {
    setEditingItem(item);
    setEditAllow(String(item.allowances));
    setEditDeduct(String(item.deductions));
    setEditNotes(item.notes || "");
  };

  const runs = runsQuery.data?.data || [];
  const summary = runsQuery.data?.summary;
  const detail = detailQuery.data;
  const busy = createMutation.isPending || runActionMutation.isPending || editItemMutation.isPending || toggleItemMutation.isPending;

  return (
    <div className="space-y-5 p-4 md:p-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Banknote className="h-6 w-6 text-emerald-600" />
            {t("مسير الرواتب الشهري", "Monthly Payroll")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t(
              "ولّد مسير كل شهر من رواتب الموظفين، عدّل البدلات والاستقطاعات، اعتمد، وسجّل الصرف — والقيد المحاسبي بيتسجل أوتوماتيك.",
              "Generate each month's payroll from employee salaries, adjust allowances/deductions, approve, mark paid — the journal entry is posted automatically."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[110px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            <Plus className="h-4 w-4" />
            {t("مسير شهر جديد", "New Monthly Run")}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Wallet, label: t("صافي رواتب السنة", "Year net payroll"), value: summary ? formatCurrency(summary.totalNet, isAr) : "—", cls: "text-emerald-600" },
          { icon: CheckCircle2, label: t("تم صرفه فعلاً", "Actually paid"), value: summary ? formatCurrency(summary.paidNet, isAr) : "—", cls: "text-blue-600" },
          { icon: CalendarClock, label: t("مسيرات معلّقة", "Pending runs"), value: summary ? String(summary.pendingCount) : "—", cls: "text-amber-600" },
          { icon: Users, label: t("عدد المسيرات", "Runs count"), value: summary ? String(summary.runsCount) : "—", cls: "text-slate-600" },
        ].map((kpi, i) => (
          <Card key={i} className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{kpi.value}</p>
                </div>
                <kpi.icon className={cn("h-8 w-8 opacity-40", kpi.cls)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Runs table */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          {runsQuery.isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="p-10 text-center">
              <Banknote className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {t(`مفيش مسيرات رواتب لسنة ${year}`, `No payroll runs for ${year}`)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {t("ابدأ بإنشاء مسير الشهر من زر «مسير شهر جديد»", "Start by creating a monthly run")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("الشهر", "Month")}</TableHead>
                  <TableHead>{t("رقم المسير", "Run #")}</TableHead>
                  <TableHead>{t("الموظفون", "Employees")}</TableHead>
                  <TableHead>{t("الإجمالي", "Gross")}</TableHead>
                  <TableHead>{t("الاستقطاعات", "Deductions")}</TableHead>
                  <TableHead>{t("الصافي", "Net")}</TableHead>
                  <TableHead>{t("الحالة", "Status")}</TableHead>
                  <TableHead className="text-end">{t("إجراءات", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => setDetailId(run.id)}
                  >
                    <TableCell className="font-bold">{monthName(run.month, isAr)} {run.year}</TableCell>
                    <TableCell className="font-mono text-xs">{run.runNumber}</TableCell>
                    <TableCell>{run.employeeCount}</TableCell>
                    <TableCell>{formatCurrency(run.totalGross, isAr)}</TableCell>
                    <TableCell className="text-rose-600">{formatCurrency(run.totalDeductions, isAr)}</TableCell>
                    <TableCell className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(run.totalNet, isAr)}</TableCell>
                    <TableCell><StatusBadge status={run.status} isAr={isAr} /></TableCell>
                    <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" className="h-7 rounded-lg text-[11px]" onClick={() => setDetailId(run.id)}>
                          {t("فتح", "Open")}
                        </Button>
                        {run.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-lg text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            disabled={busy}
                            onClick={() => {
                              if (confirm(t(`تحذف مسير ${monthName(run.month, isAr)}؟`, `Delete the ${monthName(run.month, isAr)} run?`))) {
                                runActionMutation.mutate({ id: run.id, action: "delete" });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[440px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="h-5 w-5 text-emerald-600" />
              {t("مسير رواتب شهر جديد", "New monthly payroll run")}
            </DialogTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(
                "هنولّد بند لكل موظف نشط براتبه المسجّل، وبعدين تقدر تعدّل البدلات والاستقطاعات قبل الاعتماد.",
                "We'll generate one row per active employee at their recorded salary; you can adjust allowances/deductions before approving."
              )}
            </p>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("الشهر", "Month")}</Label>
                <Select value={newMonth} onValueChange={setNewMonth}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_AR.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{isAr ? m : MONTHS_EN[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("السنة", "Year")}</Label>
                <Select value={newYear} onValueChange={setNewYear}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("طريقة الصرف", "Payment method")}</Label>
              <Select value={newMethod} onValueChange={setNewMethod}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">{t("تحويل بنكي (1020)", "Bank transfer (1020)")}</SelectItem>
                  <SelectItem value="cash">{t("نقدية من الخزينة (1010)", "Cash (1010)")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("ملاحظات (اختياري)", "Notes (optional)")}</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} className="rounded-xl text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setShowCreate(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? t("جاري التوليد...", "Generating...") : t("توليد المسير", "Generate run")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          {detailQuery.isLoading || !detail ? (
            <div className="space-y-3 p-2">
              <Skeleton className="h-8 w-1/2" />
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                  {t("مسير", "Payroll")} {monthName(detail.run.month, isAr)} {detail.run.year}
                  <span className="font-mono text-xs font-normal text-slate-400">{detail.run.runNumber}</span>
                  <StatusBadge status={detail.run.status} isAr={isAr} />
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {detail.run.status === "DRAFT" && t(
                    "المسير مسودة — عدّل البدلات والاستقطاعات لكل موظف، وبعدين اعتمد المسير.",
                    "Draft — adjust each employee's allowances/deductions, then approve the run."
                  )}
                  {detail.run.status === "APPROVED" && t(
                    "المسير معتمد — سجّل صرف كل راتب بعد تسليمه، أو صرف الكل مرة واحدة.",
                    "Approved — record each salary as paid once handed over, or pay all at once."
                  )}
                  {detail.run.status === "PAID" && t(
                    "المسير مصروف ومقفول — القيد المحاسبي متسجل في قيود اليومية.",
                    "Run is paid and locked — the journal entry is posted to the ledger."
                  )}
                </p>
              </DialogHeader>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
                  <p className="text-[10px] text-slate-500">{t("الإجمالي (أساسي + بدلات)", "Gross (base + allowances)")}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(detail.run.totalGross, isAr)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
                  <p className="text-[10px] text-slate-500">{t("الاستقطاعات", "Deductions")}</p>
                  <p className="text-sm font-bold text-rose-600">{formatCurrency(detail.run.totalDeductions, isAr)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5">
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400">{t("الصافي المطلوب صرفه", "Net to pay")}</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(detail.run.totalNet, isAr)}</p>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("الموظف", "Employee")}</TableHead>
                      <TableHead>{t("الأساسي", "Base")}</TableHead>
                      <TableHead>{t("بدلات", "Allow.")}</TableHead>
                      <TableHead>{t("استقطاعات", "Deduct.")}</TableHead>
                      <TableHead>{t("الصافي", "Net")}</TableHead>
                      <TableHead className="text-end">{t("الحالة", "Status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-slate-400 py-6">{t("لا توجد بنود", "No items")}</TableCell></TableRow>
                    ) : (
                      detail.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{item.employeeName || t("بدون اسم", "Unnamed")}</p>
                            <p className="text-[10px] text-slate-400">{item.position}</p>
                          </TableCell>
                          <TableCell className="text-xs">{formatCurrency(item.baseSalary, isAr)}</TableCell>
                          <TableCell className="text-xs text-emerald-600">{item.allowances ? formatCurrency(item.allowances, isAr) : "—"}</TableCell>
                          <TableCell className="text-xs text-rose-600">{item.deductions ? `-${formatCurrency(item.deductions, isAr)}` : "—"}</TableCell>
                          <TableCell className="text-xs font-bold">{formatCurrency(item.netAmount, isAr)}</TableCell>
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1">
                              {detail.run.status === "DRAFT" && (
                                <Button variant="outline" size="sm" className="h-7 rounded-lg text-[11px]" disabled={busy} onClick={() => openEditItem(item)}>
                                  <Pencil className="h-3 w-3" />
                                  {t("تعديل", "Edit")}
                                </Button>
                              )}
                              {detail.run.status === "APPROVED" && (
                                <Button
                                  variant={item.paid ? "outline" : "default"}
                                  size="sm"
                                  className={cn("h-7 rounded-lg text-[11px]", item.paid && "text-emerald-700 border-emerald-300")}
                                  disabled={busy}
                                  onClick={() => toggleItemMutation.mutate(item.id)}
                                >
                                  {item.paid ? <CheckCircle2 className="h-3 w-3" /> : <Coins className="h-3 w-3" />}
                                  {item.paid ? t("اتصرف", "Paid") : t("سجّل الصرف", "Mark paid")}
                                </Button>
                              )}
                              {detail.run.status === "PAID" && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {t("اتصرف", "Paid")}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Run-level actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {t(
                    `طريقة الصرف: ${detail.run.paymentMethod === "cash" ? "نقدية من الخزينة" : "تحويل بنكي"}`,
                    `Payment method: ${detail.run.paymentMethod === "cash" ? "Cash" : "Bank transfer"}`
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {detail.run.status === "DRAFT" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-[11px] text-rose-600 hover:bg-rose-50"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t(`تحذف مسير ${monthName(detail.run.month, isAr)} نهائياً؟`, "Delete this draft run?"))) {
                            runActionMutation.mutate({ id: detail.run.id, action: "delete" });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("حذف المسير", "Delete run")}
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={busy}
                        onClick={() => runActionMutation.mutate({ id: detail.run.id, action: "approve" })}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        {t("اعتماد المسير", "Approve run")}
                      </Button>
                    </>
                  )}
                  {detail.run.status === "APPROVED" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-[11px]"
                        disabled={busy}
                        onClick={() => runActionMutation.mutate({ id: detail.run.id, action: "reopen" })}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t("إعادة فتح كمسودة", "Reopen as draft")}
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t(
                            `تسجيل صرف كل الرواتب (${formatCurrency(detail.run.totalNet, isAr)}) وترحيل القيد؟`,
                            `Mark all salaries paid (${formatCurrency(detail.run.totalNet, isAr)}) and post the journal entry?`
                          ))) {
                            runActionMutation.mutate({ id: detail.run.id, action: "mark-paid" });
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("تسجيل صرف الكل", "Mark all paid")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-[380px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {t("تعديل راتب:", "Edit salary:")} {editingItem?.employeeName}
            </DialogTitle>
            <p className="text-xs text-slate-500">
              {t("الأساسي", "Base")}: {editingItem ? formatCurrency(editingItem.baseSalary, isAr) : "—"} · {t("الصافي بيتحسب أوتوماتيك", "Net is computed automatically")}
            </p>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("بدلات (سكن، مواصلات...)", "Allowances (housing, transport...)")}</Label>
                <Input type="number" min="0" step="0.01" value={editAllow} onChange={(e) => setEditAllow(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("استقطاعات (سلف، جزاءات...)", "Deductions (advances...)")}</Label>
                <Input type="number" min="0" step="0.01" value={editDeduct} onChange={(e) => setEditDeduct(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{t("الصافي بعد التعديل", "Net after change")}</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(Math.max(0, (editingItem?.baseSalary || 0) + (Number(editAllow) || 0) - (Number(editDeduct) || 0)), isAr)}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("ملاحظات", "Notes")}</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="rounded-xl text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setEditingItem(null)}>{t("إلغاء", "Cancel")}</Button>
            <Button
              className="rounded-xl text-xs font-bold"
              disabled={editItemMutation.isPending}
              onClick={() => editItemMutation.mutate()}
            >
              {editItemMutation.isPending ? t("جاري الحفظ...", "Saving...") : t("حفظ التعديل", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
