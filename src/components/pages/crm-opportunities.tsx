"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Target, TrendingUp, DollarSign } from "lucide-react";
import { useLang } from "@/hooks/use-lang";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { formatCurrency } from "@/lib/formatters";
import { getMutationHeaders } from "@/lib/csrf-client";

interface Opportunity {
  id: string;
  title: string;
  stage: string;
  probability: number;
  estimatedValue: string | number;
  expectedCloseDate: string | null;
  description: string | null;
  lead: { id: string; name: string; company: string | null } | null;
}

const STAGES = [
  { key: "QUALIFICATION", labelAr: "تأهيل", labelEn: "Qualification", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { key: "NEEDS_ANALYSIS", labelAr: "تحليل الاحتياج", labelEn: "Needs Analysis", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
  { key: "PROPOSAL", labelAr: "عرض سعر", labelEn: "Proposal", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  { key: "NEGOTIATION", labelAr: "تفاوض", labelEn: "Negotiation", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400" },
  { key: "WON", labelAr: "فوز", labelEn: "Won", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  { key: "LOST", labelAr: "خسارة", labelEn: "Lost", color: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" },
];

export default function CrmOpportunitiesPage({ language: _language }: { language: "ar" | "en" }) {
  const lang = useLang();
  const ar = lang === "ar";
  const toast = useToastFeedback({ ar });
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    stage: "QUALIFICATION",
    probability: 10,
    estimatedValue: 0,
    expectedCloseDate: "",
    description: "",
  });

  const { data: opportunities, isLoading } = useQuery<Opportunity[]>({
    queryKey: ["crm-opportunities"],
    queryFn: async () => {
      const res = await fetch("/api/crm/opportunities");
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities"] });
      setShowAddDialog(false);
      toast.showSuccess(ar ? "تم إنشاء الفرصة" : "Opportunity created");
      setFormData({ title: "", stage: "QUALIFICATION", probability: 10, estimatedValue: 0, expectedCloseDate: "", description: "" });
    },
    onError: (error: Error) => {
      toast.showError(error.message);
    },
  });


  // Group opportunities by stage
  const byStage = STAGES.map((stage) => ({
    ...stage,
    items: opportunities?.filter((o) => o.stage === stage.key) || [],
  }));

  const totalValue = opportunities?.reduce((s, o) => s + Number(o.estimatedValue), 0) || 0;
  const wonValue = opportunities?.filter((o) => o.stage === "WON").reduce((s, o) => s + Number(o.estimatedValue), 0) || 0;
  const weightedValue = opportunities?.reduce((s, o) => s + (Number(o.estimatedValue) * o.probability / 100), 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center">
            <Target className="h-4.5 w-4.5 text-brand-navy-600 dark:text-brand-navy-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {ar ? "الفرص التجارية" : "Opportunities"}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {ar ? "إدارة فرص البيع ومتابعتها" : "Manage and track sales opportunities"}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1 bg-brand-navy-600 hover:bg-brand-navy-700" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3.5 w-3.5" />
          {ar ? "فرصة جديدة" : "Add Opportunity"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">{ar ? "إجمالي القيمة" : "Total Value"}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totalValue, ar)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">{ar ? "القيمة المرجحة" : "Weighted"}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(weightedValue, ar)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
              <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500">{ar ? "فوز" : "Won"}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(wonValue, ar)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {byStage.map((stage) => (
            <div key={stage.key} className="space-y-2">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {ar ? stage.labelAr : stage.labelEn}
                </span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{stage.items.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {stage.items.map((opp) => (
                  <Card
                    key={opp.id}
                    className="border-slate-200 dark:border-slate-700/50 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{opp.title}</p>
                      {opp.lead && (
                        <p className="text-[10px] text-slate-500 truncate">{opp.lead.name}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-navy-600 dark:text-brand-navy-400">
                          {formatCurrency(Number(opp.estimatedValue), ar)}
                        </span>
                        <Badge className={`text-[9px] h-4 px-1 ${stage.color}`}>
                          {opp.probability}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stage.items.length === 0 && (
                  <div className="text-center py-4 text-[10px] text-slate-400">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">{ar ? "فرصة جديدة" : "New Opportunity"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{ar ? "العنوان" : "Title"}</Label>
              <Input
                className="h-8 text-sm"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={ar ? "مثال: تصميم فيلا في رأس الخيمة" : "e.g. Villa design in RAK"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{ar ? "المرحلة" : "Stage"}</Label>
                <select
                  className="w-full h-8 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-transparent px-2"
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                >
                  {STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{ar ? s.labelAr : s.labelEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">{ar ? "الاحتمالية %" : "Probability %"}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 text-sm"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{ar ? "القيمة المتوقعة" : "Estimated Value"}</Label>
              <Input
                type="number"
                className="h-8 text-sm"
                value={formData.estimatedValue}
                onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">{ar ? "تاريخ الإغلاق المتوقع" : "Expected Close Date"}</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={formData.expectedCloseDate}
                onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{ar ? "الوصف" : "Description"}</Label>
              <Input
                className="h-8 text-sm"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowAddDialog(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              className="bg-brand-navy-600 hover:bg-brand-navy-700"
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.title}
            >
              {ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
