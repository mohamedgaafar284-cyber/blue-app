"use client";

import React, { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  Plus,
  FileText,
  CreditCard,
  PieChart,
  BookOpen,
  ShieldCheck,
  FileCheck2,
  Receipt,
  Scale,
  RefreshCw,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { useLang } from "@/hooks/use-lang";
import { QuickEntryModal } from "@/components/pages/finance/quick-entry-modal";

// Lazy-loaded tab components (client-side only to minimize initial bundle size)
const InvoicesPage = dynamic(() => import("@/components/pages/invoices"), {
  loading: () => <TabLoadingSkeleton />,
  ssr: false,
});

const PaymentsPage = dynamic(() => import("@/components/pages/payments"), {
  loading: () => <TabLoadingSkeleton />,
  ssr: false,
});

const FinanceExpensesPage = dynamic(
  () => import("@/components/pages/finance-expenses"),
  {
    loading: () => <TabLoadingSkeleton />,
    ssr: false,
  }
);

const FinanceReportsPage = dynamic(
  () => import("@/components/pages/finance-reports"),
  {
    loading: () => <TabLoadingSkeleton />,
    ssr: false,
  }
);

const FinancePayrollPage = dynamic(
  () => import("@/components/pages/finance-payroll"),
  {
    loading: () => <TabLoadingSkeleton />,
    ssr: false,
  }
);

function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

interface SummaryData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  receivables: number;
  payables: number;
  liquidFunds: number;
  hasData: boolean;
}

interface InvoicesResponse {
  invoices: Array<{
    id: string;
    remaining: number;
    total: number;
    status: string;
  }>;
  pagination: {
    total: number;
  };
}

interface FinanceHubProps {
  language?: "ar" | "en";
  initialTab?: string;
}

