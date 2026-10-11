"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle, 
  Wallet, 
  Building2,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuickEntryModalProps {
  language: "ar" | "en";
  trigger?: React.ReactNode;
}

export function QuickEntryModal({ language, trigger }: QuickEntryModalProps) {
  const isAr = language === "ar";
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("general");
  const [method, setMethod] = useState<"cash" | "bank">("bank");
  const [description, setDescription] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFeedback({
        type: "error",
        message: isAr ? "يرجى إدخال مبلغ صحيح أكبر من الصفر" : "Please enter a valid amount greater than zero",
      });
      return;
    }

    setLoading(true);

    try {
      if (type === "expense") {
        // Post operational payment/expense directly through our hardened route
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parsedAmount,
            payMethod: method,
            beneficiary: beneficiary || (isAr ? "مصروف عام" : "General expense"),
            description: description || `${isAr ? "مصروف فئة" : "Expense"}: ${category}`,
            category,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to record expense");
        }
      } else {
        // Income / revenue entry via journal entry
        const res = await fetch("/api/finance/journal-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description || (isAr ? "إيراد مباشر" : "Direct income"),
            reference: `INC-${Date.now().toString().slice(-6)}`,
            lines: [
              // Debit: Cash/Bank
              {
                accountId: method === "cash" ? "1010" : "1020",
                debit: parsedAmount,
                credit: 0,
              },
              // Credit: Service Revenue
              {
                accountId: "4010",
                debit: 0,
                credit: parsedAmount,
              },
            ],
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to record income");
        }
      }

      setFeedback({
        type: "success",
        message: isAr ? "تم تسجيل الحركة وترحيل قيدها بنجاح!" : "Entry recorded and ledger updated successfully!",
      });

      // Invalidate dashboard and financial caches
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });

      // Reset form
      setAmount("");
      setDescription("");
      setBeneficiary("");

      setTimeout(() => {
        setOpen(false);
        setFeedback(null);
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm">
            <PlusCircle className="h-4 w-4" />
            {isAr ? "سجّل حركة سريعة" : "Quick Money Entry"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            {isAr ? "تسجيل حركة مالية سريعة" : "Quick Financial Entry"}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr 
              ? "سجّل ما صرفته أو استلمته في ثوانٍ، والتطبيق يكتب القيد المحاسبي في الخلفية أوتوماتيك." 
              : "Record receipts or expenses in seconds. Double-entry ledger is updated automatically."}
          </p>
        </DialogHeader>

        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Question 1: Inflow or Outflow? */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? "1. هل صرفت أم استلمت فلوس؟" : "1. Money direction"}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === "expense"
                    ? "bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <ArrowDownRight className="h-4 w-4 text-rose-600" />
                {isAr ? "صرفت (مصروف / مشتريات)" : "Spent (Expense)"}
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  type === "income"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                {isAr ? "قبضت (إيراد / دفعة)" : "Received (Income)"}
              </button>
            </div>
          </div>

          {/* Question 2: Amount & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isAr ? "2. المبلغ *" : "2. Amount *"}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-xl font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isAr ? "الفئة" : "Category"}
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">{isAr ? "عمومي وإداري" : "General & Admin"}</SelectItem>
                  <SelectItem value="travel">{isAr ? "انتقالات وبنزين" : "Travel & Fuel"}</SelectItem>
                  <SelectItem value="materials">{isAr ? "مواد وتجهيزات موقع" : "Materials & Site"}</SelectItem>
                  <SelectItem value="utilities">{isAr ? "فواتير كهرباء وإنترنت" : "Utilities & Internet"}</SelectItem>
                  <SelectItem value="rent">{isAr ? "إيجار مقرات" : "Office Rent"}</SelectItem>
                  <SelectItem value="salaries">{isAr ? "سلف ورواتب" : "Salaries & Advances"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Question 3: Payment source */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? "3. من الخزينة أم الحساب البنكي؟" : "3. Source Account"}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("cash")}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  method === "cash"
                    ? "bg-slate-100 border-slate-900 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : "border-slate-200 dark:border-slate-800 text-slate-500"
                }`}
              >
                <Wallet className="h-3.5 w-3.5 text-amber-600" />
                {isAr ? "نقدية / عهدة الخزينة (1010)" : "Cash on Hand (1010)"}
              </button>
              <button
                type="button"
                onClick={() => setMethod("bank")}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  method === "bank"
                    ? "bg-slate-100 border-slate-900 text-slate-900 dark:bg-slate-800 dark:text-white"
                    : "border-slate-200 dark:border-slate-800 text-slate-500"
                }`}
              >
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                {isAr ? "حساب بنكي / تحويل (1020)" : "Bank Account (1020)"}
              </button>
            </div>
          </div>

          {/* Notes / Beneficiary */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? "بيان الحركة / المستفيد (اختياري)" : "Description / Beneficiary"}
            </Label>
            <Input
              type="text"
              placeholder={isAr ? "مثال: شراء كابلات لموقع فيلا 102" : "e.g. Cables for Villa 102"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl text-xs"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl text-xs"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              {loading ? (isAr ? "جاري الحفظ والترحيل..." : "Saving...") : (isAr ? "حفظ وترحيل القيد ✓" : "Record Entry ✓")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
