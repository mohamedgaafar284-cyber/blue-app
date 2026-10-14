"use client";


import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { CreateFormState, EntityItem } from "./types";
import { getHashColor } from "./helpers";

interface SimpleUser {
  id: string;
  name: string;
  role?: string;
}

interface CreateApprovalDialogProps {
  ar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createForm: CreateFormState;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  onCreate: (form: CreateFormState) => void;
  createMutationIsPending: boolean;
  entityList: EntityItem[];
  handleEntitySelect: (entityId: string) => void;
}

export function CreateApprovalDialog({
  ar,
  open,
  onOpenChange,
  createForm,
  setCreateForm,
  onCreate,
  createMutationIsPending,
  entityList,
  handleEntitySelect,
}: CreateApprovalDialogProps) {
  const tAuto = useTranslations();

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<SimpleUser[]>({
    queryKey: ["users-simple"],
    queryFn: async () => {
      const res = await fetch("/api/users-simple");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-navy-500 to-cyan-600 flex items-center justify-center">
              <Plus className="h-4 w-4 text-white" />
            </div>
            {tAuto('auto.newApprovalRequest')}
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            {tAuto('auto.createANewApprovalRequestForReview')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Entity Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {tAuto('auto.entityType')} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={createForm.entityType}
              onValueChange={(v) => setCreateForm((prev) => ({ ...prev, entityType: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tAuto('auto.selectType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">{tAuto('auto.invoice')}</SelectItem>
                <SelectItem value="payment">{tAuto('auto.payment')}</SelectItem>
                <SelectItem value="purchase_order">{tAuto('auto.purchaseOrder')}</SelectItem>
                <SelectItem value="change_order">{tAuto('auto.changeOrder')}</SelectItem>
                <SelectItem value="LEAVE">{tAuto('auto.leave')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {tAuto('auto.title')} <span className="text-red-500">*</span>
            </Label>
            <Input
              value={createForm.title}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={tAuto('auto.approvalRequestTitle')}
              className="text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {tAuto('auto.description')}
            </Label>
            <Textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={tAuto('auto.detailedDescription')}
              className="text-sm h-20 resize-none"
            />
          </div>

          {/* Assigned To + Steps - side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {tAuto('auto.assignedTo')} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={createForm.assignedTo}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, assignedTo: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isLoadingUsers ? (ar ? "جاري التحميل..." : "Loading...") : tAuto('auto.select')} />
                </SelectTrigger>
                <SelectContent>
                  {users.length > 0 ? (
                    users.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white", getHashColor(u.name))}>
                            {u.name.charAt(0)}
                          </div>
                          <span>{u.name}</span>
                          {u.role && (
                            <span className="text-[10px] text-slate-400">({u.role})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="py-2 px-3 text-xs text-slate-400 text-center">
                      {ar ? "لا يوجد مستخدمون متاحون" : "No users found"}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {tAuto('auto.approvalSteps')}
              </Label>
              <Select
                value={createForm.totalSteps}
                onValueChange={(v) => setCreateForm((prev) => ({ ...prev, totalSteps: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">{tAuto('auto.1Step')}</SelectItem>
                  <SelectItem value="2">{tAuto('auto.2Steps')}</SelectItem>
                  <SelectItem value="3">{tAuto('auto.3Steps')}</SelectItem>
                  <SelectItem value="4">{tAuto('auto.4Steps')}</SelectItem>
                  <SelectItem value="5">{tAuto('auto.5Steps')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {tAuto('auto.amountAED')}
            </Label>
            <Input
              type="number"
              value={createForm.amount}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder={tAuto('auto.000')}
              className="text-sm font-mono tabular-nums"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {tAuto('auto.priority')}
            </Label>
            <div className="flex items-center gap-2">
              {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map((p) => {
                const pLabels: Record<string, { ar: string; en: string }> = {
                  LOW: { ar: "منخفضة", en: "Low" },
                  NORMAL: { ar: "عادية", en: "Normal" },
                  HIGH: { ar: "عالية", en: "High" },
                  URGENT: { ar: "عاجل", en: "Urgent" },
                };
                const pColors: Record<string, string> = {
                  LOW: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
                  NORMAL: "bg-brand-navy-50 dark:bg-brand-navy-900/20 text-brand-navy-600 dark:text-brand-navy-400 border-brand-navy-200 dark:border-brand-navy-800",
                  HIGH: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                  URGENT: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
                };
                const isActive = createForm.priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setCreateForm((prev) => ({ ...prev, priority: p }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border",
                      isActive
                        ? cn(pColors[p], "ring-2 ring-offset-1 ring-current dark:ring-offset-slate-900 scale-[1.02]")
                        : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    {p === "URGENT" && <AlertCircle className="h-3 w-3 inline me-1" />}
                    {pLabels[p][ar ? "ar" : "en"]}
                  </button>
                );
              })}
            </div>
              {/* Entity Picker - shown when an entity type with real entities is selected */}
              {(createForm.entityType === "invoice" || createForm.entityType === "payment" || createForm.entityType === "change_order") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {tAuto('auto.selectEntity')}
                  </Label>
                  <Select
                    value={createForm.entityId}
                    onValueChange={handleEntitySelect}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={tAuto('auto.selectAnItem')} />
                    </SelectTrigger>
                    <SelectContent>
                      {entityList.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span className="truncate max-w-[200px]">{e.title}</span>
                            {e.amount != null && e.amount > 0 && (
                              <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                                {formatCurrency(e.amount, ar)}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      {entityList.length === 0 && (
                        <div className="py-4 text-center text-xs text-slate-400">
                          {tAuto('auto.noItemsFound')}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-sm"
          >
            {tAuto('auto.cancel')}
          </Button>
          <Button
            onClick={() => onCreate(createForm)}
            disabled={!createForm.entityType || !createForm.title || !createForm.assignedTo || createMutationIsPending}
            className="gap-2 bg-gradient-to-r from-brand-navy-600 to-cyan-600 hover:from-brand-navy-700 hover:to-cyan-700 text-white border-0 shadow-md shadow-brand-navy-500/20 text-sm"
          >
            {createMutationIsPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {tAuto('auto.createRequest')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
