"use client";


import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { ContractorFull, ProjectOption } from "./types";

interface BidFormData {
  projectId: string;
  contractorName: string;
  contractorContact: string;
  amount: string;
  notes: string;
  status: string;
  contractorId: string;
  deadline: string;
}

interface AddBidDialogProps {
  ar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: BidFormData;
  onFormDataChange: (data: BidFormData) => void;
  emptyForm: BidFormData;
  projects: ProjectOption[];
  contractorsList: ContractorFull[];
  onSubmit: () => void;
  isPending: boolean;
}

export function AddBidDialog({
  ar,
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  emptyForm,
  projects,
  contractorsList,
  onSubmit,
  isPending,
}: AddBidDialogProps) {
  const tAuto = useTranslations();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); onFormDataChange(emptyForm); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tAuto('auto.newBid')}</DialogTitle>
          <DialogDescription>{tAuto('auto.addANewBid')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.project')} *</Label>
            <Select value={formData.projectId} onValueChange={(v) => onFormDataChange({ ...formData, projectId: v })}>
              <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectProject')} /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {/* Contractor link */}
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.linkToContractorOptional')}</Label>
            <Select value={formData.contractorId} onValueChange={(v) => {
              const c = contractorsList.find((x) => x.id === v);
              onFormDataChange({
                ...formData,
                contractorId: v,
                contractorName: c ? (ar ? c.name : c.nameEn || c.name) : formData.contractorName,
                contractorContact: c ? c.phone : formData.contractorContact,
              });
            }}>
              <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectContractor')} /></SelectTrigger>
              <SelectContent>
                {contractorsList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{ar ? c.name : c.nameEn || c.name} — {ar ? c.companyName : c.companyEn || c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.contractorName')} *</Label>
              <Input value={formData.contractorName} onChange={(e) => onFormDataChange({ ...formData, contractorName: e.target.value })} placeholder={tAuto('auto.contractorName1')} className="h-8 text-sm rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.contact')}</Label>
              <Input value={formData.contractorContact} onChange={(e) => onFormDataChange({ ...formData, contractorContact: e.target.value })} placeholder={tAuto('auto.phoneOrEmail')} className="h-8 text-sm rounded-lg" dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.amountAED')}</Label>
              <Input type="number" value={formData.amount} onChange={(e) => onFormDataChange({ ...formData, amount: e.target.value })} placeholder="0" className="h-8 text-sm tabular-nums font-mono rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.deadline')}</Label>
              <Input type="date" value={formData.deadline} onChange={(e) => onFormDataChange({ ...formData, deadline: e.target.value })} className="h-8 text-sm rounded-lg" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.notes')}</Label>
            <Textarea value={formData.notes} onChange={(e) => onFormDataChange({ ...formData, notes: e.target.value })} placeholder={tAuto('auto.additionalNotes')} className="text-sm min-h-[60px] rounded-lg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onFormDataChange(emptyForm); }}>{tAuto('auto.cancel')}</Button>
          <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white rounded-lg" onClick={onSubmit} disabled={!formData.projectId || !formData.contractorName || isPending}>
            {isPending ? (tAuto('auto.saving')) : (tAuto('auto.save'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { BidFormData };
