"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Coins,
  HandCoins,
  Landmark,
  Percent,
  Plus,
  Wallet,
  Trash2,
  Unlock,
  Pencil,
} from "lucide-react";
import { getMutationHeaders } from "@/lib/csrf-client";
import { extractErrorMessage } from "@/lib/api/fetch-client";
import { useToastFeedback } from "@/hooks/use-toast-feedback";

// ===== Types =====
interface FeeItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  notes: string;
  createdAt: string;
}

interface CollectionItem {
  id: string;
  voucherNumber: string;
  feeId: string | null;
  feeTitle: string;
  grossAmount: number;
  retentionRate: number;
  retentionAmount: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  method: string;
  referenceNumber: string;
  status: string;
  notes: string;
  retentionReleasedAt: string | null;
  createdAt: string;
}

interface FeesData {
  fees: FeeItem[];
  collections: CollectionItem[];
  summary: {
    totalFees: number;
    grossCollected: number;
    netCollected: number;
    taxWithheld: number;
    retentionHeld: number;
    retentionReleased: number;
    remaining: number;
  };
  defaults: { retentionRate: number; taxRate: number };
}

const FEE_CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  DESIGN: { ar: "أتعاب تصميم", en: "Design Fees" },
  SUPERVISION: { ar: "أتعاب إشراف", en: "Supervision Fees" },
  EXPENSES: { ar: "مصروفات", en: "Expenses" },
  CONTRACTOR_SHARE: { ar: "نسبة المقاول", en: "Contractor Share" },
  OTHER: { ar: "أخرى", en: "Other" },
};

const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  cheque: { ar: "شيك", en: "Cheque" },
  transfer: { ar: "تحويل بنكي", en: "Transfer" },
  online: { ar: "أونلاين", en: "Online" },
};

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-AE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ===== Main Component =====
interface FeesTabProps {
  projectId: string | undefined;
  language: "ar" | "en";
}

