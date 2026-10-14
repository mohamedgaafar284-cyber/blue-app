"use client";


import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, X } from "lucide-react";
import { cn, safeRandomUUID } from "@/lib/utils";
import {
  STAGES,
  STAGE_TEMPLATES,
  ProjectOption,
  CreateFormState,
  CreateFormItem,
  CreateViolationItem,
} from "./types";

interface SupervisionFormProps {
  ar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createForm: CreateFormState;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  createItems: CreateFormItem[];
  setCreateItems: React.Dispatch<React.SetStateAction<CreateFormItem[]>>;
  createViolations: CreateViolationItem[];
  setCreateViolations: React.Dispatch<React.SetStateAction<CreateViolationItem[]>>;
  projects: ProjectOption[];
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function SupervisionForm({
  ar,
  open,
  onOpenChange,
  createForm,
  setCreateForm,
  createItems,
  setCreateItems,
  createViolations,
  setCreateViolations,
  projects,
  isPending,
  onSubmit,
  onCancel,
}: SupervisionFormProps) {
  const tAuto = useTranslations();
  const loadStageTemplate = (stage: string) => {
    const templates = STAGE_TEMPLATES[stage] || [];
    setCreateItems(templates.map(t => ({
      _key: safeRandomUUID(),
      category: t.category,
      description: t.description,
      specification: t.specification,
      isChecked: false,
      compliant: true,
      notes: "",
    })));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tAuto('auto.newSupervisionChecklist')}</DialogTitle>
          <DialogDescription>{tAuto('auto.createANewSupervisionChecklist')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tAuto('auto.project2')}</Label>
              <Select value={createForm.projectId} onValueChange={(v) => setCreateForm({ ...createForm, projectId: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={tAuto('auto.selectProject')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tAuto('auto.stage')}</Label>
              <Select value={createForm.stage} onValueChange={(v) => { setCreateForm({ ...createForm, stage: v }); loadStageTemplate(v); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={tAuto('auto.selectStage')} />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{ar ? s.ar : s.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tAuto('auto.title')}</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder={tAuto('auto.visitTitle')}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tAuto('auto.date1')}</Label>
              <Input
                type="date"
                value={createForm.visitDate}
                onChange={(e) => setCreateForm({ ...createForm, visitDate: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{tAuto('auto.weather')}</Label>
              <Select value={createForm.weather} onValueChange={(v) => setCreateForm({ ...createForm, weather: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sunny">{tAuto('auto.sunny')}</SelectItem>
                  <SelectItem value="cloudy">{tAuto('auto.cloudy')}</SelectItem>
                  <SelectItem value="rainy">{tAuto('auto.rainy')}</SelectItem>
                  <SelectItem value="hot">{tAuto('auto.hot')}</SelectItem>
                  <SelectItem value="windy">{tAuto('auto.windy')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tAuto('auto.temperature')}</Label>
              <Input
                value={createForm.temperature}
                onChange={(e) => setCreateForm({ ...createForm, temperature: e.target.value })}
                placeholder="°C"
                className="h-9 text-sm"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{tAuto('auto.workers1')}</Label>
              <Input
                type="number"
                min={0}
                value={createForm.workerCount}
                onChange={(e) => setCreateForm({ ...createForm, workerCount: e.target.value })}
                placeholder="0"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{tAuto('auto.contractorName')}</Label>
            <Input
              value={createForm.contractorName}
              onChange={(e) => setCreateForm({ ...createForm, contractorName: e.target.value })}
              placeholder={tAuto('auto.contractorName1')}
              className="h-9 text-sm"
            />
          </div>

          {/* Progress Sliders */}
          <Separator />
          <div className="space-y-3">
            <Label className="text-xs font-semibold">{tAuto('auto.progress')}</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "concreteProgress", ar: "الخرسانة", en: "Concrete" },
                { key: "masonryProgress", ar: "البناء", en: "Masonry" },
                { key: "electricalProgress", ar: "الكهرباء", en: "Electrical" },
                { key: "plumbingProgress", ar: "السباكة", en: "Plumbing" },
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">{ar ? item.ar : item.en}</span>
                    <span className="text-[11px] font-medium text-brand-navy-600 dark:text-brand-navy-400">{createForm[item.key as keyof typeof createForm] as number}%</span>
                  </div>
                  <Slider
                    value={[createForm[item.key as keyof typeof createForm] as number]}
                    onValueChange={([v]) => setCreateForm({ ...createForm, [item.key]: v })}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Checklist Items */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">{tAuto('auto.checklistItems')} ({createItems.length})</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setCreateItems([...createItems, { _key: safeRandomUUID(), category: "", description: "", specification: "", isChecked: false, compliant: true, notes: "" }])}
              >
                <Plus className="h-3 w-3 me-1" />{tAuto('auto.addItem1')}
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {createItems.map((item, idx) => (
                <div key={item._key} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.isChecked}
                      onCheckedChange={(c) => {
                        const updated = [...createItems];
                        updated[idx] = { ...updated[idx], isChecked: !!c };
                        setCreateItems(updated);
                      }}
                      className="h-4 w-4"
                    />
                    <Input
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...createItems];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setCreateItems(updated);
                      }}
                      placeholder={tAuto('auto.itemDescription')}
                      className="h-8 text-xs flex-1"
                    />
                    <Select
                      value={item.category}
                      onValueChange={(v) => {
                        const updated = [...createItems];
                        updated[idx] = { ...updated[idx], category: v };
                        setCreateItems(updated);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[100px] text-xs">
                        <SelectValue placeholder={tAuto('auto.category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(createItems.map(i => i.category).filter(Boolean))).map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        <SelectItem value="السلامة">{tAuto('auto.safety')}</SelectItem>
                        <SelectItem value="الجودة">{tAuto('auto.quality')}</SelectItem>
                        <SelectItem value="المواصفات">{tAuto('auto.specs')}</SelectItem>
                        <SelectItem value="أخرى">{tAuto('auto.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {item.isChecked && (
                      <Select
                        value={item.compliant ? "yes" : "no"}
                        onValueChange={(v) => {
                          const updated = [...createItems];
                          updated[idx] = { ...updated[idx], compliant: v === "yes" };
                          setCreateItems(updated);
                        }}
                      >
                        <SelectTrigger className={cn("h-8 w-[80px] text-xs border-0", item.compliant ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-red-600 bg-red-50 dark:bg-red-900/20")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">{tAuto('auto.oK')}</SelectItem>
                          <SelectItem value="no">{tAuto('auto.nonCompliant')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <button className="p-1 text-slate-400 hover:text-red-500 transition-colors" onClick={() => setCreateItems(createItems.filter((_, i) => i !== idx))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Violations */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">{tAuto('auto.violations')} ({createViolations.length})</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setCreateViolations([...createViolations, { _key: safeRandomUUID(), type: "SAFETY", severity: "LOW", description: "", contractorName: "", deadline: "" }])}
              >
                <Plus className="h-3 w-3 me-1" />{tAuto('auto.addViolation')}
              </Button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {createViolations.map((v, idx) => (
                <div key={v._key} className="p-3 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <Textarea
                      value={v.description}
                      onChange={(e) => {
                        const updated = [...createViolations];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setCreateViolations(updated);
                      }}
                      placeholder={tAuto('auto.violationDescription')}
                      className="min-h-[36px] text-xs flex-1 resize-none"
                      rows={1}
                    />
                    <Select
                      value={v.severity}
                      onValueChange={(s) => {
                        const updated = [...createViolations];
                        updated[idx] = { ...updated[idx], severity: s };
                        setCreateViolations(updated);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[80px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">{tAuto('auto.low')}</SelectItem>
                        <SelectItem value="MEDIUM">{tAuto('auto.medium')}</SelectItem>
                        <SelectItem value="HIGH">{tAuto('auto.high')}</SelectItem>
                        <SelectItem value="CRITICAL">{tAuto('auto.critical')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <button className="p-1 text-slate-400 hover:text-red-500 transition-colors" onClick={() => setCreateViolations(createViolations.filter((_, i) => i !== idx))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <Separator />
          <div className="space-y-1.5">
            <Label className="text-xs">{tAuto('auto.generalNotes')}</Label>
            <Textarea
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              placeholder={tAuto('auto.additionalNotes')}
              className="text-sm"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{tAuto('auto.cancel')}</Button>
          <Button
            className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white"
            onClick={onSubmit}
            disabled={!createForm.projectId || !createForm.visitDate || isPending}
          >
            {isPending ? (tAuto('auto.creating')) : (tAuto('auto.create'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
