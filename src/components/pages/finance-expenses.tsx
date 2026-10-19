"use client";


import { useTranslations } from 'next-intl';
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { TrendingDown, Search, Download, CreditCard, Wallet, Clock, CheckCircle, ArrowDownRight, ArrowUpRight, Building2, Wifi, Receipt } from 'lucide-react'

import { useLang } from "@/hooks/use-lang";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/export-utils";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { formatCurrency, formatK } from "@/lib/formatters";

// ===== Types =====
interface PaymentRecord {
  id: string;
  voucherNumber: string;
  amount: number;
  payMethod: string;
  beneficiary: string;
  referenceNumber: string;
  status: string;
  description: string;
  projectId: string | null;
  createdAt: string;
  project: { id: string; name: string; nameEn: string; number: string } | null;
}

interface ProjectOption {
  id: string;
  name: string;
  nameEn: string;
  number: string;
}

// ===== Main Component =====
interface Props {
  language?: "ar" | "en";
}

export default function FinanceExpensesPage({ }: Props) {
  const tAuto = useTranslations();
  const lang = useLang();
  const ar = lang === "ar";
  const toastFeedback = useToastFeedback({ ar });
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const gridStroke = isDark ? "#334155" : "#e2e8f0";
  const tickColor = isDark ? "#94a3b8" : "#64748b";
  const legendColor = isDark ? "#cbd5e1" : "#334155";

  // Fetch payments — robustly handles all API response shapes:
  // { data: [...], pagination: {...} } | { payments: [...] } | [...] | unexpected shapes
  const { data: payments = [], isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["payments-expenses"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/payments?type=expense&limit=1000");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        // Try all known response shapes, then ensure we always return an array
        const items = json.data ?? json.payments ?? (Array.isArray(json) ? json : []);
        return Array.isArray(items) ? items : [];
      } catch {
        return []; // Never let queryFn throw — return empty array on any error
      }
    },
    // Ensure data is always an array even if React Query returns stale/unexpected data
    select: (data) => Array.isArray(data) ? data : [],
  });

  // Fetch projects
  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const res = await fetch("/api/projects-simple");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Filter payments
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        p.voucherNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.beneficiary.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        (p.project && (ar ? p.project.name : p.project.nameEn || p.project.name).toLowerCase().includes(search.toLowerCase()));
      const matchProject = filterProject === "all" || p.projectId === filterProject;
      const matchMethod = filterMethod === "all" || p.payMethod === filterMethod;
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      return matchSearch && matchProject && matchMethod && matchStatus;
    });
  }, [payments, search, filterProject, filterMethod, filterStatus, ar]);

  // Fetch server-side accurate aggregates
  const { data: serverAggregates } = useQuery<{
    totalAmount: number;
    totalCount: number;
    completedAmount: number;
    completedCount: number;
    pendingAmount: number;
    pendingCount: number;
  }>({
    queryKey: ["payments-expenses-aggregate", filterProject],
    queryFn: async () => {
      try {
        const url = filterProject !== "all"
          ? `/api/payments/aggregate?type=expense&projectId=${filterProject}`
          : `/api/payments/aggregate?type=expense`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed");
        return res.json();
      } catch {
        return null;
      }
    },
  });

  // Summary calculations
  const now = new Date();
  const hasActiveFilters = search !== "" || filterMethod !== "all" || filterStatus !== "all";
  const totalExpenses = (serverAggregates && !hasActiveFilters)
    ? serverAggregates.totalAmount
    : filtered.reduce((s, p) => s + Number(p.amount), 0);
  const completedExpenses = (serverAggregates && !hasActiveFilters)
    ? serverAggregates.completedAmount
    : filtered.filter((p) => p.status === "COMPLETED").reduce((s, p) => s + Number(p.amount), 0);
  const pendingExpenses = (serverAggregates && !hasActiveFilters)
    ? serverAggregates.pendingAmount
    : filtered.filter((p) => p.status === "PENDING" || p.status === "APPROVED").reduce((s, p) => s + Number(p.amount), 0);

  const thisMonthPayments = filtered.filter((p) => {
    const d = new Date(p.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && p.status === "COMPLETED";
  });
  const lastMonthPayments = filtered.filter((p) => {
    const d = new Date(p.createdAt);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear() && p.status === "COMPLETED";
  });
  const thisMonthTotal = thisMonthPayments.reduce((s, p) => s + Number(p.amount), 0);
  const lastMonthTotal = lastMonthPayments.reduce((s, p) => s + Number(p.amount), 0);
  const expenseGrowth = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

  // Category-based expense distribution
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    filtered.forEach((p) => {
      // Group by payment method as proxy for category
      const catKey = p.payMethod || "other";
      cats[catKey] = (cats[catKey] || 0) + p.amount;
    });
    const methodLabels: Record<string, string> = {
      CASH: tAuto('auto.cash'),
      CHEQUE: tAuto('auto.cheque'),
      TRANSFER: tAuto('auto.bankTransfer'),
      ONLINE: tAuto('auto.online'),
    };
    const colors = ["#ef4444", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899"];
    return Object.entries(cats).map(([key, value], i) => ({
      name: methodLabels[key] || key,
      value,
      color: colors[i % colors.length],
    })).sort((a, b) => b.value - a.value);
  }, [filtered, tAuto]);

  // Expense by project
  const expenseByProject = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    filtered.forEach((p) => {
      if (!p.project) return;
      const name = ar ? p.project.name : p.project.nameEn || p.project.name;
      if (!map[p.projectId || ""]) map[p.projectId || ""] = { name, amount: 0, count: 0 };
      map[p.projectId || ""].amount += p.amount;
      map[p.projectId || ""].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [filtered, ar]);

  // Monthly expense chart data – pre-filter completed payments as a simpler intermediate
  const completedPayments = payments.filter((p) => p.status === "COMPLETED");
  const monthlyExpenseData = (() => {
    const months: Record<string, { monthAr: string; monthEn: string; amount: number; count: number }> = {};
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months[key] = { monthAr: arMonths[d.getMonth()], monthEn: enMonths[d.getMonth()], amount: 0, count: 0 };
    }

    completedPayments.forEach((p) => {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (months[key]) {
        months[key].amount += p.amount;
        months[key].count += 1;
      }
    });

    return Object.values(months);
  })();

  // Payment tracking summary
  const trackingSummary = useMemo(() => {
    const byStatus: Record<string, { count: number; amount: number }> = {};
    filtered.forEach((p) => {
      if (!byStatus[p.status]) byStatus[p.status] = { count: 0, amount: 0 };
      byStatus[p.status].count += 1;
      byStatus[p.status].amount += p.amount;
    });
    return byStatus;
  }, [filtered]);

  const statusConfig: Record<string, { ar: string; en: string; color: string }> = {
    PENDING: { ar: "معلّق", en: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
    APPROVED: { ar: "معتمد", en: "Approved", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300" },
    COMPLETED: { ar: "مكتمل", en: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" },
    CANCELLED: { ar: "ملغي", en: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300" },
  };

  const methodConfig: Record<string, { ar: string; en: string; icon: typeof CreditCard }> = {
    CASH: { ar: "نقدي", en: "Cash", icon: Wallet },
    CHEQUE: { ar: "شيك", en: "Cheque", icon: CreditCard },
    TRANSFER: { ar: "تحويل بنكي", en: "Transfer", icon: Building2 },
    ONLINE: { ar: "دفع إلكتروني", en: "Online", icon: Wifi },
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const totalCategory = categoryData.reduce((s, c) => s + c.value, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <TrendingDown className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tAuto('auto.expenses')}</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{tAuto('auto.trackManageExpenses')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ms-auto">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => {
            const exportData = filtered.map((p) => ({
              [tAuto('auto.voucher')]: p.voucherNumber,
              [tAuto('auto.project')]: p.project ? (ar ? p.project.name : p.project.nameEn || p.project.name) : "—",
              [tAuto('auto.amount')]: p.amount,
              [tAuto('auto.method')]: p.payMethod,
              [tAuto('auto.beneficiary')]: p.beneficiary,
              [tAuto('auto.status1')]: p.status,
              [tAuto('auto.date')]: new Date(p.createdAt).toLocaleDateString(ar ? "ar-AE" : "en-US"),
            }));
            if (exportData.length > 0) {
              exportToCSV(exportData, tAuto('auto.expensesreport'));
              toastFeedback.showSuccess(tAuto('auto.exported'));
            }
          }}>
            <Download className="h-3.5 w-3.5" />{tAuto('auto.exportCSV')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 p-4 relative">
            <div className="absolute top-0 start-0 w-16 h-16 bg-white/5 rounded-full -translate-x-4 -translate-y-4" />
            <div className="flex items-center gap-2 mb-2 relative">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm"><TrendingDown className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-red-100">{tAuto('auto.thisMonth1')}</span>
            </div>
            <div className="text-lg font-bold text-white tabular-nums relative">{formatCurrency(thisMonthTotal, ar)}</div>
            <div className="mt-1.5">
              <div className={cn("flex items-center gap-0.5 text-[10px] font-medium", expenseGrowth >= 0 ? "text-red-200" : "text-emerald-200")}>
                {expenseGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                <span>{Math.abs(expenseGrowth).toFixed(1)}% {tAuto('auto.vsLastMonth')}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm"><Clock className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-amber-100">{tAuto('auto.pending')}</span>
            </div>
            <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(pendingExpenses, ar)}</div>
            <p className="text-[10px] text-white/60 mt-1">
              {filtered.filter((p) => p.status === "PENDING" || p.status === "APPROVED").length} {tAuto('auto.paymentS')}
            </p>
          </div>
        </Card>

        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm"><CheckCircle className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-emerald-100">{tAuto('auto.completed')}</span>
            </div>
            <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(completedExpenses, ar)}</div>
            <p className="text-[10px] text-white/60 mt-1">
              {filtered.filter((p) => p.status === "COMPLETED").length} {tAuto('auto.paymentS')}
            </p>
          </div>
        </Card>

        <Card className="py-0 gap-0 border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm"><Receipt className="h-3.5 w-3.5 text-white" /></div>
              <span className="text-[11px] text-violet-100">{tAuto('auto.totalExpenses')}</span>
            </div>
            <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(totalExpenses, ar)}</div>
            <p className="text-[10px] text-white/60 mt-1">{filtered.length} {tAuto('auto.paymentS')}</p>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expense by Category Pie Chart */}
        <Card className="border-slate-200 dark:border-slate-700/50 shadow-sm"><CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{tAuto('auto.expensesByPaymentMethod')}</h3>
          <p className="text-[10px] text-slate-400 mb-4">{tAuto('auto.expenseDistributionByPaymentType')}</p>
          {categoryData.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative w-full max-w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">
                      {categoryData.map((entry, index) => <Cell key={`cat-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as { name: string; value: number; color: string };
                      return (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-lg">
                          <p className="text-xs text-slate-500 font-medium">{d.name}</p>
                          <p className="text-sm font-bold font-mono tabular-nums" style={{ color: d.color }}>{formatCurrency(d.value, ar)}</p>
                          {totalCategory > 0 && <p className="text-[10px] text-slate-400">{((d.value / totalCategory) * 100).toFixed(1)}%</p>}
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums">{formatK(totalCategory)}</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">{tAuto('auto.aED')}</span>
                </div>
              </div>
              <div className="flex-1 space-y-3 w-full">
                {categoryData.map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                        <span className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">{formatCurrency(item.value, ar)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${totalCategory > 0 ? (item.value / totalCategory) * 100 : 0}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-xs text-slate-400">{tAuto('auto.noData')}</p>
          )}
        </CardContent></Card>

        {/* Monthly Expense Chart */}
        <Card className="border-slate-200 dark:border-slate-700/50 shadow-sm"><CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{tAuto('auto.monthlyExpenses')}</h3>
          <p className="text-[10px] text-slate-400 mb-4">{tAuto('auto.expenseTrendOverTheLast6Months')}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyExpenseData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey={tAuto('auto.monthEn')} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { amount: number; count: number };
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-lg">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(d.amount, ar)}</p>
                      <p className="text-[10px] text-slate-400">{d.count} {tAuto('auto.paymentS')}</p>
                    </div>
                  );
                }} />
                <Legend wrapperStyle={{ fontSize: 12, color: legendColor }} />
                <Bar dataKey="amount" name={tAuto('auto.expenses')} fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent></Card>
      </div>

      {/* Payment Tracking */}
      <Card className="border-slate-200 dark:border-slate-700/50 shadow-sm"><CardContent className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{tAuto('auto.paymentTracking')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(statusConfig).map(([key, sc]) => {
            const data = trackingSummary[key] || { count: 0, amount: 0 };
            const icons: Record<string, typeof Clock> = { pending: Clock, APPROVED: CheckCircle, COMPLETED: CheckCircle, CANCELLED: TrendingDown };
            const Icon = icons[key] || Clock;
            const iconColors: Record<string, string> = {
              PENDING: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50",
              APPROVED: "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/50",
              COMPLETED: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50",
              CANCELLED: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50",
            };
            return (
              <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                <div className={cn("p-1.5 rounded-lg", iconColors[key])}><Icon className="h-4 w-4" /></div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{ar ? sc.ar : sc.en}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(data.amount, ar)}</p>
                  <p className="text-[10px] text-slate-400">{data.count} {tAuto('auto.paymentS')}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent></Card>

      {/* Expense by Project */}
      {expenseByProject.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-700/50 shadow-sm"><CardContent className="p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{tAuto('auto.expensesByProject')}</h3>
          <div className="space-y-3">
            {expenseByProject.slice(0, 8).map((p, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                    <span className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">{formatCurrency(p.amount, ar)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-500 transition-all duration-500" style={{ width: `${completedExpenses > 0 ? (p.amount / completedExpenses) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{p.count} {tAuto('auto.paymentS')}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Expense Table */}
      <Card className="border-slate-200 dark:border-slate-700/50 shadow-sm"><CardContent className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{tAuto('auto.expenseDetails')}</h3>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tAuto('auto.search1')} className="ps-9 h-8 text-sm rounded-lg" />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg"><SelectValue placeholder={tAuto('auto.project')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.allProjects')}</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMethod} onValueChange={setFilterMethod}>
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg"><SelectValue placeholder={tAuto('auto.method')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.all')}</SelectItem>
              <SelectItem value="CASH">{tAuto('auto.cash')}</SelectItem>
              <SelectItem value="CHEQUE">{tAuto('auto.cheque')}</SelectItem>
              <SelectItem value="TRANSFER">{tAuto('auto.transfer')}</SelectItem>
              <SelectItem value="ONLINE">{tAuto('auto.online')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.all')}</SelectItem>
              <SelectItem value="PENDING">{tAuto('auto.pending')}</SelectItem>
              <SelectItem value="APPROVED">{tAuto('auto.approved')}</SelectItem>
              <SelectItem value="COMPLETED">{tAuto('auto.completed')}</SelectItem>
              <SelectItem value="CANCELLED">{tAuto('auto.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-slate-50/80 dark:bg-slate-800/50">
                  <TableHead className="text-xs font-semibold">{tAuto('auto.voucher')}</TableHead>
                  <TableHead className="text-xs font-semibold hidden md:table-cell">{tAuto('auto.project')}</TableHead>
                  <TableHead className="text-xs font-semibold hidden lg:table-cell">{tAuto('auto.beneficiary')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.method')}</TableHead>
                  <TableHead className="text-xs font-semibold text-start">{tAuto('auto.amount')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.status1')}</TableHead>
                  <TableHead className="text-xs font-semibold hidden sm:table-cell">{tAuto('auto.date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p, idx) => {
                  const sc = statusConfig[p.status] || statusConfig.PENDING;
                  const mc = methodConfig[p.payMethod] || methodConfig.transfer;
                  const MethodIcon = mc.icon;
                  return (
                    <TableRow key={p.id} className={cn(idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/20")}>
                      <TableCell className="font-mono text-xs text-slate-500">{p.voucherNumber || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-slate-500">{p.project ? (ar ? p.project.name : p.project.nameEn || p.project.name) : "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-slate-600 dark:text-slate-300 max-w-[150px] truncate">{p.beneficiary || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MethodIcon className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs">{ar ? mc.ar : mc.en}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-start font-medium font-mono tabular-nums text-slate-900 dark:text-white">{formatCurrency(p.amount, ar)}</TableCell>
                      <TableCell><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", sc.color)}>{ar ? sc.ar : sc.en}</span></TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString(ar ? "ar-AE" : "en-US")}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">{tAuto('auto.noExpensesFound')}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* Quick Total */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.totalShown')} ({filtered.length})</span>
          <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">{formatCurrency(totalExpenses, ar)}</span>
        </div>
      </CardContent></Card>
    </div>
  );
}
