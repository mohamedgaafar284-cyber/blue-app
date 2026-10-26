"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Percent,
  FileDown,
  Save,
  Plus,
  Trash2,
  Landmark,
  FileText,
  Building2,
  RotateCcw,
} from "lucide-react";
import { getMutationHeaders } from "@/lib/csrf-client";
import { extractErrorMessage } from "@/lib/api/fetch-client";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { DEFAULT_RATIO_ITEMS } from "@/lib/ratio-sheet-defaults";

// ===== Types =====
interface RatioItemRow {
  key: string;
  id?: string;
  itemName: string;
  itemNameEn: string;
  officialPct: number;
  executedPct: number;
  notes: string;
}

interface RatioSheetData {
  sheet: {
    id: string;
    programName: string;
    fileNumber: string;
    bankName: string;
    contractValue: number;
    maintenancePct: number;
    notes: string;
  };
  project: {
    number: string;
    name: string;
    nameEn: string;
    clientName: string;
    contractorName: string;
  };
  items: Array<{
    id: string;
    order: number;
    itemName: string;
    itemNameEn: string;
    officialPct: number;
    executedPct: number;
    notes: string;
  }>;
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

let localKey = 0;
const nextKey = () => `row-${++localKey}-${Date.now()}`;

// ===== Main Component =====
interface RatiosTabProps {
  projectId: string | undefined;
  language: "ar" | "en";
}

export default function RatiosTab({ projectId, language }: RatiosTabProps) {
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const queryClient = useQueryClient();
  const toast = useToastFeedback({ ar: isAr });

  const { data, isLoading } = useQuery<RatioSheetData>({
    queryKey: ["ratio-sheet", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/ratio-sheet`);
      if (!res.ok) throw new Error("Failed to fetch ratio sheet");
      return res.json();
    },
    enabled: !!projectId,
  });

  // ---- Local editable state ----
  const [programName, setProgramName] = useState("");
  const [fileNumber, setFileNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [maintenancePct, setMaintenancePct] = useState("10");
  const [rows, setRows] = useState<RatioItemRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    setProgramName(data.sheet.programName || "");
    setFileNumber(data.sheet.fileNumber || "");
    setBankName(data.sheet.bankName || "");
    setContractValue(String(data.sheet.contractValue || ""));
    setMaintenancePct(String(data.sheet.maintenancePct ?? 10));
    setRows(
      data.items.map((it) => ({
        key: nextKey(),
        id: it.id,
        itemName: it.itemName,
        itemNameEn: it.itemNameEn,
        officialPct: it.officialPct,
        executedPct: it.executedPct,
        notes: it.notes,
      }))
    );
    setDirty(false);
  }, [data]);

  const baseValue = Number(contractValue) || 0;
  const maintPct = Number(maintenancePct) || 0;

  const totals = useMemo(() => {
    const officialValue = rows.reduce((s, r) => s + (baseValue * r.officialPct) / 100, 0);
    const executedValue = rows.reduce((s, r) => s + (baseValue * r.executedPct) / 100, 0);
    const maintenance = (executedValue * maintPct) / 100;
    const officialPctSum = rows.reduce((s, r) => s + r.officialPct, 0);
    return { officialPctSum, officialValue, executedValue, maintenance, netDue: executedValue - maintenance };
  }, [rows, baseValue, maintPct]);

  const buildPayload = () => ({
    programName,
    fileNumber,
    bankName,
    contractValue: baseValue,
    maintenancePct: maintPct,
    notes: data?.sheet.notes || "",
    items: rows.map((r, idx) => ({
      id: r.id,
      order: idx + 1,
      itemName: r.itemName,
      itemNameEn: r.itemNameEn,
      officialPct: r.officialPct,
      executedPct: r.executedPct,
      notes: r.notes,
    })),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/ratio-sheet`, {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err.error, "Failed to save ratio sheet"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratio-sheet", projectId] });
      setDirty(false);
      toast.showSuccess(
        t("تم الحفظ", "Saved"),
        t("جدول النسب الرسمية اتحدث", "Official ratios sheet updated")
      );
    },
    onError: (e: Error) => toast.showError(t(`فشل الحفظ: ${e.message}`, `Failed to save: ${e.message}`)),
  });

  const handleDownloadPdf = async () => {
    // Save first if there are unsaved edits, so the PDF always reflects what's on screen
    if (dirty) {
      try {
        const res = await fetch(`/api/projects/${projectId}/ratio-sheet`, {
          method: "PUT",
          headers: getMutationHeaders(),
          body: JSON.stringify(buildPayload()),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(extractErrorMessage(err.error, "Save failed"));
        }
        queryClient.invalidateQueries({ queryKey: ["ratio-sheet", projectId] });
        setDirty(false);
      } catch (e) {
        toast.showError(t(`احفظ الأول: ${(e as Error).message}`, `Save first: ${(e as Error).message}`));
        return;
      }
    }
    window.open(`/api/projects/${projectId}/ratio-sheet/pdf?lang=${language}`, "_blank");
  };

  const updateRow = (key: string, patch: Partial<RatioItemRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { key: nextKey(), itemName: "", itemNameEn: "", officialPct: 0, executedPct: 0, notes: "" },
    ]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setDirty(true);
  };

  const resetDefaults = () => {
    setRows(
      DEFAULT_RATIO_ITEMS.map((item) => ({
        key: nextKey(),
        itemName: item.itemName,
        itemNameEn: item.itemNameEn,
        officialPct: item.officialPct,
        executedPct: 0,
        notes: "",
      }))
    );
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== Sheet settings ===== */}
      <Card className="border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-navy-600 to-cyan-600 p-4 text-white">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Percent className="h-4 w-4" />
                {t("جدول النسب الرسمية", "Official Ratios Sheet")}
              </h3>
              <p className="text-[11px] text-white/70 mt-0.5">
                {t("النسب المعتمدة لبنود الشغل — أساس مطالبات التقدم مع جهة التمويل", "Approved work-item percentages — the base for progress claims")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={handleDownloadPdf}
              >
                <FileDown className="h-3.5 w-3.5" />
                {t("تحميل PDF", "Download PDF")}
              </Button>
              <Button
                size="sm"
                className={`h-7 gap-1 text-xs ${dirty ? "bg-amber-500 hover:bg-amber-600" : "bg-white/20 hover:bg-white/30"} text-white`}
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-3.5 w-3.5" />
                {dirty ? t("احفظ التعديلات", "Save changes") : t("محفوظ", "Saved")}
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500">{t("برنامج / جهة التمويل", "Program / Funder")}</Label>
              <div className="relative">
                <FileText className="h-3.5 w-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input className="ps-8 h-8 text-xs" value={programName} onChange={(e) => { setProgramName(e.target.value); setDirty(true); }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500">{t("رقم الملف", "File No.")}</Label>
              <Input className="h-8 text-xs font-mono" value={fileNumber} onChange={(e) => { setFileNumber(e.target.value); setDirty(true); }} placeholder="0000/00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500">{t("البنك الممول", "Financing Bank")}</Label>
              <div className="relative">
                <Landmark className="h-3.5 w-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input className="ps-8 h-8 text-xs" value={bankName} onChange={(e) => { setBankName(e.target.value); setDirty(true); }} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500">{t("قيمة العقد (AED)", "Contract Value (AED)")}</Label>
              <Input className="h-8 text-xs font-mono tabular-nums" type="number" min="0" value={contractValue} onChange={(e) => { setContractValue(e.target.value); setDirty(true); }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500">{t("استقطاع الصيانة (%)", "Maintenance Deduction (%)")}</Label>
              <Input className="h-8 text-xs font-mono tabular-nums" type="number" min="0" max="100" value={maintenancePct} onChange={(e) => { setMaintenancePct(e.target.value); setDirty(true); }} />
            </div>
          </div>

          {/* Project context */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{t("المالك", "Owner")}: <b className="text-slate-600 dark:text-slate-300">{data?.project.clientName || "—"}</b></span>
            <span>{t("المشروع", "Project")}: <b className="text-slate-600 dark:text-slate-300">#{data?.project.number} {isAr ? data?.project.name : data?.project.nameEn || data?.project.name}</b></span>
            <span>{t("المقاول", "Contractor")}: <b className="text-slate-600 dark:text-slate-300">{data?.project.contractorName || "—"}</b></span>
          </div>
        </CardContent>
      </Card>

      {/* ===== Summary cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("إجمالي النسب الرسمية", "Total Official %")}</p>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fmtPct(totals.officialPctSum)}%</p>
            {totals.officialPctSum !== 100 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">{t("المفروض تكون 100%", "Should be 100%")}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("قيمة المنفذ", "Executed Value")}</p>
            <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{formatMoney(totals.executedValue)} <span className="text-[10px] font-normal text-slate-400">AED</span></p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t(`استقطاع الصيانة (${fmtPct(maintPct)}%)`, `Maintenance (${fmtPct(maintPct)}%)`)}</p>
            <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">- {formatMoney(totals.maintenance)} <span className="text-[10px] font-normal text-slate-400">AED</span></p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10">
          <CardContent className="p-3.5">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{t("الصافي المستحق", "Net Due")}</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(totals.netDue)} <span className="text-[10px] font-normal">AED</span></p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Items table ===== */}
      <Card className="border-slate-200 dark:border-slate-700/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Percent className="h-4 w-4 text-brand-navy-500" />
              {t("بنود الشغل والنسب", "Work Items & Percentages")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={resetDefaults}>
                <RotateCcw className="h-3 w-3" />
                {t("رجوع للنسب الافتراضية", "Reset defaults")}
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={addRow}>
                <Plus className="h-3 w-3" />
                {t("بند جديد", "Add item")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700">
                  <TableHead className="h-8 text-xs w-8">#</TableHead>
                  <TableHead className="h-8 text-xs min-w-44">{t("البند", "Work Item")}</TableHead>
                  <TableHead className="h-8 text-xs w-20">{t("النسبة الرسمية %", "Official %")}</TableHead>
                  <TableHead className="h-8 text-xs w-20">{t("نسبة التنفيذ %", "Executed %")}</TableHead>
                  <TableHead className="h-8 text-xs w-24">{t("قيمة النسبة", "Official Value")}</TableHead>
                  <TableHead className="h-8 text-xs w-24">{t("قيمة المنفذ", "Executed Value")}</TableHead>
                  <TableHead className="h-8 text-xs min-w-28">{t("ملاحظات", "Notes")}</TableHead>
                  <TableHead className="h-8 text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={row.key} className="border-slate-50 dark:border-slate-800/50">
                    <TableCell className="py-1.5 text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="py-1.5">
                      <Input className="h-7 text-xs" value={row.itemName} onChange={(e) => updateRow(row.key, { itemName: e.target.value })} placeholder={t("اسم البند", "Item name")} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input className="h-7 text-xs font-mono tabular-nums" type="number" min="0" max="100" step="0.5" value={row.officialPct} onChange={(e) => updateRow(row.key, { officialPct: Number(e.target.value) || 0 })} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input className="h-7 text-xs font-mono tabular-nums" type="number" min="0" max="100" step="0.5" value={row.executedPct} onChange={(e) => updateRow(row.key, { executedPct: Number(e.target.value) || 0 })} />
                    </TableCell>
                    <TableCell className="py-1.5 text-xs font-mono tabular-nums text-slate-500">{formatMoney((baseValue * row.officialPct) / 100)}</TableCell>
                    <TableCell className="py-1.5 text-xs font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300">{formatMoney((baseValue * row.executedPct) / 100)}</TableCell>
                    <TableCell className="py-1.5">
                      <Input className="h-7 text-xs" value={row.notes} onChange={(e) => updateRow(row.key, { notes: e.target.value })} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(row.key)}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-xs text-slate-400">
                      {t("مفيش بنود — اضغط «رجوع للنسب الافتراضية» أو «بند جديد»", "No items — click 'Reset defaults' or 'Add item'")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
