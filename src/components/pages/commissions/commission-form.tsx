"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getMutationHeaders } from "@/lib/csrf-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserOption, ProjectOption } from "./types";

// ===== Commission Form Dialog =====
interface CommissionFormProps {
  language: "ar" | "en";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserOption[];
  projects: ProjectOption[];
}

export function CommissionFormDialog({ language, open, onOpenChange, users, projects }: CommissionFormProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const emptyForm = { userId: "", projectId: "", type: "project_referral", amount: "", percentage: "", baseAmount: "", description: "" };
  const [formData, setFormData] = useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await fetch("/api/commissions", { method: "POST", headers: getMutationHeaders(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["commissions"] }); onOpenChange(false); setFormData(emptyForm); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); setFormData(emptyForm); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tAuto('auto.newCommission')}</DialogTitle>
          <DialogDescription>{tAuto('auto.addANewCommissionForEmployee')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.employee')} *</Label>
              <Select value={formData.userId} onValueChange={(v) => setFormData({ ...formData, userId: v })}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectEmployee')} /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.type')}</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_referral">{tAuto('auto.projectReferral')}</SelectItem>
                  <SelectItem value="completion_bonus">{tAuto('auto.completionBonus')}</SelectItem>
                  <SelectItem value="client_satisfaction">{tAuto('auto.clientSatisfaction')}</SelectItem>
                  <SelectItem value="performance">{tAuto('auto.performance')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.project')}</Label>
            <Select value={formData.projectId} onValueChange={(v) => setFormData({ ...formData, projectId: v })}>
              <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectProject')} /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.amountAED')}</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0" className="h-8 text-sm tabular-nums font-mono rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.percentage')}</Label>
              <Input type="number" value={formData.percentage} onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} placeholder="0" className="h-8 text-sm tabular-nums font-mono rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.baseAmount')}</Label>
              <Input type="number" value={formData.baseAmount} onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })} placeholder="0" className="h-8 text-sm tabular-nums font-mono rounded-lg" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.description')}</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={tAuto('auto.commissionDescription')} className="text-sm min-h-[60px] rounded-lg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setFormData(emptyForm); }}>{tAuto('auto.cancel')}</Button>
          <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={() => createMutation.mutate(formData)} disabled={!formData.userId || !formData.amount || createMutation.isPending}>
            {createMutation.isPending ? (tAuto('auto.saving')) : (tAuto('auto.save'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Referral Form Dialog =====
interface ReferralFormProps {
  language: "ar" | "en";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserOption[];
  projects: ProjectOption[];
}

export function ReferralFormDialog({ language, open, onOpenChange, users, projects }: ReferralFormProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const emptyForm = { referrerId: "", referredName: "", referredPhone: "", referredEmail: "", projectId: "", notes: "" };
  const [formData, setFormData] = useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await fetch("/api/referrals", { method: "POST", headers: getMutationHeaders(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["referrals"] }); onOpenChange(false); setFormData(emptyForm); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); setFormData(emptyForm); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tAuto('auto.newReferral')}</DialogTitle>
          <DialogDescription>{tAuto('auto.addANewClientReferral')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.referrer')} *</Label>
            <Select value={formData.referrerId} onValueChange={(v) => setFormData({ ...formData, referrerId: v })}>
              <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectReferrer')} /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.referredName')} *</Label>
              <Input value={formData.referredName} onChange={(e) => setFormData({ ...formData, referredName: e.target.value })} placeholder={tAuto('auto.referredClientName')} className="h-8 text-sm rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.phone')}</Label>
              <Input value={formData.referredPhone} onChange={(e) => setFormData({ ...formData, referredPhone: e.target.value })} placeholder="+971 XX XXX XXXX" dir="ltr" className="h-8 text-sm rounded-lg text-left" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.email')}</Label>
              <Input type="email" value={formData.referredEmail} onChange={(e) => setFormData({ ...formData, referredEmail: e.target.value })} placeholder="email@example.com" dir="ltr" className="h-8 text-sm rounded-lg text-left" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.project')}</Label>
              <Select value={formData.projectId} onValueChange={(v) => setFormData({ ...formData, projectId: v })}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue placeholder={tAuto('auto.selectProject')} /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.notes')}</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={tAuto('auto.additionalNotes')} className="text-sm min-h-[60px] rounded-lg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setFormData(emptyForm); }}>{tAuto('auto.cancel')}</Button>
          <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={() => createMutation.mutate(formData)} disabled={!formData.referrerId || !formData.referredName || createMutation.isPending}>
            {createMutation.isPending ? (tAuto('auto.saving')) : (tAuto('auto.save'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Campaign Form Dialog =====
interface CampaignFormProps {
  language: "ar" | "en";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId: string | null;
  onEditIdChange: (id: string | null) => void;
}

export function CampaignFormDialog({ language, open, onOpenChange, editId, onEditIdChange }: CampaignFormProps) {
  const tAuto = useTranslations();
  const _ar = language === "ar";
  const queryClient = useQueryClient();
  const emptyForm = { name: "", type: "SOCIAL_MEDIA", budget: "", startDate: "", endDate: "", notes: "" };
  const [formData, setFormData] = useState(emptyForm);

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await fetch("/api/marketing-campaigns", { method: "POST", headers: getMutationHeaders(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] }); onOpenChange(false); setFormData(emptyForm); onEditIdChange(null); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/marketing-campaigns/${id}`, { method: "PUT", headers: getMutationHeaders(), body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] }); },
  });

  const handleSave = () => {
    if (editId) {
      updateMutation.mutate({
        id: editId,
        data: { name: formData.name, type: formData.type, budget: parseFloat(formData.budget) || 0, startDate: formData.startDate || null, endDate: formData.endDate || null, notes: formData.notes },
      });
      onOpenChange(false);
      onEditIdChange(null);
      setFormData(emptyForm);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); setFormData(emptyForm); onEditIdChange(null); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? (tAuto('auto.editCampaign')) : (tAuto('auto.newCampaign'))}</DialogTitle>
          <DialogDescription>{editId ? (tAuto('auto.updateCampaignDetails')) : (tAuto('auto.addANewMarketingCampaign'))}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.campaignName')} *</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={tAuto('auto.campaignName1')} className="h-8 text-sm rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.type')}</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger className="h-8 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOCIAL_MEDIA">{tAuto('auto.socialMedia')}</SelectItem>
                  <SelectItem value="google_ads">{tAuto('auto.googleAds')}</SelectItem>
                  <SelectItem value="REFERRAL">{tAuto('auto.referral')}</SelectItem>
                  <SelectItem value="DIRECT">{tAuto('auto.direct')}</SelectItem>
                  <SelectItem value="exhibition">{tAuto('auto.exhibition')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.budgetAED')}</Label>
              <Input type="number" value={formData.budget} onChange={(e) => setFormData({ ...formData, budget: e.target.value })} placeholder="0" className="h-8 text-sm tabular-nums font-mono rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.startDate')}</Label>
              <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="h-8 text-sm rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tAuto('auto.endDate')}</Label>
              <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="h-8 text-sm rounded-lg" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{tAuto('auto.notes')}</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={tAuto('auto.notes')} className="text-sm min-h-[60px] rounded-lg" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setFormData(emptyForm); onEditIdChange(null); }}>{tAuto('auto.cancel')}</Button>
          <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" onClick={handleSave} disabled={!formData.name || createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) ? (tAuto('auto.saving')) : (tAuto('auto.save'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