export default function FeesTab({ projectId, language }: FeesTabProps) {
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const queryClient = useQueryClient();
  const toast = useToastFeedback({ ar: isAr });

  const { data, isLoading } = useQuery<FeesData>({
    queryKey: ["project-fees", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/fees`);
      if (!res.ok) throw new Error("Failed to fetch fees");
      return res.json();
    },
    enabled: !!projectId,
  });

  // ---- Add fee dialog state ----
  const [showAddFee, setShowAddFee] = useState(false);
  const [feeTitle, setFeeTitle] = useState("");
  const [feeCategory, setFeeCategory] = useState("DESIGN");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeNotes, setFeeNotes] = useState("");

  // ---- Edit fee dialog state ----
  const [editingFee, setEditingFee] = useState<FeeItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // ---- Add collection dialog state ----
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [colFeeId, setColFeeId] = useState("none");
  const [colGross, setColGross] = useState("");
  const [colRetention, setColRetention] = useState("10");
  const [colTax, setColTax] = useState("5");
  const [colMethod, setColMethod] = useState("transfer");
  const [colReference, setColReference] = useState("");
  const [colNotes, setColNotes] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["project-fees", projectId] });

  const createFeeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/fees`, {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({ title: feeTitle, category: feeCategory, amount: Number(feeAmount), notes: feeNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to create fee"));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setShowAddFee(false);
      setFeeTitle(""); setFeeAmount(""); setFeeNotes("");
      toast.created(t("الأتعاب", "Fee"));
    },
    onError: (e: Error) => toast.showError(t(`فشل إضافة الأتعاب: ${e.message}`, `Failed to add fee: ${e.message}`)),
  });

  const updateFeeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/fees/${editingFee?.id}`, {
        method: "PATCH",
        headers: getMutationHeaders(),
        body: JSON.stringify({ title: editTitle, amount: Number(editAmount), notes: editNotes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to update fee"));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditingFee(null);
      toast.updated(t("الأتعاب", "Fee"));
    },
    onError: (e: Error) => toast.showError(t(`فشل تعديل الأتعاب: ${e.message}`, `Failed to update fee: ${e.message}`)),
  });

  const deleteFeeMutation = useMutation({
    mutationFn: async (feeId: string) => {
      const res = await fetch(`/api/projects/${projectId}/fees/${feeId}`, {
        method: "DELETE",
        headers: getMutationHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete fee");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.deleted(t("الأتعاب", "Fee"));
    },
    onError: () => toast.showError(t("فشل حذف الأتعاب", "Failed to delete fee")),
  });

  const createCollectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/collections`, {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({
          feeId: colFeeId === "none" ? null : colFeeId,
          grossAmount: Number(colGross),
          retentionRate: Number(colRetention),
          taxRate: Number(colTax),
          method: colMethod,
          referenceNumber: colReference,
          notes: colNotes,
          status: "RECEIVED",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to record collection"));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setShowAddCollection(false);
      setColGross(""); setColReference(""); setColNotes("");
      toast.created(t("سند التحصيل", "Collection voucher"));
    },
    onError: (e: Error) => toast.showError(t(`فشل تسجيل التحصيل: ${e.message}`, `Failed to record collection: ${e.message}`)),
  });

  const releaseRetentionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const res = await fetch(`/api/projects/${projectId}/collections/${collectionId}`, {
        method: "PATCH",
        headers: getMutationHeaders(),
        body: JSON.stringify({ action: "releaseRetention" }),
      });
      if (!res.ok) throw new Error("Failed to release retention");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.showSuccess(
        t("تم صرف المحتجز", "Retention released"),
        t("سُجّل صرف المبلغ المحتجز من البنك", "The bank-held retention was recorded as released")
      );
    },
    onError: () => toast.showError(t("فشل صرف المحتجز", "Failed to release retention")),
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const res = await fetch(`/api/projects/${projectId}/collections/${collectionId}`, {
        method: "DELETE",
        headers: getMutationHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete collection");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.deleted(t("سند التحصيل", "Collection voucher"));
    },
    onError: () => toast.showError(t("فشل حذف السند", "Failed to delete voucher")),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const summary = data?.summary;
  const grossCol = Number(colGross) || 0;
  const previewRetention = Math.round(grossCol * (Number(colRetention) || 0)) / 100;
  const previewTax = Math.round(grossCol * (Number(colTax) || 0)) / 100;
  const previewNet = grossCol - previewRetention - previewTax;

  return (
    <div className="space-y-4">
      {/* ===== KPI Cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center shrink-0">
                <Coins className="h-4.5 w-4.5 text-brand-navy-600 dark:text-brand-navy-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t("إجمالي الأتعاب", "Total Fees")}</p>
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(summary?.totalFees || 0)} <span className="text-[10px] font-normal text-slate-400">AED</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <HandCoins className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t("إجمالي المحصل", "Gross Collected")}</p>
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(summary?.grossCollected || 0)} <span className="text-[10px] font-normal text-slate-400">AED</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                <Wallet className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t("الصافي اللي وصل", "Net Received")}</p>
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(summary?.netCollected || 0)} <span className="text-[10px] font-normal text-slate-400">AED</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Landmark className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t("احتجاز بنكي (محتجز)", "Bank Retention (Held)")}</p>
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(summary?.retentionHeld || 0)} <span className="text-[10px] font-normal text-slate-400">AED</span></p>
                {(summary?.retentionReleased || 0) > 0 && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{t("المصروف:", "Released:")} {formatMoney(summary?.retentionReleased || 0)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <Percent className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t("ضريبة محتجزة", "Tax Withheld")}</p>
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(summary?.taxWithheld || 0)} <span className="text-[10px] font-normal text-slate-400">AED</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Fees per agreement ===== */}
      <Card className="border-slate-200 dark:border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-brand-navy-500" />
              {t("الأتعاب حسب الاتفاق", "Fees per Agreement")}
            </CardTitle>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs bg-brand-navy-600 hover:bg-brand-navy-700 text-white"
              onClick={() => setShowAddFee(true)}
            >
              <Plus className="h-3 w-3" />
              {t("إضافة أتعاب", "Add Fee")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700">
                  <TableHead className="h-8 text-xs">{t("الأتعاب", "Fee")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("التصنيف", "Category")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("المبلغ المتفق عليه", "Agreed Amount")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("ملاحظات", "Notes")}</TableHead>
                  <TableHead className="h-8 text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.fees || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      {t("لسه مفيش أتعاب مسجلة — ضيف أتعاب التصميم والإشراف حسب الاتفاق مع العميل", "No fees yet — add design & supervision fees per your client agreement")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.fees.map((fee) => (
                    <TableRow key={fee.id} className="border-slate-50 dark:border-slate-800/50">
                      <TableCell className="py-2 text-xs font-medium text-slate-800 dark:text-slate-200">{fee.title}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800">
                          {t(FEE_CATEGORY_LABELS[fee.category]?.ar || fee.category, FEE_CATEGORY_LABELS[fee.category]?.en || fee.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(fee.amount)} AED</TableCell>
                      <TableCell className="py-2 text-xs text-slate-400 max-w-48 truncate">{fee.notes || "—"}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            setEditingFee(fee);
                            setEditTitle(fee.title);
                            setEditAmount(String(fee.amount));
                            setEditNotes(fee.notes);
                          }}>
                            <Pencil className="h-3 w-3 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            if (confirm(t("متأكد من حذف الأتعاب؟", "Delete this fee?"))) deleteFeeMutation.mutate(fee.id);
                          }}>
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Collections ===== */}
      <Card className="border-slate-200 dark:border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-brand-navy-500" />
              {t("التحصيلات", "Collections")}
            </CardTitle>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (data?.defaults) {
                  setColRetention(String(data.defaults.retentionRate));
                  setColTax(String(data.defaults.taxRate));
                }
                setShowAddCollection(true);
              }}
            >
              <Plus className="h-3 w-3" />
              {t("تسجيل تحصيل", "Record Collection")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700">
                  <TableHead className="h-8 text-xs">{t("السند", "Voucher")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("الأتعاب", "Fee")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("المبلغ", "Gross")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("احتجاز بنكي", "Retention")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("ضريبة", "Tax")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("الصافي", "Net")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("التاريخ", "Date")}</TableHead>
                  <TableHead className="h-8 text-xs">{t("المحتجز", "Held")}</TableHead>
                  <TableHead className="h-8 text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.collections || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-xs text-slate-400">
                      {t("لسه مفيش تحصيلات — سجل أول قبض من البنك أو العميل", "No collections yet — record your first receipt from the bank or client")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.collections.map((c) => (
                    <TableRow key={c.id} className="border-slate-50 dark:border-slate-800/50">
                      <TableCell className="py-2">
                        <div className="text-xs font-mono font-medium text-brand-navy-600 dark:text-brand-navy-400">{c.voucherNumber}</div>
                        <div className="text-[10px] text-slate-400">{t(METHOD_LABELS[c.method]?.ar || c.method, METHOD_LABELS[c.method]?.en || c.method)}{c.referenceNumber ? ` · ${c.referenceNumber}` : ""}</div>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-slate-600 dark:text-slate-300 max-w-32 truncate">{c.feeTitle || "—"}</TableCell>
                      <TableCell className="py-2 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">{formatMoney(c.grossAmount)}</TableCell>
                      <TableCell className="py-2 text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        {formatMoney(c.retentionAmount)}
                        <span className="text-[10px] text-slate-400"> ({c.retentionRate}%)</span>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono tabular-nums text-red-500 dark:text-red-400">
                        {formatMoney(c.taxAmount)}
                        <span className="text-[10px] text-slate-400"> ({c.taxRate}%)</span>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(c.netAmount)}</TableCell>
                      <TableCell className="py-2 text-xs text-slate-400">{fmtDate(c.createdAt)}</TableCell>
                      <TableCell className="py-2">
                        {c.retentionReleasedAt ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                            {t("مصروف", "Released")}
                          </Badge>
                        ) : c.retentionAmount > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] gap-1 border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            onClick={() => releaseRetentionMutation.mutate(c.id)}
                          >
                            <Unlock className="h-3 w-3" />
                            {t("صرف", "Release")}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                          if (confirm(t("متأكد من حذف السند؟", "Delete this voucher?"))) deleteCollectionMutation.mutate(c.id);
                        }}>
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Add Fee Dialog ===== */}
      <Dialog open={showAddFee} onOpenChange={setShowAddFee}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("إضافة أتعاب جديدة", "Add New Fee")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="feeTitle">{t("اسم الأتعاب", "Fee Title")}</Label>
              <Input id="feeTitle" value={feeTitle} onChange={(e) => setFeeTitle(e.target.value)} placeholder={t("مثال: أتعاب تصميم فيلا", "e.g. Villa Design Fee")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("التصنيف", "Category")}</Label>
              <Select value={feeCategory} onValueChange={setFeeCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FEE_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{t(label.ar, label.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feeAmount">{t("المبلغ المتفق عليه (AED)", "Agreed Amount (AED)")}</Label>
              <Input id="feeAmount" type="number" min="0" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feeNotes">{t("ملاحظات (حسب الاتفاق)", "Notes (per agreement)")}</Label>
              <Textarea id="feeNotes" value={feeNotes} onChange={(e) => setFeeNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddFee(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button
              className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white"
              size="sm"
              disabled={!feeTitle || !feeAmount || createFeeMutation.isPending}
              onClick={() => createFeeMutation.mutate()}
            >
              {t("إضافة", "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit Fee Dialog ===== */}
      <Dialog open={!!editingFee} onOpenChange={(open) => !open && setEditingFee(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("تعديل الأتعاب", "Edit Fee")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editTitle">{t("اسم الأتعاب", "Fee Title")}</Label>
              <Input id="editTitle" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editAmount">{t("المبلغ (AED)", "Amount (AED)")}</Label>
              <Input id="editAmount" type="number" min="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editNotes">{t("ملاحظات", "Notes")}</Label>
              <Textarea id="editNotes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingFee(null)}>{t("إلغاء", "Cancel")}</Button>
            <Button
              className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white"
              size="sm"
              disabled={!editTitle || !editAmount || updateFeeMutation.isPending}
              onClick={() => updateFeeMutation.mutate()}
            >
              {t("حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Add Collection Dialog ===== */}
      <Dialog open={showAddCollection} onOpenChange={setShowAddCollection}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("تسجيل تحصيل جديد", "Record New Collection")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("ضد أتعاب (اختياري)", "Against Fee (optional)")}</Label>
              <Select value={colFeeId} onValueChange={setColFeeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("بدون ربط", "No link")}</SelectItem>
                  {(data?.fees || []).map((fee) => (
                    <SelectItem key={fee.id} value={fee.id}>{fee.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="colGross">{t("المبلغ الإجمالي (AED)", "Gross Amount (AED)")}</Label>
              <Input id="colGross" type="number" min="0" value={colGross} onChange={(e) => setColGross(e.target.value)} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="colRetention">{t("نسبة الاحتجاز (%)", "Retention %")}</Label>
                <Input id="colRetention" type="number" min="0" max="100" value={colRetention} onChange={(e) => setColRetention(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="colTax">{t("نسبة الضريبة (%)", "Tax %")}</Label>
                <Input id="colTax" type="number" min="0" max="100" value={colTax} onChange={(e) => setColTax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("طريقة الاستلام", "Payment Method")}</Label>
              <Select value={colMethod} onValueChange={setColMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{t(label.ar, label.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="colReference">{t("رقم المرجع / الشيك", "Reference / Cheque No.")}</Label>
              <Input id="colReference" value={colReference} onChange={(e) => setColReference(e.target.value)} />
            </div>

            {/* Live net preview */}
            {grossCol > 0 && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{t("الاحتجاز البنكي", "Bank retention")}</span>
                  <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">- {formatMoney(previewRetention)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{t("الضريبة", "Tax")}</span>
                  <span className="font-mono tabular-nums text-red-500 dark:text-red-400">- {formatMoney(previewTax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-emerald-200 dark:border-emerald-800/40 pt-1.5">
                  <span className="text-slate-700 dark:text-slate-200">{t("الصافي اللي هيوصلك", "Net you'll receive")}</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatMoney(previewNet)} AED</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="colNotes">{t("ملاحظات", "Notes")}</Label>
              <Textarea id="colNotes" value={colNotes} onChange={(e) => setColNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddCollection(false)}>{t("إلغاء", "Cancel")}</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
              disabled={!colGross || createCollectionMutation.isPending}
              onClick={() => createCollectionMutation.mutate()}
            >
              {t("تسجيل", "Record")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
