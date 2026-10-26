"use client";


import { useTranslations } from 'next-intl';
import { Plus, X, DollarSign, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { formatCurrency as formatCurrencyMulti, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { getErrorMessage } from "@/lib/validations";
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from "react-hook-form";
import type { InvoiceFormData } from "@/lib/validations";
import type { InvoiceItem, Invoice, ProjectOption, ClientOption } from "./types";

interface InvoiceFormDialogProps {
  ar: boolean;
  open: boolean;
  editInvoice: Invoice | null;
  onClose: () => void;
  formData: {
    number: string;
    clientId: string;
    projectId: string;
    issueDate: string;
    dueDate: string;
    status: string;
    currency: string;
    items: InvoiceItem[];
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    number: string;
    clientId: string;
    projectId: string;
    issueDate: string;
    dueDate: string;
    status: string;
    currency: string;
    items: InvoiceItem[];
  }>>;
  register: UseFormRegister<InvoiceFormData>;
  errors: FieldErrors<InvoiceFormData>;
  watch: UseFormWatch<InvoiceFormData>;
  setValue: UseFormSetValue<InvoiceFormData>;
  clients: ClientOption[];
  projects: ProjectOption[];
  onSubmit: (e: React.FormEvent) => void;
  addLineItem: () => void;
  removeLineItem: (idx: number) => void;
  updateLineItem: (idx: number, field: keyof InvoiceItem, value: string | number) => void;
  calcSubtotal: number;
  calcTax: number;
  calcTotal: number;
  isSaving: boolean;
}

export function InvoiceFormDialog({
  ar,
  open,
  editInvoice,
  onClose,
  formData,
  setFormData,
  register,
  errors,
  watch,
  setValue,
  clients,
  projects,
  onSubmit,
  addLineItem,
  removeLineItem,
  updateLineItem,
  calcSubtotal,
  calcTax,
  calcTotal,
  isSaving,
}: InvoiceFormDialogProps) {
  const tAuto = useTranslations();
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editInvoice ? (tAuto('auto.editInvoice')) : (tAuto('auto.newInvoice'))}</DialogTitle>
          <DialogDescription>{editInvoice ? (tAuto('auto.updateInvoiceDetails')) : (tAuto('auto.createANewInvoice'))}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Top row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.invoiceNo')}</Label>
              <Input
                {...register("number")}
                placeholder={ar ? "تلقائي (مثل: INV-2026-001)" : "Auto-generated"}
                className="h-8 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              />
              {errors.number && <p className="text-red-500 text-xs mt-1">{getErrorMessage(errors.number.message || "", ar)}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.client')} *</Label>
              { }
              <Select value={watch("clientId")} onValueChange={(v) => { setValue("clientId", v); setFormData({ ...formData, clientId: v }); }}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectClient')} /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.clientId && <p className="text-red-500 text-xs mt-1">{getErrorMessage(errors.clientId.message || "", ar)}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.project')} *</Label>
              <Select value={watch("projectId")} onValueChange={(v) => { setValue("projectId", v); setFormData({ ...formData, projectId: v }); }}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectProject')} /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.projectId && <p className="text-red-500 text-xs mt-1">{getErrorMessage(errors.projectId.message || "", ar)}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Coins className="h-3 w-3" />{tAuto('auto.currency')}</Label>
              <Select value={formData.currency || "AED"} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <SelectItem key={c.code} value={c.code}>{ar ? `${c.nameAr} (${c.symbol})` : `${c.name} (${c.code})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.status1')}</Label>
              <Select value={watch("status")} onValueChange={(v) => { setValue("status", v as InvoiceFormData["status"]); setFormData({ ...formData, status: v }); }}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">{tAuto('auto.draft')}</SelectItem>
                  <SelectItem value="SENT">{tAuto('auto.sent')}</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">{tAuto('auto.partiallyPaid')}</SelectItem>
                  {/* Note: Invoices cannot be manually changed to PAID to preserve GL integrity. Use "تسجيل دفعة" instead */}
                  {editInvoice?.status === "PAID" && (
                    <SelectItem value="PAID">{tAuto('auto.paid')}</SelectItem>
                  )}
                  <SelectItem value="CANCELLED">{tAuto('auto.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates - two columns */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.issueDate')} *</Label>
              <Input type="date" {...register("issueDate")} className="h-8 text-sm rounded-lg" />
              {errors.issueDate && <p className="text-red-500 text-xs mt-1">{getErrorMessage(errors.issueDate.message || "", ar)}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.dueDate')} *</Label>
              <Input type="date" {...register("dueDate")} className="h-8 text-sm rounded-lg" />
              {errors.dueDate && <p className="text-red-500 text-xs mt-1">{getErrorMessage(errors.dueDate.message || "", ar)}</p>}
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">{tAuto('auto.lineItems')}</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={addLineItem}><Plus className="h-3 w-3 me-1" />{tAuto('auto.addItem1')}</Button>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="text-xs">{tAuto('auto.description')}</TableHead>
                    <TableHead className="text-xs w-36">{ar ? 'حساب الإيراد' : 'Revenue Account'}</TableHead>
                    <TableHead className="text-xs w-20">{tAuto('auto.qty')}</TableHead>
                    <TableHead className="text-xs w-24">{tAuto('auto.unitPrice')}</TableHead>
                    <TableHead className="text-xs w-28 text-start">{tAuto('auto.total')}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item, idx) => (
                    <TableRow key={idx} className={cn(
                      "transition-colors hover:bg-brand-navy-50/50 dark:hover:bg-brand-navy-950/10",
                      idx % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50/50 dark:bg-slate-800/20"
                    )}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0",
                            idx % 2 === 0
                              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              : "bg-brand-navy-100 text-brand-navy-700 dark:bg-brand-navy-900/40 dark:text-brand-navy-300"
                          )}>
                            {idx + 1}
                          </span>
                          <Input value={item.description} onChange={(e) => updateLineItem(idx, "description", e.target.value)} placeholder={tAuto('auto.itemDescription')} className="h-8 text-xs rounded-lg" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.revenueCode || "4010"}
                          onValueChange={(val) => updateLineItem(idx, "revenueCode", val)}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4010">{ar ? "4010 - إيراد خدمات" : "4010 - Service Revenue"}</SelectItem>
                            <SelectItem value="4020">{ar ? "4020 - إيراد استشارات" : "4020 - Consultation"}</SelectItem>
                            <SelectItem value="4100">{ar ? "4100 - إيرادات أخرى" : "4100 - Other Revenue"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" value={item.quantity} onChange={(e) => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="h-8 text-xs tabular-nums font-mono rounded-lg" /></TableCell>
                      <TableCell><Input type="number" value={item.unitPrice} onChange={(e) => updateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} className="h-8 text-xs tabular-nums font-mono rounded-lg" /></TableCell>
                      <TableCell className="text-start text-sm font-medium tabular-nums font-mono">{formatCurrencyMulti(item.quantity * item.unitPrice, formData.currency || "AED", ar ? "ar" : "en")}</TableCell>
                      <TableCell>
                        {formData.items.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => removeLineItem(idx)} aria-label={tAuto('auto.removeItem')}><X className="h-3.5 w-3.5" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals - Real-time Summary */}
          <div className="flex justify-end">
            <div className="w-72 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{tAuto('auto.subtotal')}</span>
                <span className="tabular-nums font-mono text-slate-700 dark:text-slate-300">{formatCurrencyMulti(calcSubtotal, formData.currency || "AED", ar ? "ar" : "en")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{tAuto('auto.tax5')}</span>
                <span className="tabular-nums font-mono text-slate-700 dark:text-slate-300">{formatCurrencyMulti(calcTax, formData.currency || "AED", ar ? "ar" : "en")}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2.5">
                <div className="flex justify-between text-base font-bold">
                  <span>{tAuto('auto.total')}</span>
                  <span className="text-brand-navy-600 dark:text-brand-navy-400 tabular-nums font-mono">{formatCurrencyMulti(calcTotal, formData.currency || "AED", ar ? "ar" : "en")}</span>
                </div>
              </div>
              {calcTotal > 0 && (
                <div className="flex items-center gap-1.5 pt-1">
                  <DollarSign className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-400">
                    {tAuto('auto.inclusiveOfVAT')}
                  </span>
                </div>
              )}
            </div>
          </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{tAuto('auto.cancel')}</Button>
          <Button type="submit" className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" disabled={isSaving}>
            {isSaving ? (tAuto('auto.saving')) : (tAuto('auto.save'))}
          </Button>
        </DialogFooter>
      </form>
      </DialogContent>
    </Dialog>
  );
}
