/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-lang";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileSpreadsheet, 
  BookOpen, 
  Scale, 
  TrendingUp, 
  Building,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileDown,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export default function FinanceAccountingReportsPage() {
  const { t, isAr } = useLanguage();
  const [activeTab, setActiveTab] = useState("ledger");

  // Filters state
  const [ledgerAccountId, setLedgerAccountId] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [balanceSheetDate, setBalanceSheetDate] = useState("");

  const [statementTargetType, setStatementTargetType] = useState<"client" | "supplier">("client");
  const [statementTargetId, setStatementTargetId] = useState("");

  // 1. Fetch Accounts (for filter dropdowns)
  const { data: accounts = [] } = useQuery<any[]>({
    queryKey: ["finance", "accounts"],
    queryFn: async () => {
      const res = await fetch("/api/finance/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const json = await res.json();
      return json.data;
    },
  });

  // 2. Fetch General Ledger
  const { data: ledgerLines = [], isLoading: isLoadingLedger, refetch: refetchLedger } = useQuery<any[]>({
    queryKey: ["finance", "reports", "ledger", ledgerAccountId, startDate, endDate],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (ledgerAccountId !== "ALL") queryParams.append("accountId", ledgerAccountId);
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);
      const res = await fetch(`/api/finance/ledger?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch ledger");
      const json = await res.json();
      return json.data;
    },
  });

  // 3. Fetch Trial Balance
  const { data: trialBalance, isLoading: isLoadingTB, refetch: refetchTB } = useQuery<any>({
    queryKey: ["finance", "reports", "trial-balance"],
    queryFn: async () => {
      const res = await fetch("/api/finance/trial-balance");
      if (!res.ok) throw new Error("Failed to fetch trial balance");
      const json = await res.json();
      return json.data;
    },
  });

  // 4. Fetch Income Statement (P&L)
  const { data: incomeStatement, isLoading: isLoadingIS, refetch: refetchIS } = useQuery<any>({
    queryKey: ["finance", "reports", "income-statement", startDate, endDate],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);
      const res = await fetch(`/api/finance/income-statement?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch income statement");
      const json = await res.json();
      return json.data;
    },
  });

  // 5. Fetch Balance Sheet
  const { data: balanceSheet, isLoading: isLoadingBS, refetch: refetchBS } = useQuery<any>({
    queryKey: ["finance", "reports", "balance-sheet", balanceSheetDate],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (balanceSheetDate) queryParams.append("date", balanceSheetDate);
      const res = await fetch(`/api/finance/balance-sheet?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch balance sheet");
      const json = await res.json();
      return json.data;
    },
  });

  // 6. Fetch VAT Return
  const { data: vatReturn, isLoading: isLoadingVAT, refetch: refetchVAT } = useQuery<any>({
    queryKey: ["finance", "reports", "vat-return", startDate, endDate],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);
      const res = await fetch(`/api/finance/reports/vat-return?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch VAT Return");
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === "vat-return",
  });

  // 7. Fetch AR Aging
  const { data: arAging = [], isLoading: isLoadingARAging, refetch: refetchARAging } = useQuery<any[]>({
    queryKey: ["finance", "reports", "ar-aging"],
    queryFn: async () => {
      const res = await fetch("/api/finance/reports/ar-aging");
      if (!res.ok) throw new Error("Failed to fetch AR Aging");
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === "ar-aging",
  });

  // 8. Fetch AP Aging
  const { data: apAging = [], isLoading: isLoadingAPAging, refetch: refetchAPAging } = useQuery<any[]>({
    queryKey: ["finance", "reports", "ap-aging"],
    queryFn: async () => {
      const res = await fetch("/api/finance/reports/ap-aging");
      if (!res.ok) throw new Error("Failed to fetch AP Aging");
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === "ap-aging",
  });

  // 9. Fetch Budget vs Actual
  const { data: budgetVsActual = [], isLoading: isLoadingBvA, refetch: refetchBvA } = useQuery<any[]>({
    queryKey: ["finance", "reports", "budget-vs-actual"],
    queryFn: async () => {
      const res = await fetch("/api/finance/reports/budget-vs-actual");
      if (!res.ok) throw new Error("Failed to fetch Budget vs Actual");
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === "budget-vs-actual",
  });

  // 10. Fetch Clients
  const { data: clientsList = [] } = useQuery<any[]>({
    queryKey: ["finance", "clients-list"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const json = await res.json();
      return json.data || json || [];
    },
  });

  // 11. Fetch Suppliers
  const { data: suppliersList = [] } = useQuery<any[]>({
    queryKey: ["finance", "suppliers-list"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers");
      const json = await res.json();
      return json.data || json || [];
    },
  });

  // 12. Fetch Statement
  const { data: statementData, isLoading: isLoadingStatement, refetch: refetchStatement } = useQuery<any>({
    queryKey: ["finance", "reports", "statement", statementTargetType, statementTargetId, startDate, endDate],
    queryFn: async () => {
      if (!statementTargetId) return null;
      const queryParams = new URLSearchParams();
      if (statementTargetType === "client") {
        queryParams.append("clientId", statementTargetId);
      } else {
        queryParams.append("supplierId", statementTargetId);
      }
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);
      const res = await fetch(`/api/finance/reports/statement?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch statement");
      const json = await res.json();
      return json.data;
    },
    enabled: activeTab === "statement" && !!statementTargetId,
  });

  const handleRefetch = () => {
    if (activeTab === "ledger") refetchLedger();
    if (activeTab === "trial-balance") refetchTB();
    if (activeTab === "income-statement") refetchIS();
    if (activeTab === "balance-sheet") refetchBS();
    if (activeTab === "vat-return") refetchVAT();
    if (activeTab === "ar-aging") refetchARAging();
    if (activeTab === "ap-aging") refetchAPAging();
    if (activeTab === "budget-vs-actual") refetchBvA();
    if (activeTab === "statement") refetchStatement();
  };

  const getAccountName = (acc: any) => (isAr ? acc.nameAr : acc.nameEn);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-navy-600 dark:text-navy-400" />
            {t("التقارير المالية والمحاسبية", "Financial & Accounting Reports")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("قوائم الدخل والميزانية وموازين المراجعة التفصيلية للنظام", "Trial Balance, General Ledger, Profit & Loss, and Balance Sheet statements")}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="icon" onClick={handleRefetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="flex items-center gap-1.5 ms-auto sm:ms-0">
            <FileDown className="h-4 w-4" />
            {t("تصدير التقرير", "Export Report")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl w-full flex overflow-x-auto h-auto gap-1.5">
          <TabsTrigger value="ledger" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-emerald-600" />
              {t("حركة الحسابات", "Account History")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("دفتر الأستاذ (GL)", "General Ledger")}</span>
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-blue-600" />
              {t("توازن الحسابات", "Account Balance Check")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("ميزان المراجعة", "Trial Balance")}</span>
          </TabsTrigger>
          <TabsTrigger value="income-statement" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              {t("الأرباح والخسائر", "Profit & Loss Summary")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("قائمة الدخل (P&L)", "Income Statement")}</span>
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <Building className="h-4 w-4 text-indigo-600" />
              {t("المركز المالي للشركة", "Financial Position")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("الميزانية العمومية", "Balance Sheet")}</span>
          </TabsTrigger>
          <TabsTrigger value="ar-aging" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-amber-500" />
              {t("مين مديون لنا؟", "Who Owes Us?")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("أعمار الذمم (AR)", "AR Aging")}</span>
          </TabsTrigger>
          <TabsTrigger value="ap-aging" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-rose-500" />
              {t("إحنا مديونين لمين؟", "Who Do We Owe?")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("أعمار الديون (AP)", "AP Aging")}</span>
          </TabsTrigger>
          <TabsTrigger value="vat-return" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-purple-600" />
              {t("الضريبة والمستردات", "Tax & Returns")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("الإقرار الضريبي (VAT)", "VAT Return")}</span>
          </TabsTrigger>
          <TabsTrigger value="budget-vs-actual" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              {t("المخطط مقابل الفعلي", "Budget vs Spent")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("مقارنة الموازنة", "Budget vs Actual")}</span>
          </TabsTrigger>
          <TabsTrigger value="statement" className="rounded-lg py-2 px-3 flex flex-col items-start text-xs sm:text-sm shrink-0">
            <span className="font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-sky-600" />
              {t("كشف حساب جهة", "Entity Statement")}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{t("كشف حساب عميل/مورد", "Account Statement")}</span>
          </TabsTrigger>
        </TabsList>

        {/* 1. General Ledger Tab */}
        <TabsContent value="ledger">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-navy-600 dark:text-navy-400" />
                  {t("كشف تفصيلي لحركات الحسابات", "Detailed Transaction History")}
                </CardTitle>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                  <div className="w-full sm:w-56 space-y-1">
                    <Label className="text-xs text-slate-400">{t("الحساب المالي", "Ledger Account")}</Label>
                    <Select value={ledgerAccountId} onValueChange={setLedgerAccountId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 max-h-56">
                        <SelectItem value="ALL">{t("جميع الحسابات", "All Accounts")}</SelectItem>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {getAccountName(acc)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-1/2 sm:w-36 space-y-1">
                    <Label className="text-xs text-slate-400">{t("من تاريخ", "From Date")}</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>

                  <div className="w-1/2 sm:w-36 space-y-1">
                    <Label className="text-xs text-slate-400">{t("إلى تاريخ", "To Date")}</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingLedger ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : ledgerLines.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <AlertCircle className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p>{t("لا توجد حركات مسجلة تطابق الفلاتر المحددة", "No transactions found matching search criteria")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow>
                        <TableHead className="w-28">{t("التاريخ", "Date")}</TableHead>
                        <TableHead>{t("القيد المحاسبي", "Journal Description")}</TableHead>
                        <TableHead className="w-28">{t("المرجع", "Ref")}</TableHead>
                        <TableHead>{t("الحساب", "Account")}</TableHead>
                        <TableHead className="w-32 text-end">{t("مدين", "Debit")}</TableHead>
                        <TableHead className="w-32 text-end">{t("دائن", "Credit")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerLines.map((line) => {
                        const d = new Date(line.journalEntry.date).toLocaleDateString(isAr ? "ar-AE" : "en-US");
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="text-slate-500 dark:text-slate-400">{d}</TableCell>
                            <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                              {line.journalEntry.description}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{line.journalEntry.reference || "-"}</TableCell>
                            <TableCell className="font-medium text-navy-600 dark:text-navy-400 text-xs">
                              {line.account.code} - {getAccountName(line.account)}
                            </TableCell>
                            <TableCell className="text-end font-mono">
                              {Number(line.debit) > 0 ? formatCurrency(Number(line.debit), isAr) : "-"}
                            </TableCell>
                            <TableCell className="text-end font-mono">
                              {Number(line.credit) > 0 ? formatCurrency(Number(line.credit), isAr) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Trial Balance Tab */}
        <TabsContent value="trial-balance">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-row">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-navy-600 dark:text-navy-400" />
                {t("أرصدة الحسابات وميزان التوازن", "Trial Balance Sheets")}
              </CardTitle>

              {trialBalance && (
                <div>
                  {trialBalance.balancesMatch ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("ميزان المراجعة متوازن", "Trial Balance is Balanced")}
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {t("ميزان المراجعة غير متوازن", "Out of Balance")}
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingTB ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !trialBalance || trialBalance.rows.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <p>{t("لا توجد بيانات حسابات مسجلة لتوليد ميزان المراجعة", "No accounts data registered to generate Trial Balance")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                      <TableRow>
                        <TableHead>{t("الكود", "Code")}</TableHead>
                        <TableHead>{t("اسم الحساب المالي", "Account Name")}</TableHead>
                        <TableHead>{t("النوع", "Type")}</TableHead>
                        <TableHead className="w-32 text-end">{t("حركات مدين", "Debit Activity")}</TableHead>
                        <TableHead className="w-32 text-end">{t("حركات دائن", "Credit Activity")}</TableHead>
                        <TableHead className="w-32 text-end">{t("الرصيد النهائي", "Net Balance")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trialBalance.rows.map((row: any) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono font-bold">{row.code}</TableCell>
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">{getAccountName(row)}</TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {row.type === "ASSET" && t("أصول", "Asset")}
                            {row.type === "LIABILITY" && t("التزامات", "Liability")}
                            {row.type === "EQUITY" && t("حقوق ملكية", "Equity")}
                            {row.type === "REVENUE" && t("إيرادات", "Revenue")}
                            {row.type === "EXPENSE" && t("مصروفات", "Expense")}
                          </TableCell>
                          <TableCell className="text-end font-mono">{formatCurrency(row.totalDebit, isAr)}</TableCell>
                          <TableCell className="text-end font-mono">{formatCurrency(row.totalCredit, isAr)}</TableCell>
                          <TableCell className="text-end font-mono font-bold text-navy-600 dark:text-navy-400">
                            {formatCurrency(row.netBalance, isAr)}
                            <span className="text-[10px] text-slate-400 ms-1">
                              {row.isDebitNormal ? "Dr" : "Cr"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Summary Row */}
                      <TableRow className="bg-slate-50 dark:bg-slate-800/60 font-bold border-t-2">
                        <TableCell colSpan={3} className="ps-6 font-bold text-slate-900 dark:text-slate-100">
                          {t("الإجمالي العام للقيم والأرصدة", "Grand Totals")}
                        </TableCell>
                        <TableCell className="text-end font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(trialBalance.totalDebitSum, isAr)}
                        </TableCell>
                        <TableCell className="text-end font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(trialBalance.totalCreditSum, isAr)}
                        </TableCell>
                        <TableCell className="text-end font-mono text-slate-900 dark:text-slate-100">
                          -
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Income Statement Tab */}
        <TabsContent value="income-statement">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-navy-600 dark:text-navy-400" />
                  {t("قائمة الأرباح والخسائر (Income Statement)", "Profit & Loss (Income Statement)")}
                </CardTitle>

                {/* Date range */}
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="w-1/2 space-y-1">
                    <Label className="text-xs text-slate-400">{t("من تاريخ", "From Date")}</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="w-1/2 space-y-1">
                    <Label className="text-xs text-slate-400">{t("إلى تاريخ", "To Date")}</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {isLoadingIS ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !incomeStatement ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <p>{t("لا توجد معاملات محاسبية لعرض قائمة الدخل", "No transactions found to generate Income Statement")}</p>
                </div>
              ) : (
                <div className="space-y-6 max-w-2xl mx-auto">
                  {/* Revenue Section */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 border-b pb-1">
                      {t("إيرادات التشغيل والخدمات", "Operating Revenues")}
                    </h3>
                    <Table>
                      <TableBody>
                        {incomeStatement.revenueRows.map((row: any) => (
                          <TableRow key={row.account.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 border-b-0">
                            <TableCell className="ps-0 font-medium text-slate-700 dark:text-slate-300">
                              {row.account.code} - {getAccountName(row.account)}
                            </TableCell>
                            <TableCell className="text-end font-mono font-medium pe-0">
                              {formatCurrency(row.netBalance, isAr)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t font-bold bg-slate-50/20 dark:bg-slate-800/10">
                          <TableCell className="ps-0 text-slate-900 dark:text-slate-100">{t("إجمالي الإيرادات", "Total Revenues")}</TableCell>
                          <TableCell className="text-end font-mono text-emerald-600 dark:text-emerald-400 pe-0">
                            {formatCurrency(incomeStatement.totalRevenue, isAr)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Expenses Section */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 border-b pb-1">
                      {t("مصروفات التشغيل والإدارة", "Operating Expenses")}
                    </h3>
                    <Table>
                      <TableBody>
                        {incomeStatement.expenseRows.map((row: any) => (
                          <TableRow key={row.account.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 border-b-0">
                            <TableCell className="ps-0 font-medium text-slate-700 dark:text-slate-300">
                              {row.account.code} - {getAccountName(row.account)}
                            </TableCell>
                            <TableCell className="text-end font-mono font-medium pe-0">
                              {formatCurrency(row.netBalance, isAr)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t font-bold bg-slate-50/20 dark:bg-slate-800/10">
                          <TableCell className="ps-0 text-slate-900 dark:text-slate-100">{t("إجمالي المصروفات", "Total Expenses")}</TableCell>
                          <TableCell className="text-end font-mono text-rose-600 dark:text-rose-400 pe-0">
                            {formatCurrency(incomeStatement.totalExpense, isAr)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Profit Summary Card */}
                  <Card className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 rounded-xl overflow-hidden shadow-sm">
                    <CardContent className="p-6 flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {incomeStatement.netProfit >= 0 ? t("صافي الربح الفترتي", "Net Profit") : t("صافي الخسارة الفترتية", "Net Loss")}
                        </h4>
                        <p className="text-xs text-slate-400">{t("الفارق بين إيرادات ومصروفات الفترة", "Difference between revenues and expenses")}</p>
                      </div>
                      <span className={`text-xl font-bold font-mono ${incomeStatement.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {incomeStatement.netProfit >= 0 ? "+" : ""}{formatCurrency(incomeStatement.netProfit, isAr)}
                      </span>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Balance Sheet Tab */}
        <TabsContent value="balance-sheet">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building className="h-5 w-5 text-navy-600 dark:text-navy-400" />
                  {t("الميزانية العمومية والمركز المالي (Balance Sheet)", "Balance Sheet (Financial Position)")}
                </CardTitle>

                {/* Date select */}
                <div className="flex flex-col w-full md:w-auto space-y-1">
                  <Label className="text-xs text-slate-400">{t("كما في تاريخ", "As of Date")}</Label>
                  <Input type="date" value={balanceSheetDate} onChange={(e) => setBalanceSheetDate(e.target.value)} className="w-full md:w-44" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingBS ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !balanceSheet ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <p>{t("لا توجد حركات مالية مسجلة لتوليد الميزانية العمومية", "No transactions registered to generate Balance Sheet")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                  {/* Left Column: Assets */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-navy-600 dark:text-navy-400 border-b pb-1 flex justify-between">
                      <span>{t("الأصول (Assets)", "Assets")}</span>
                    </h3>
                    <Table>
                      <TableBody>
                        {balanceSheet.assetRows.map((row: any) => (
                          <TableRow key={row.account.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 border-b-0">
                            <TableCell className="ps-0 font-medium text-slate-700 dark:text-slate-300">
                              {row.account.code} - {getAccountName(row.account)}
                            </TableCell>
                            <TableCell className="text-end font-mono font-medium pe-0">
                              {formatCurrency(row.netBalance, isAr)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t font-bold bg-slate-50/20 dark:bg-slate-800/10">
                          <TableCell className="ps-0 text-slate-900 dark:text-slate-100">{t("إجمالي الأصول", "Total Assets")}</TableCell>
                          <TableCell className="text-end font-mono text-navy-600 dark:text-navy-400 pe-0">
                            {formatCurrency(balanceSheet.totalAssets, isAr)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Right Column: Liabilities & Equity */}
                  <div className="space-y-6">
                    {/* Liabilities */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400 border-b pb-1">
                        {t("الالتزامات (Liabilities)", "Liabilities")}
                      </h3>
                      <Table>
                        <TableBody>
                          {balanceSheet.liabilityRows.map((row: any) => (
                            <TableRow key={row.account.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 border-b-0">
                              <TableCell className="ps-0 font-medium text-slate-700 dark:text-slate-300">
                                {row.account.code} - {getAccountName(row.account)}
                              </TableCell>
                              <TableCell className="text-end font-mono font-medium pe-0">
                                {formatCurrency(row.netBalance, isAr)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t font-bold bg-slate-50/20 dark:bg-slate-800/10">
                            <TableCell className="ps-0 text-slate-900 dark:text-slate-100">{t("إجمالي الالتزامات", "Total Liabilities")}</TableCell>
                            <TableCell className="text-end font-mono text-amber-600 dark:text-amber-400 pe-0">
                              {formatCurrency(balanceSheet.totalLiabilities, isAr)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Equity */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400 border-b pb-1">
                        {t("حقوق الملكية (Equity)", "Equity")}
                      </h3>
                      <Table>
                        <TableBody>
                          {balanceSheet.equityRows.map((row: any) => (
                            <TableRow key={row.account.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 border-b-0">
                              <TableCell className="ps-0 font-medium text-slate-700 dark:text-slate-300">
                                {row.account.code} - {getAccountName(row.account)}
                              </TableCell>
                              <TableCell className="text-end font-mono font-medium pe-0">
                                {formatCurrency(row.netBalance, isAr)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Retained Earnings */}
                          <TableRow className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10 border-b-0">
                            <TableCell className="ps-0 font-medium text-slate-700 dark:text-slate-300">
                              3100 - {t("الأرباح المبقاة (صافي الدخل التاريخي)", "Retained Earnings (Net Profit)")}
                            </TableCell>
                            <TableCell className="text-end font-mono font-medium pe-0">
                              {formatCurrency(balanceSheet.netRetainedEarnings, isAr)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="border-t font-bold bg-slate-50/20 dark:bg-slate-800/10">
                            <TableCell className="ps-0 text-slate-900 dark:text-slate-100">{t("إجمالي حقوق الملكية", "Total Equity")}</TableCell>
                            <TableCell className="text-end font-mono text-purple-600 dark:text-purple-400 pe-0">
                              {formatCurrency(balanceSheet.totalEquity, isAr)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    {/* Grand Total Liabilities & Equity */}
                    <div className="border-t-2 border-slate-300 dark:border-slate-700 pt-3">
                      <div className="flex justify-between items-center font-bold bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border">
                        <div>
                          <span className="text-slate-900 dark:text-slate-100">{t("إجمالي الالتزامات وحقوق الملكية", "Total Liabilities & Equity")}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            {balanceSheet.balancesMatch ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                {t("متزنة ومتطابقة", "Balanced")}
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] py-0">
                                <AlertCircle className="h-2.5 w-2.5" />
                                {t("غير متطابقة", "Unbalanced")}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-lg font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(balanceSheet.totalLiabilitiesAndEquity, isAr)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. VAT Return Tab */}
        <TabsContent value="vat-return">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="h-5 w-5" />
                {t("إقرار ضريبة القيمة المضافة (VAT 201)", "UAE VAT Return (VAT 201)")}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {t("حساب الإقرار الضريبي المبسط وفق القوانين الاتحادية للضرائب بدولة الإمارات العربية المتحدة (5%)", "UAE Standard Rated VAT Return (5%) calculation summary")}
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Date Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("من تاريخ", "Start Date")}</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("إلى تاريخ", "End Date")}</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
                </div>
              </div>

              {isLoadingVAT ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : vatReturn ? (
                <div className="space-y-6">
                  {/* Grid cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{t("ضريبة المخرجات (المبيعات)", "Output VAT (Sales)")}</p>
                          <h3 className="text-xl font-bold font-mono mt-1 text-emerald-800 dark:text-emerald-300">{formatCurrency(vatReturn.outputVat, isAr)}</h3>
                          <p className="text-[10px] text-slate-400 mt-1">{t("الوعاء الخاضع للضريبة:", "Taxable Amount:")} {formatCurrency(vatReturn.taxableSales, isAr)}</p>
                        </div>
                        <ArrowUpRight className="h-8 w-8 text-emerald-500/20 shrink-0" />
                      </CardContent>
                    </Card>

                    <Card className="bg-rose-50/50 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/50">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">{t("ضريبة المدخلات (المشتريات)", "Input VAT (Purchases)")}</p>
                          <h3 className="text-xl font-bold font-mono mt-1 text-rose-800 dark:text-rose-300">{formatCurrency(vatReturn.inputVat, isAr)}</h3>
                          <p className="text-[10px] text-slate-400 mt-1">{t("الوعاء الخاضع للضريبة:", "Taxable Amount:")} {formatCurrency(vatReturn.taxableExpenses, isAr)}</p>
                        </div>
                        <ArrowDownRight className="h-8 w-8 text-rose-500/20 shrink-0" />
                      </CardContent>
                    </Card>

                    <Card className="bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("صافي الضريبة المستحقة", "Net VAT Payable")}</p>
                          <h3 className="text-xl font-bold font-mono mt-1 text-slate-800 dark:text-slate-100">{formatCurrency(vatReturn.netVat, isAr)}</h3>
                          <Badge className={cn("text-[9px] py-0 mt-1", vatReturn.isPayable ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400")}>
                            {vatReturn.isPayable ? t("مستحق الدفع للهيئة", "Payable to Authority") : t("مسترد من الهيئة", "Refundable")}
                          </Badge>
                        </div>
                        <Scale className="h-8 w-8 text-slate-400/20 shrink-0" />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Summary Table */}
                  <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900/50">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/30">
                          <TableHead className="font-semibold">{t("بند الإقرار الضريبي", "VAT Box / Item")}</TableHead>
                          <TableHead className="text-end font-semibold">{t("المبلغ الخاضع للضريبة (AED)", "Amount Subject to Tax (AED)")}</TableHead>
                          <TableHead className="text-end font-semibold">{t("قيمة الضريبة (AED)", "Tax Amount (AED)")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{t("1. التوريدات الخاضعة للنسبة الأساسية (المبيعات)", "1. Standard Rated Supplies (Sales)")}</TableCell>
                          <TableCell className="text-end font-mono">{formatCurrency(vatReturn.taxableSales, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-emerald-600 dark:text-emerald-400 font-semibold">+{formatCurrency(vatReturn.outputVat, isAr)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">{t("2. النفقات الخاضعة للنسبة الأساسية (المشتريات)", "2. Standard Rated Expenses (Purchases)")}</TableCell>
                          <TableCell className="text-end font-mono">{formatCurrency(vatReturn.taxableExpenses, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-rose-600 dark:text-rose-400 font-semibold">-{formatCurrency(vatReturn.inputVat, isAr)}</TableCell>
                        </TableRow>
                        <TableRow className="border-t-2 font-bold bg-slate-50/50 dark:bg-slate-800/20">
                          <TableCell>{t("صافي الضريبة القابلة للدفع / (الاسترداد)", "Net VAT Payable / (Refundable)")}</TableCell>
                          <TableCell className="text-end font-mono">-</TableCell>
                          <TableCell className="text-end font-mono text-slate-900 dark:text-slate-100">{formatCurrency(vatReturn.netVat, isAr)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400">{t("لم يتم العثور على حركات ضريبية", "No VAT entries found")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. AR Aging Tab */}
        <TabsContent value="ar-aging">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-500" />
                {t("تقرير أعمار الذمم المدينة (Accounts Receivable Aging)", "Accounts Receivable Aging (AR)")}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {t("تحليل الفواتير غير المسددة حسب عدد الأيام منذ تاريخ الإصدار لتقييم كفاءة التحصيل ومخاطر الديون", "Unpaid invoice balances categorized by days outstanding to track collection efficiency")}
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingARAging ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : arAging.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/30">
                      <TableRow>
                        <TableHead className="font-semibold">{t("العميل", "Client")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("حالي (0-30 يوم)", "Current (0-30 days)")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("31 - 60 يوم", "31 - 60 days")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("61 - 90 يوم", "61 - 90 days")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("أكثر من 90 يوم", "90+ days")}</TableHead>
                        <TableHead className="text-end font-semibold font-bold">{t("الإجمالي المستحق", "Total Due")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {arAging.map((row: any) => (
                        <TableRow key={row.clientId}>
                          <TableCell className="font-medium text-slate-900 dark:text-slate-100">{row.clientName}</TableCell>
                          <TableCell className="text-end font-mono">{formatCurrency(row.current, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-amber-600 dark:text-amber-400">{formatCurrency(row.days30, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-orange-600 dark:text-orange-400">{formatCurrency(row.days60, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-red-600 dark:text-red-400 font-semibold">{formatCurrency(row.days90, isAr)}</TableCell>
                          <TableCell className="text-end font-mono font-bold">{formatCurrency(row.total, isAr)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">{t("لا توجد مبالغ مستحقة على العملاء حالياً", "No outstanding customer receivables")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. AP Aging Tab */}
        <TabsContent value="ap-aging">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-rose-500" />
                {t("تقرير أعمار الذمم الدائنة (Accounts Payable Aging)", "Accounts Payable Aging (AP)")}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {t("تحليل مستحقات الموردين ومقاولين الباطن غير المسددة حسب فترات التأخير لتفادي غرامات التأخير وتخطيط التدفق النقدي", "Unpaid supplier commitments categorized by days outstanding to plan cash outflows")}
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingAPAging ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : apAging.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/30">
                      <TableRow>
                        <TableHead className="font-semibold">{t("المورد / المقاول", "Supplier / Subcontractor")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("حالي (0-30 يوم)", "Current (0-30 days)")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("31 - 60 يوم", "31 - 60 days")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("61 - 90 يوم", "61 - 90 days")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("أكثر من 90 يوم", "90+ days")}</TableHead>
                        <TableHead className="text-end font-semibold font-bold">{t("الإجمالي المطلوب سداده", "Total Payable")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apAging.map((row: any) => (
                        <TableRow key={row.supplierId}>
                          <TableCell className="font-medium text-slate-900 dark:text-slate-100">{row.supplierName}</TableCell>
                          <TableCell className="text-end font-mono">{formatCurrency(row.current, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-amber-600 dark:text-amber-400">{formatCurrency(row.days30, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-orange-600 dark:text-orange-400">{formatCurrency(row.days60, isAr)}</TableCell>
                          <TableCell className="text-end font-mono text-red-600 dark:text-red-400 font-semibold">{formatCurrency(row.days90, isAr)}</TableCell>
                          <TableCell className="text-end font-mono font-bold">{formatCurrency(row.total, isAr)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">{t("لا توجد التزامات معلقة للموردين حالياً", "No outstanding supplier payables")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. Budget vs Actual Tab */}
        <TabsContent value="budget-vs-actual">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                {t("الموازنة مقابل التكلفة الفعلية للمشاريع", "Project Budget vs Actual Cost")}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {t("مقارنة موازنة المشروع المخططة مع المصروفات والتكاليف الفعلية ومطابقتها مع حجم الفواتير المصدرة", "Compare project budgets with actual cash spent and invoiced progress amounts")}
              </p>
            </CardHeader>
            <CardContent className="p-6">
              {isLoadingBvA ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : budgetVsActual.length > 0 ? (
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800/30">
                      <TableRow>
                        <TableHead className="font-semibold">{t("المشروع", "Project")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("موازنة المشروع", "Budget")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("المفوتر (Revenue)", "Invoiced (Revenue)")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("التكاليف الفعلية (Actual Cost)", "Actual Cost")}</TableHead>
                        <TableHead className="text-end font-semibold">{t("الفرق (Variance)", "Variance")}</TableHead>
                        <TableHead className="text-center font-semibold">{t("نسبة الاستهلاك", "Utilization")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgetVsActual.map((row: any) => {
                        const isOver = row.utilization > 100;
                        const isNear = row.utilization > 90 && row.utilization <= 100;
                        return (
                          <TableRow key={row.projectId}>
                            <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                              {isAr ? row.projectName : row.projectNameEn}
                            </TableCell>
                            <TableCell className="text-end font-mono">{formatCurrency(row.budget, isAr)}</TableCell>
                            <TableCell className="text-end font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                              {formatCurrency(row.invoiced, isAr)}
                            </TableCell>
                            <TableCell className="text-end font-mono text-slate-700 dark:text-slate-300 font-medium">
                              {formatCurrency(row.actualCost, isAr)}
                            </TableCell>
                            <TableCell className={cn("text-end font-mono font-semibold", row.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                              {formatCurrency(row.variance, isAr)}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1 min-w-[120px]">
                                <span className={cn("text-xs font-mono font-bold", isOver ? "text-red-600 dark:text-red-400" : isNear ? "text-amber-600" : "text-emerald-600")}>
                                  {row.utilization.toFixed(1)}%
                                </span>
                                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div className={cn("h-full rounded-full", isOver ? "bg-red-500" : isNear ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(row.utilization, 100)}%` }} />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">{t("لم يتم العثور على مشاريع ذات موازنات مخصصة", "No budgeted projects found")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. Statements Tab */}
        <TabsContent value="statement">
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                {t("كشف حساب العميل والمورد التفاعلي", "Interactive Client & Supplier Statement")}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {t("عرض كشوف الحسابات التفصيلية للعملاء أو الموردين مع الرصيد التراكمي وتاريخ الفواتير والمدفوعات", "View granular historical ledger statements for clients or suppliers with running balance")}
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Statement Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("نوع الحساب", "Account Type")}</Label>
                  <Select value={statementTargetType} onValueChange={(val: any) => { setStatementTargetType(val); setStatementTargetId(""); }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("اختر النوع", "Select Type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">{t("كشف حساب عميل", "Customer Statement")}</SelectItem>
                      <SelectItem value="supplier">{t("كشف حساب مورد", "Supplier Statement")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {statementTargetType === "client" ? t("العميل", "Customer") : t("المورد", "Supplier")}
                  </Label>
                  <Select value={statementTargetId} onValueChange={setStatementTargetId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={statementTargetType === "client" ? t("اختر العميل", "Select Customer") : t("اختر المورد", "Select Supplier")} />
                    </SelectTrigger>
                    <SelectContent>
                      {statementTargetType === "client" ? (
                        clientsList.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))
                      ) : (
                        suppliersList.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("من تاريخ", "Start Date")}</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("إلى تاريخ", "End Date")}</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
                </div>
              </div>

              {isLoadingStatement ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : statementData ? (
                <div className="space-y-4">
                  {/* Ending Balance Summary */}
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {statementTargetType === "client" ? t("رصيد العميل الختامي", "Ending Customer Balance") : t("رصيد المورد الختامي", "Ending Supplier Balance")}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t("صافي الرصيد المستحق للتسوية المباشرة", "Outstanding balance payable/collectible")}</p>
                    </div>
                    <span className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(statementData.endingBalance, isAr)}
                    </span>
                  </div>

                  {/* Ledger History Table */}
                  {statementData.history?.length > 0 ? (
                    <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900/50">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50 dark:bg-slate-800/30">
                            <TableHead className="font-semibold">{t("التاريخ", "Date")}</TableHead>
                            <TableHead className="font-semibold">{t("المرجع", "Reference")}</TableHead>
                            <TableHead className="font-semibold">{t("الوصف", "Description")}</TableHead>
                            <TableHead className="text-end font-semibold">{t("مدين (+)", "Debit (+)")}</TableHead>
                            <TableHead className="text-end font-semibold">{t("دائن (-)", "Credit (-)")}</TableHead>
                            <TableHead className="text-end font-semibold font-bold">{t("الرصيد التراكمي", "Balance")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementData.history.map((tx: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{new Date(tx.date).toLocaleDateString(isAr ? "ar-AE" : "en-US")}</TableCell>
                              <TableCell className="font-semibold">{tx.reference}</TableCell>
                              <TableCell className="text-slate-500 dark:text-slate-400">{tx.description}</TableCell>
                              <TableCell className="text-end font-mono text-emerald-600 dark:text-emerald-400">{tx.debit > 0 ? `+${formatCurrency(tx.debit, isAr)}` : "-"}</TableCell>
                              <TableCell className="text-end font-mono text-rose-600 dark:text-rose-400">{tx.credit > 0 ? `-${formatCurrency(tx.credit, isAr)}` : "-"}</TableCell>
                              <TableCell className="text-end font-mono font-bold">{formatCurrency(tx.balance, isAr)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">{t("لا توجد حركات مسجلة للحساب في هذه الفترة", "No ledger entries for this period")}</div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">{t("يرجى اختيار العميل أو المورد لعرض كشف الحساب", "Please select a client or supplier to generate statement")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