export default function FinanceHub({
  language: propLang,
  initialTab = "invoices",
}: FinanceHubProps) {
  const hookLang = useLang();
  const lang = propLang || hookLang || "ar";
  const ar = lang === "ar";

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [quickEntryType, setQuickEntryType] = useState<"expense" | "income">("expense");
  const [, startTransition] = useTransition();

  // Keep track of tabs that have been mounted at least once (Keep-Alive pattern)
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(
    () => new Set([initialTab])
  );

  const handleTabChange = (tabId: string) => {
    setMountedTabs((prev) => {
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });
    startTransition(() => {
      setActiveTab(tabId);
    });
  };

  // 1. Fetch Finance Summary (Receivables, Payables, Net Profit, Liquid Funds)
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isRefetching,
  } = useQuery<SummaryData>({
    queryKey: ["finance-summary"],
    queryFn: async () => {
      const res = await fetch("/api/finance/summary");
      if (!res.ok) throw new Error("Failed to fetch finance summary");
      const json = await res.json();
      return json.data || json;
    },
    staleTime: 60_000,
  });

  // 2. Fetch Overdue Invoices stats
  const { data: overdueData, isLoading: isOverdueLoading } =
    useQuery<InvoicesResponse>({
      queryKey: ["invoices-overdue-count"],
      queryFn: async () => {
        const res = await fetch("/api/invoices?status=OVERDUE&limit=100");
        if (!res.ok) throw new Error("Failed to fetch overdue invoices");
        return res.json();
      },
      staleTime: 60_000,
    });

  const overdueCount = overdueData?.pagination?.total ?? overdueData?.invoices?.length ?? 0;
  const overdueTotal =
    overdueData?.invoices?.reduce((sum, inv) => sum + (inv.remaining ?? inv.total ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-16">
      {/* Top Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>{ar ? "غرفة عمليات المحاسبة والمالية" : "Finance Operations Hub"}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "إدارة متكاملة للفواتير، المدفوعات، المصروفات والمؤشرات المالية في مكان واحد"
              : "Unified cockpit for invoices, payments, expenses, and financial health"}
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchSummary()}
            disabled={isRefetching}
            className="gap-1.5"
            title={ar ? "تحديث الأرقام" : "Refresh KPIs"}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">
              {ar ? "تحديث" : "Refresh"}
            </span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleTabChange("invoices")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>{ar ? "فاتورة جديدة" : "New Invoice"}</span>
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleTabChange("payments")}
            className="gap-1.5 shadow-sm"
          >
            <CreditCard className="h-4 w-4" />
            <span>{ar ? "تسجيل دفعة" : "Record Payment"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQuickEntryType("expense");
              setQuickEntryOpen(true);
            }}
            className="gap-1.5"
          >
            <TrendingDown className="h-4 w-4 text-rose-500" />
            <span>{ar ? "تسجيل مصروف" : "Record Expense"}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row (Cockpit Overview) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Receivables */}
        <Card className="border border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "المستحق لنا (العملاء)" : "Receivables (A/R)"}
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(summary?.receivables ?? 0, ar)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>{ar ? "حساب 1100 • ذمم مدينة" : "Account 1100 • Trade Debtors"}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Payables */}
        <Card className="border border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "المستحق علينا (الموردين)" : "Payables (A/P)"}
              </span>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {formatCurrency(summary?.payables ?? 0, ar)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>{ar ? "حساب 2100 • ذمم دائنة" : "Account 2100 • Trade Creditors"}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Overdue Collections */}
        <Card
          className={`border shadow-sm bg-gradient-to-br from-card to-card/50 cursor-pointer transition-colors ${
            overdueCount > 0
              ? "border-rose-200 dark:border-rose-900/40 hover:bg-rose-50/30 dark:hover:bg-rose-950/10"
              : "border-border/60"
          }`}
          onClick={() => handleTabChange("invoices")}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "متأخرات التحصيل" : "Overdue Invoices"}
              </span>
              <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              {isOverdueLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                  {formatCurrency(overdueTotal, ar)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {isOverdueLoading ? (
                  <Skeleton className="h-3.5 w-20" />
                ) : (
                  <span>
                    {overdueCount}{" "}
                    {ar
                      ? overdueCount === 1
                        ? "فاتورة متأخرة"
                        : "فواتير متأخرة"
                      : "invoices overdue"}
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Net Profit */}
        <Card className="border border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {ar ? "صافي الأرباح (قائمة الدخل)" : "Net Profit (YTD)"}
              </span>
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  (summary?.netProfit ?? 0) >= 0
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                }`}
              >
                <PieChart className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              {isSummaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <div
                  className={`text-xl sm:text-2xl font-bold tracking-tight ${
                    (summary?.netProfit ?? 0) >= 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatCurrency(summary?.netProfit ?? 0, ar)}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>
                  {ar ? "سيولة متوفرة: " : "Liquid funds: "}
                  {formatCurrency(summary?.liquidFunds ?? 0, ar)}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full space-y-4"
      >
        <div className="border-b border-border/60 pb-1">
          <TabsList className="bg-muted/70 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="invoices"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-primary" />
              <span>{ar ? "الفواتير" : "Invoices"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="payments"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <span>{ar ? "المدفوعات وسندات الصرف" : "Payments"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="expenses"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <TrendingDown className="h-4 w-4 text-rose-500" />
              <span>{ar ? "المصروفات" : "Expenses"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="reports"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <PieChart className="h-4 w-4 text-violet-500" />
              <span>{ar ? "التقارير المالية" : "Financial Reports"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="payroll"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <Banknote className="h-4 w-4 text-emerald-600" />
              <span>{ar ? "مسير الرواتب" : "Payroll"}</span>
            </TabsTrigger>

            <TabsTrigger
              value="advanced"
              className="rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4 text-amber-500" />
              <span>{ar ? "دفتر الأستاذ والأدوات المتقدمة" : "General Ledger & Tools"}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Invoices (Keep-Alive mounted) */}
        {mountedTabs.has("invoices") && (
          <div className={activeTab === "invoices" ? "block" : "hidden"}>
            <InvoicesPage language={lang} />
          </div>
        )}

        {/* Tab 2: Payments (Keep-Alive mounted) */}
        {mountedTabs.has("payments") && (
          <div className={activeTab === "payments" ? "block" : "hidden"}>
            <PaymentsPage language={lang} />
          </div>
        )}

        {/* Tab 3: Expenses (Keep-Alive mounted) */}
        {mountedTabs.has("expenses") && (
          <div className={activeTab === "expenses" ? "block" : "hidden"}>
            <FinanceExpensesPage />
          </div>
        )}

        {/* Tab 4: Financial Reports (Keep-Alive mounted) */}
        {mountedTabs.has("reports") && (
          <div className={activeTab === "reports" ? "block" : "hidden"}>
            <FinanceReportsPage />
          </div>
        )}

        {/* Tab 5: Monthly Payroll (Keep-Alive mounted) */}
        {mountedTabs.has("payroll") && (
          <div className={activeTab === "payroll" ? "block" : "hidden"}>
            <FinancePayrollPage />
          </div>
        )}

        {/* Tab 6: Advanced Accounting & Tools Hub */}
        {mountedTabs.has("advanced") && (
          <div className={activeTab === "advanced" ? "block" : "hidden"}>
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
                <h3 className="text-base font-semibold text-foreground">
                  {ar
                    ? "أدوات المحاسبة القانونية ودفتر الأستاذ العام"
                    : "Statutory Accounting & General Ledger Tools"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ar
                    ? "الوصول المباشر إلى شجرة الحسابات، قيود اليومية، ميزان المراجعة، خطابات الضمان والاحتجاز"
                    : "Direct access to Chart of Accounts, Journal Entries, Trial Balance, Guarantees and Retainage"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Chart of Accounts */}
                <Link
                  href="/dashboard/finance/accounts"
                  className="group p-5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ar ? "دليل الحسابات (COA)" : "Chart of Accounts"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? "إدارة الحسابات الأصول والخصوم والمصروفات والإيرادات برمز الحساب"
                          : "Assets, liabilities, equity, revenues, and expenses tree"}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 2. Journal Entries */}
                <Link
                  href="/dashboard/finance/journal-entries"
                  className="group p-5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                      <Scale className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ar ? "قيود اليومية العامة" : "General Journal Entries"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? "تسجيل القيود اليدوية والتسويات ومراجعة القيود الآلية المتوازنة"
                          : "Double-entry journal entries, manual adjustments and audit trails"}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 3. Accounting Reports & Trial Balance */}
                <Link
                  href="/dashboard/finance/accounting-reports"
                  className="group p-5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:scale-105 transition-transform">
                      <PieChart className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ar ? "القوائم المالية وميزان المراجعة" : "Financial Statements & Trial Balance"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? "ميزان المراجعة، الميزانية العمومية، وقائمة الدخل المدققة"
                          : "Trial balance, balance sheet, and audited income statement"}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 4. Retainage */}
                <Link
                  href="/dashboard/finance/retainage"
                  className="group p-5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ar ? "إدارة مبالغ الاحتجاز" : "Retainage Management"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? "متابعة نسب الاحتجاز من المستخلصات وإفراج الضمانات"
                          : "Track contractual retainage withholdings and releases"}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 5. Guarantee Letters */}
                <Link
                  href="/dashboard/finance/guarantees"
                  className="group p-5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ar ? "خطابات الضمان البنكية (LG)" : "Letters of Guarantee (LG)"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? "إدارة خطابات الضمان الابتدائية والنهائية وتواريخ استحقاقها"
                          : "Tender, performance, and advance payment guarantee bonds"}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 6. Progress Claims */}
                <Link
                  href="/dashboard/finance/progress-claims"
                  className="group p-5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
                      <FileCheck2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ar ? "مطالبات الإنجاز (المستخلصات)" : "Progress Claims / IPC"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? "شهادات الدفع المرحلية للمشاريع الهندسية ونسب الإنجاز"
                          : "Interim payment certificates and milestone claim approvals"}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* 7. Payroll Direct Link */}
                <Link
                  href="/dashboard/finance/payroll"
                  className="group p-5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:shadow-md transition-all block"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {ar ? "مسير الرواتب المستقل" : "Standalone Payroll Portal"}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ar
                          ? "إدارة مسيرات الرواتب الشهرية والترحيل المحاسبي لرواتب الموظفين"
                          : "Monthly payroll processing, allowances, deductions and GL posting"}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </Tabs>

      {/* Quick Entry Modal for Expense / Direct Income */}
      <QuickEntryModal
        language={lang}
        open={quickEntryOpen}
        onOpenChange={setQuickEntryOpen}
      />
    </div>
  );
}
