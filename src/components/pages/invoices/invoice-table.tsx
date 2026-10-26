"use client";


import { useTranslations } from 'next-intl';
import { TableVirtuoso } from "react-virtuoso";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Receipt, Pencil, Trash2, Printer, FileText, CheckCircle2, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { StatusIcon } from "@/components/ui/status-icon";
import { formatCurrency } from "@/lib/formatters";
import { getStatusConfig, getAmountColor } from "./helpers";
import type { Invoice } from "./types";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDualDate } from "@/lib/hijri-utils";

interface InvoiceTableProps {
  ar: boolean;
  paginatedFiltered: Invoice[];
  filtered: Invoice[];
  totalInvoices: number;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  onPrint: (inv: Invoice) => void;
  onExportPDF: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onDelete: (id: string) => void;
  onRequestApproval: (inv: Invoice) => void;
  onRecordPayment?: (inv: Invoice) => void;
  onCreateFirst?: () => void;

  PAGE_SIZE: number;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const VirtuosoTableComponents = {
  Scroller: forwardRef<HTMLDivElement>((props: ComponentPropsWithoutRef<'div'> & { className?: string }, ref) => <div {...props} ref={ref} className={cn("overflow-auto max-h-[calc(100vh-340px)] w-full custom-scrollbar", props.className)} />),
  Table: (props: ComponentPropsWithoutRef<'table'> & { className?: string }) => <Table {...props} className={cn("w-full caption-bottom text-sm", props.className)} />,
  TableHead: forwardRef<HTMLTableSectionElement>((props: ComponentPropsWithoutRef<'thead'> & { className?: string }, ref) => <TableHeader {...props} ref={ref} className="sticky top-0 z-10 bg-white dark:bg-slate-900 shadow-[0_1px_0_0_#e2e8f0] dark:shadow-[0_1px_0_0_#1e293b]" />),
  TableRow: (props: ComponentPropsWithoutRef<'tr'>) => <TableRow {...props} />,
  TableBody: forwardRef<HTMLTableSectionElement>((props: ComponentPropsWithoutRef<'tbody'>, ref) => <TableBody {...props} ref={ref} />),
};

export function InvoiceTable({
  ar,
  paginatedFiltered,
  filtered,
  totalInvoices,
  currentPage,
  totalPages,
  setCurrentPage,
  onPrint,
  onExportPDF,
  onEdit,
  onDelete,
  onRequestApproval,
  onRecordPayment,
  onCreateFirst,

  PAGE_SIZE,
  selectedIds,
  setSelectedIds,
}: InvoiceTableProps) {
  const tAuto = useTranslations();
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedFiltered.length && paginatedFiltered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedFiltered.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm relative">
      {filtered.length === 0 ? (
         <div className="text-center py-12 px-4 space-y-3">
           <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
             <Receipt className="h-6 w-6" />
           </div>
           <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
             {tAuto('auto.noInvoicesFound')}
           </p>
           {onCreateFirst && (
             <Button
               size="sm"
               onClick={onCreateFirst}
               className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
             >
               {ar ? "+ إنشاء أول فاتورة الآن" : "+ Create First Invoice"}
             </Button>
           )}
         </div>
      ) : (
      <TableVirtuoso
        data={paginatedFiltered}
        components={VirtuosoTableComponents}
        fixedHeaderContent={() => (
            <TableRow className="hover:bg-transparent bg-slate-50/80 dark:bg-slate-800/50">
              <TableHead className="w-[40px] px-4">
                <Checkbox 
                  checked={paginatedFiltered.length > 0 && selectedIds.size === paginatedFiltered.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="text-xs font-semibold">{tAuto('auto.no')}</TableHead>
              <TableHead className="text-xs font-semibold">{tAuto('auto.client')}</TableHead>
              <TableHead className="text-xs font-semibold hidden md:table-cell">{tAuto('auto.project')}</TableHead>
              <TableHead className="text-xs font-semibold hidden lg:table-cell">{tAuto('auto.issue')}</TableHead>
              <TableHead className="text-xs font-semibold hidden lg:table-cell">{tAuto('auto.due')}</TableHead>
              <TableHead className="text-xs font-semibold text-start">{tAuto('auto.total')}</TableHead>
              <TableHead className="text-xs font-semibold text-start hidden sm:table-cell">{tAuto('auto.tax51')}</TableHead>
              <TableHead className="text-xs font-semibold text-start">{tAuto('auto.grandTotal')}</TableHead>
              <TableHead className="text-xs font-semibold text-start hidden sm:table-cell">{tAuto('auto.paid')}</TableHead>
              <TableHead className="text-xs font-semibold text-start">{tAuto('auto.remaining')}</TableHead>
              <TableHead className="text-xs font-semibold">{tAuto('auto.status1')}</TableHead>
              <TableHead className="text-xs font-semibold text-end">{tAuto('auto.actions')}</TableHead>
            </TableRow>
        )}
        itemContent={(idx, inv) => {
          const sc = getStatusConfig(inv.status);
          return (
            <>
                  <TableCell className="px-4">
                    <Checkbox 
                      checked={selectedIds.has(inv.id)}
                      onCheckedChange={() => toggleSelect(inv.id)}
                      aria-label={`Select invoice ${inv.number}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{inv.number || "—"}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-900 dark:text-white max-w-[150px] truncate">{inv.client.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-slate-500">{ar ? inv.project.name : inv.project.nameEn || inv.project.name}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-500">{formatDualDate(inv.issueDate, ar ? 'ar' : 'en')}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-500">{formatDualDate(inv.dueDate, ar ? 'ar' : 'en')}</TableCell>
                  <TableCell className={cn("text-xs text-start tabular-nums font-mono", getAmountColor(inv.status))}>{formatCurrency(inv.subtotal, ar)}</TableCell>
                  <TableCell className={cn("text-xs text-start tabular-nums font-mono hidden sm:table-cell", getAmountColor(inv.status))}>{formatCurrency(inv.tax, ar)}</TableCell>
                  <TableCell className={cn("text-xs text-start font-medium tabular-nums font-mono", getAmountColor(inv.status))}>{formatCurrency(inv.total, ar)}</TableCell>
                  <TableCell className="text-xs text-start text-emerald-600 dark:text-emerald-400 tabular-nums font-mono hidden sm:table-cell">{formatCurrency(inv.paidAmount, ar)}</TableCell>
                  <TableCell className={cn("text-xs text-start font-medium tabular-nums font-mono", inv.remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>{formatCurrency(inv.remaining, ar)}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", sc.color)}>
                      <StatusIcon status={inv.status} className="h-3 w-3" />
                      {ar ? sc.ar : sc.en}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center gap-0.5 justify-end">
                      {/* Quick Record Payment for invoices not fully paid */}
                      {onRecordPayment && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              onClick={() => onRecordPayment(inv)}
                              aria-label={ar ? "تسجيل دفعة" : "Record Payment"}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {ar ? "تسجيل وسداد دفعة" : "Record Payment"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-700 dark:text-slate-400" onClick={() => onPrint(inv)} aria-label="Print"><Printer className="h-3.5 w-3.5" /></Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{tAuto('auto.print')}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-700 dark:text-slate-400" onClick={() => onExportPDF(inv)} aria-label="Export PDF"><FileText className="h-3.5 w-3.5" /></Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{tAuto('auto.exportPDF')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(inv)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{tAuto('auto.edit')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => onDelete(inv.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{tAuto('auto.delete')}</TooltipContent>
                      </Tooltip>
                      {inv.status === "DRAFT" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-brand-navy-600 hover:text-brand-navy-700"
                              onClick={() => onRequestApproval(inv)}
                              aria-label="Request approval"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">{tAuto('auto.requestApproval')}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
            </>
          );
        }}
      />
      )}
      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {ar ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            <span className="ms-2">({filtered.length} {tAuto('auto.invoices')})</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              aria-label={tAuto('auto.previousPage')}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "h-7 w-7 text-xs",
                    currentPage === pageNum
                      ? "bg-brand-navy-600 hover:bg-brand-navy-700 text-white border-brand-navy-600"
                      : ""
                  )}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              aria-label={tAuto('auto.nextPage')}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {/* Quick Total Floating Badge */}
      {filtered.length > 5 && (
        <div className="absolute bottom-3 end-3 z-10 bg-gradient-to-r from-brand-navy-600 to-cyan-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-brand-navy-600/30 flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">{tAuto('auto.total')}</span>
          <span className="text-sm font-bold tabular-nums font-mono">{formatCurrency(totalInvoices, ar)}</span>
        </div>
      )}
    </div>
  );
}
