"use client";

import React, { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, Wallet, Building2, Banknote, AlertCircle } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMutationHeaders } from "@/lib/csrf-client";
import { formatCurrency } from "@/lib/formatters";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import type { Invoice } from "./types";

interface RecordPaymentDialogProps {
  ar: boolean;
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
}

export function InvoiceRecordPaymentDialog({
  ar,
  open,
  invoice,
  onClose,
}: RecordPaymentDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToastFeedback({ ar });

  const remaining = invoice?.remaining ?? invoice?.total ?? 0;
  const [amount, setAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"bank" | "cash">("bank");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");

  // Sync default amount to remaining when dialog opens with invoice
  React.useEffect(() => {
    if (invoice) {
      const rem = invoice.remaining ?? invoice.total ?? 0;
      setAmount(rem > 0 ? String(rem) : "");
      setDescription(
        ar
          ? `دفعة سداد على الفاتورة ${invoice.number}`
          : `Payment on invoice ${invoice.number}`
      );
    }
  }, [invoice, ar]);

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("No invoice selected");
      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) {
        throw new Error(ar ? "يرجى إدخال مبلغ صحيح أكبر من صفر" : "Please enter a valid amount");
      }
      if (numAmount > remaining + 0.01) {
        throw new Error(
          ar
            ? `المبلغ المدخل (${numAmount}) يتجاوز المتبقي من الفاتورة (${remaining})`
            : `Amount exceeds invoice remaining balance (${remaining})`
        );
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({
          invoiceId: invoice.id,
          projectId: invoice.projectId || invoice.project?.id || undefined,
          amount: numAmount,
          payMethod: payMethod,
          referenceNumber: referenceNumber.trim() || undefined,
          beneficiary: invoice.client?.name || "العميل",
          description: description.trim() || `دفعة على الفاتورة ${invoice.number}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to record payment");
      }
      return json;
    },
    onSuccess: () => {
      toast.showSuccess(
        ar ? "تم تسجيل الدفعة وترحيل القيد المحاسبي بنجاح" : "Payment recorded & GL entry posted"
      );
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      queryClient.invalidateQueries({ queryKey: ["invoices-overdue-count"] });
      onClose();
    },
    onError: (err: Error) => {
      toast.showError(err.message);
    },
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {ar ? `تسجيل دفعة على الفاتورة (${invoice.number})` : `Record Payment on Invoice (${invoice.number})`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {ar
                  ? `العميل: ${invoice.client?.name} • المتبقي: ${formatCurrency(remaining, ar)}`
                  : `Client: ${invoice.client?.name} • Remaining: ${formatCurrency(remaining, ar)}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            recordPaymentMutation.mutate();
          }}
          className="space-y-4 pt-2"
        >
          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                {ar ? "المبلغ المسدد *" : "Payment Amount *"}
              </Label>
              <button
                type="button"
                onClick={() => setAmount(String(remaining))}
                className="text-xs text-primary hover:underline font-medium"
              >
                {ar ? "كامل المتبقي" : "Full Remaining"}
              </button>
            </div>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pe-12 font-mono font-bold text-base"
                required
                autoFocus
              />
              <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                AED
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "طريقة الإيداع / الحساب *" : "Deposit Method / Account *"}
            </Label>
            <Select
              value={payMethod}
              onValueChange={(v: string) => setPayMethod(v as "bank" | "cash")}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span>{ar ? "حساب بنكي (حساب 1020)" : "Bank Account (1020)"}</span>
                  </div>
                </SelectItem>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                    <span>{ar ? "صندوق النقدية (حساب 1010)" : "Cash on Hand (1010)"}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reference / Cheque number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "رقم المرجع / الشيك / الحوالة" : "Reference / Cheque / Transfer #"}
            </Label>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={ar ? "مثال: TXN-94827 أو رقم الشيك" : "e.g. TXN-94827"}
              className="h-9 text-xs"
            />
          </div>

          {/* Note / Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "البيان / الوصف المحاسبي" : "Memo / Description"}
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={ar ? "بيان سند القبض والقيد" : "Journal entry memo"}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={recordPaymentMutation.isPending}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              disabled={recordPaymentMutation.isPending || !amount}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {recordPaymentMutation.isPending
                  ? ar
                    ? "جاري الترحيل..."
                    : "Posting..."
                  : ar
                  ? "تسجيل وسداد"
                  : "Post Payment"}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
