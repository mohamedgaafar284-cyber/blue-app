"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, FileText, Landmark } from "lucide-react";
import { useNavStore } from "@/store/nav-store";
import { useAuthStore } from "@/store/auth-store";
import { Permission } from "@/lib/auth/types";
import { hasPermission } from "@/lib/auth/modules/authorization";

interface FinancialSummaryData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  receivables: number;
  payables: number;
  liquidFunds: number;
  hasData: boolean;
}

interface FinancialHealthCardProps {
  language: "ar" | "en";
}

export function FinancialHealthCard({ language }: FinancialHealthCardProps) {
  const isAr = language === "ar";
  const { setCurrentPage } = useNavStore();
  const { user } = useAuthStore();

  // Check financial reports permission before rendering
  const canViewReports = user && (
    user.role === "ADMIN" ||
    user.role === "MANAGER" ||
    user.role === "ACCOUNTANT" ||
    hasPermission(user.role, Permission.REPORTS_READ)
  );

  const { data, isLoading } = useQuery<FinancialSummaryData>({
    queryKey: ["finance", "summary-snapshot"],
    queryFn: async () => {
      const res = await fetch("/api/finance/summary");
      if (!res.ok) {
        throw new Error("Failed to load finance summary");
      }
      const json = await res.json();
      return json.data || json;
    },
    enabled: !!canViewReports,
    staleTime: 60 * 1000,
  });

  if (!canViewReports) return null;

  const formatMoney = (val: number | undefined) => {
    const num = val || 0;
    return new Intl.NumberFormat(isAr ? "ar-AE" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const isProfitable = (data?.netProfit || 0) >= 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Landmark className="h-4 w-4" />
            </span>
            {isAr ? "ملخصك المالي المباشر (دفتر الأستاذ)" : "Live Financial Summary (General Ledger)"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? "مجمع تلقائياً من القيود المحاسبية والفواتير المسجلة دون أي حساب يدوي"
              : "Auto-synced from general ledger journal entries and invoices"}
          </p>
        </div>
        <button
          onClick={() => setCurrentPage("finance-reports")}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          {isAr ? "عرض القوائم المالية ←" : "Financial Statements →"}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Revenue */}
          <div
            onClick={() => setCurrentPage("invoices")}
            className="cursor-pointer p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{isAr ? "إجمالي الإيرادات" : "Total Revenue"}</span>
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {formatMoney(data?.totalRevenue)} <span className="text-xs font-normal text-slate-400">AED</span>
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-1 font-medium">
              <ArrowUpRight className="h-3 w-3" />
              {isAr ? "من الفواتير الصادرة" : "From posted invoices"}
            </div>
          </div>

          {/* Expenses */}
          <div
            onClick={() => setCurrentPage("payments")}
            className="cursor-pointer p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{isAr ? "إجمالي المصروفات" : "Total Expenses"}</span>
              <Wallet className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {formatMoney(data?.totalExpenses)} <span className="text-xs font-normal text-slate-400">AED</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {isAr ? "تشغيل ورواتب ومشتريات" : "Operations & materials"}
            </div>
          </div>

          {/* Accounts Receivable (Customers Dues) */}
          <div
            onClick={() => setCurrentPage("finance-reports")}
            className="cursor-pointer p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{isAr ? "الذمم المدينة (مستحق لنا)" : "Accounts Receivable"}</span>
              <FileText className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {formatMoney(data?.receivables)} <span className="text-xs font-normal text-slate-400">AED</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {isAr ? "فواتير لم تحصّل بعد" : "Uncollected invoices"}
            </div>
          </div>

          {/* Net Margin / Liquid Cash */}
          <div
            onClick={() => setCurrentPage("finance-reports")}
            className="cursor-pointer p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-all border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{isAr ? "صافي الربح التقديري" : "Estimated Net Profit"}</span>
              <Landmark className="h-3.5 w-3.5 text-sky-600" />
            </div>
            <div className={`text-lg font-bold ${isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {formatMoney(data?.netProfit)} <span className="text-xs font-normal text-slate-400">AED</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5 mt-1 font-medium">
              {isProfitable ? <ArrowUpRight className="h-3 w-3 text-emerald-600" /> : <ArrowDownRight className="h-3 w-3 text-rose-600" />}
              {isAr ? (isProfitable ? "فائض تشغيلي إيجابي" : "عجز تشغيلي") : (isProfitable ? "Positive margin" : "Negative margin")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
