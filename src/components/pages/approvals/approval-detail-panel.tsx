"use client";


import { useTranslations } from 'next-intl';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Eye, ExternalLink, ChevronDown, CheckCircle2, XCircle, CircleDot, Check, MessageSquare, Clock, Plus, SkipForward, Ban, FileText, CreditCard, ShoppingCart, RefreshCw, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { Approval } from "./types";
import { getEntityTypeBadgeColor, getEntityTypeLabel, getStatusConfig, getHashColor, timeAgo } from "./helpers";

// Stable component to avoid react-hooks/static-components lint error
function EntityTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "invoice": return <FileText className={className} />;
    case "payment": return <CreditCard className={className} />;
    case "purchase_order": return <ShoppingCart className={className} />;
    case "change_order": return <RefreshCw className={className} />;
    case "LEAVE": return <CalendarOff className={className} />;
    default: return <FileText className={className} />;
  }
}

interface ApprovalDetailPanelProps {
  ar: boolean;
  selectedApprovalId: string | null;
  setSelectedApprovalId: (id: string | null) => void;
  selectedApproval: Approval | null | undefined;
  linkedEntity: Record<string, unknown> | null | undefined;
}

export function ApprovalDetailPanel({
  ar,
  selectedApprovalId,
  setSelectedApprovalId,
  selectedApproval,
  linkedEntity,
}: ApprovalDetailPanelProps) {
  const tAuto = useTranslations();
  return (
    <Sheet open={!!selectedApprovalId} onOpenChange={(open) => !open && setSelectedApprovalId(null)}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 overflow-hidden">
        {selectedApproval && (
          <>
            {/* Gradient Header */}
            <div className="bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900 p-5 text-white">
              <SheetHeader className="text-start space-y-0">
                <SheetTitle className="text-white text-base font-bold">{selectedApproval.title}</SheetTitle>
                <SheetDescription className="text-slate-300 text-xs mt-1">
                  {selectedApproval.description || (tAuto('auto.noDescription'))}
                </SheetDescription>
              </SheetHeader>

              {/* Status + Type badges */}
              <div className="flex items-center gap-2 mt-3">
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                  getEntityTypeBadgeColor(selectedApproval.entityType)
                )}>
                  {getEntityTypeLabel(selectedApproval.entityType, ar)}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                  getStatusConfig(selectedApproval.status).bgColor,
                  getStatusConfig(selectedApproval.status).color
                )}>
                  {(() => { const Icon = getStatusConfig(selectedApproval.status).icon; return <Icon className="h-3 w-3" />; })()}
                  {ar ? getStatusConfig(selectedApproval.status).ar : getStatusConfig(selectedApproval.status).en}
                </span>
                {selectedApproval.amount > 0 && (
                  <span className="ms-auto text-xs font-mono tabular-nums font-medium text-emerald-300">
                    {formatCurrency(selectedApproval.amount, ar)}
                  </span>
                )}
              </div>
            </div>

            <ScrollArea className="h-[calc(100dvh-220px)]">
              <div className="p-4 space-y-5">
                {/* View Entity Info (if entityId is not "NEW") */}
                {selectedApproval.entityId && selectedApproval.entityId !== "NEW" && (
                  <div className="bg-gradient-to-r from-brand-navy-50 to-cyan-50 dark:from-brand-navy-900/10 dark:to-cyan-900/10 rounded-xl p-4 border border-brand-navy-200 dark:border-brand-navy-800/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <EntityTypeIcon type={selectedApproval.entityType} className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400" />
                        {tAuto('auto.linkedEntity')}
                      </h4>
                      <Badge variant="secondary" className={cn("text-[10px]", getEntityTypeBadgeColor(selectedApproval.entityType))}>
                        {getEntityTypeLabel(selectedApproval.entityType, ar)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.entityID')}</p>
                        <p className="text-sm font-mono text-slate-900 dark:text-white mt-0.5">{selectedApproval.entityId}</p>
                      </div>
                      <a
                        href={
                          selectedApproval.entityType === "invoice"
                            ? `/api/invoices/${selectedApproval.entityId}`
                            : selectedApproval.entityType === "payment"
                              ? `/api/payments/${selectedApproval.entityId}`
                              : selectedApproval.entityType === "change_order"
                                ? `/api/change-orders/${selectedApproval.entityId}`
                                : "#"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-navy-600 dark:text-brand-navy-400 bg-brand-navy-100 dark:bg-brand-navy-900/30 hover:bg-brand-navy-200 dark:hover:bg-brand-navy-900/50 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {tAuto('auto.viewEntity')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {linkedEntity && (() => {
                      const le = linkedEntity as Record<string, unknown>;
                      const leNumber = le.number ? String(le.number) : "";
                      const leTitle = le.title ? String(le.title) : le.description ? String(le.description) : le.subject ? String(le.subject) : "";
                      const leAmount = le.amount ? Number(le.amount) : 0;
                      return (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 mb-1 block">{tAuto('auto.entityDetails')}</span>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {leNumber ? `#${leNumber} — ` : ""}
                            {leTitle}
                          </p>
                          {leAmount > 0 && (
                            <p className="text-xs text-brand-navy-600 dark:text-brand-navy-400 font-mono mt-1">
                              {formatCurrency(leAmount, ar)}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Key Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{tAuto('auto.requestedBy')}</p>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white", getHashColor(selectedApproval.requestedBy))}>
                        {selectedApproval.requestedBy.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-slate-900 dark:text-white truncate">{selectedApproval.requestedBy}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{tAuto('auto.assignedTo')}</p>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white", getHashColor(selectedApproval.assignedTo))}>
                        {selectedApproval.assignedTo.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-slate-900 dark:text-white truncate">{selectedApproval.assignedTo}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{tAuto('auto.created')}</p>
                    <span className="text-xs font-medium text-slate-900 dark:text-white">
                      {new Date(selectedApproval.createdAt).toLocaleDateString(ar ? "ar-AE" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">{tAuto('auto.updated')}</p>
                    <span className="text-xs font-medium text-slate-900 dark:text-white">
                      {timeAgo(selectedApproval.updatedAt, ar)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* ===== APPROVAL CHAIN VISUALIZATION ===== */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <ChevronDown className="h-4 w-4 text-brand-navy-500" />
                    {tAuto('auto.approvalChain')}
                  </h4>

                  <div className="relative">
                    {/* Vertical timeline line */}
                    {selectedApproval.totalSteps > 1 && (
                      <div className="absolute start-3 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700" />
                    )}

                    <div className="space-y-0">
                      {Array.from({ length: selectedApproval.totalSteps }, (_, i) => i + 1).map((stepNum) => {
                        // Determine step status
                        let stepStatus: "COMPLETED" | "current" | "PENDING" | "REJECTED" = "PENDING";
                        if (selectedApproval.status === "APPROVED") {
                          stepStatus = "COMPLETED";
                        } else if (selectedApproval.status === "REJECTED" && stepNum === selectedApproval.step) {
                          stepStatus = "REJECTED";
                        } else if (stepNum < selectedApproval.step) {
                          stepStatus = "COMPLETED";
                        } else if (stepNum === selectedApproval.step) {
                          stepStatus = selectedApproval.status === "REJECTED" ? "REJECTED" : "current";
                        }

                        const stepLabels: Record<string, { ar: string; en: string }> = {
                          1: { ar: "المراجعة الأولى", en: "First Review" },
                          2: { ar: "الموافقة الإدارية", en: "Management Approval" },
                          3: { ar: "المراجعة المالية", en: "Financial Review" },
                          4: { ar: "الموافقة النهائية", en: "Final Approval" },
                          5: { ar: "التوقيع النهائي", en: "Final Sign-off" },
                        };
                        const stepLabel = stepLabels[stepNum]?.[ar ? "ar" : "en"] || (ar ? `الخطوة ${stepNum}` : `Step ${stepNum}`);

                        return (
                          <div key={stepNum} className="flex items-start gap-3 py-2.5">
                            {/* Step circle */}
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-[10px] font-bold border-2",
                              stepStatus === "COMPLETED" && "bg-emerald-500 border-emerald-500 text-white",
                              stepStatus === "current" && "bg-white dark:bg-slate-900 border-2 border-brand-navy-500 text-brand-navy-600 dark:text-brand-navy-400 ring-2 ring-brand-navy-200 dark:ring-brand-navy-800",
                              stepStatus === "PENDING" && "bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 text-slate-400",
                              stepStatus === "REJECTED" && "bg-red-500 border-red-500 text-white",
                            )}>
                              {stepStatus === "COMPLETED" ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : stepStatus === "REJECTED" ? (
                                <XCircle className="h-3.5 w-3.5" />
                              ) : stepStatus === "current" ? (
                                <CircleDot className="h-3.5 w-3.5" />
                              ) : (
                                stepNum
                              )}
                            </div>

                            {/* Step info */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className={cn(
                                "text-xs font-semibold",
                                stepStatus === "PENDING" && "text-slate-400 dark:text-slate-500",
                                stepStatus === "current" && "text-brand-navy-700 dark:text-brand-navy-300",
                                stepStatus === "COMPLETED" && "text-emerald-700 dark:text-emerald-300",
                                stepStatus === "REJECTED" && "text-red-700 dark:text-red-300",
                              )}>
                                {stepLabel}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {stepStatus === "COMPLETED" && (tAuto('auto.approved'))}
                                {stepStatus === "current" && (ar ? `بانتظار ${selectedApproval.assignedTo}` : `Pending with ${selectedApproval.assignedTo}`)}
                                {stepStatus === "PENDING" && (tAuto('auto.awaitingPreviousStep'))}
                                {stepStatus === "REJECTED" && (tAuto('auto.rejected'))}
                              </p>
                              {stepStatus === "COMPLETED" && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  {timeAgo(selectedApproval.updatedAt, ar)}
                                </p>
                              )}
                            </div>

                            {/* Status badge */}
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0 mt-0.5",
                              stepStatus === "COMPLETED" && "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
                              stepStatus === "current" && "bg-brand-navy-100 dark:bg-brand-navy-900/40 text-brand-navy-700 dark:text-brand-navy-300",
                              stepStatus === "PENDING" && "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
                              stepStatus === "REJECTED" && "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
                            )}>
                              {stepStatus === "COMPLETED" && (tAuto('auto.done'))}
                              {stepStatus === "current" && (tAuto('auto.current'))}
                              {stepStatus === "PENDING" && (tAuto('auto.waiting'))}
                              {stepStatus === "REJECTED" && (tAuto('auto.rejected'))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* ===== NOTES / COMMENTS SECTION ===== */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-brand-navy-500" />
                    {tAuto('auto.notesComments')}
                  </h4>
                  {selectedApproval.notes ? (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white", getHashColor(selectedApproval.assignedTo))}>
                          {selectedApproval.assignedTo.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {selectedApproval.assignedTo}
                        </span>
                        <span className="text-[10px] text-slate-400 ms-auto">
                          {timeAgo(selectedApproval.updatedAt, ar)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {selectedApproval.notes}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">{tAuto('auto.noNotesYet')}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ===== ACTIVITY LOG ===== */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-brand-navy-500" />
                    {tAuto('auto.activityLog')}
                  </h4>
                  <div className="space-y-2">
                    {/* Created event */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Plus className="h-3 w-3 text-brand-navy-600 dark:text-brand-navy-400" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">{selectedApproval.requestedBy}</span>
                          {" "}{tAuto('auto.createdTheApprovalRequest')}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {timeAgo(selectedApproval.createdAt, ar)}
                        </p>
                      </div>
                    </div>

                    {/* Step progression events */}
                    {selectedApproval.step > 1 && selectedApproval.status !== "REJECTED" && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                          <SkipForward className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="font-semibold">{selectedApproval.assignedTo}</span>
                            {" "}{tAuto('auto.approvedStep')} {selectedApproval.step - 1}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {tAuto('auto.forwardedToNextStep')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Final status event */}
                    {selectedApproval.status === "APPROVED" && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="font-semibold">{selectedApproval.assignedTo}</span>
                            {" "}{tAuto('auto.approvedTheRequest')}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {timeAgo(selectedApproval.updatedAt, ar)}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedApproval.status === "REJECTED" && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                          <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="font-semibold">{selectedApproval.assignedTo}</span>
                            {" "}{tAuto('auto.rejectedTheRequest')}
                          </p>
                          {selectedApproval.notes && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 italic">
                              &ldquo;{selectedApproval.notes}&rdquo;
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {timeAgo(selectedApproval.updatedAt, ar)}
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedApproval.status === "CANCELLED" && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Ban className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300">
                            {tAuto('auto.requestWasCancelled')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
