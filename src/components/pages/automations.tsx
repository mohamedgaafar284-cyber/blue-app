'use client';


import { useTranslations } from 'next-intl';
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusIcon } from '@/components/ui/status-icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Zap, Plus, Bell, Clock, Mail, FileText, Play, Pause, TrendingUp, ArrowUpRight, Trash2, CheckCircle2, RotateCcw } from 'lucide-react'
import { getMutationHeaders } from "@/lib/csrf-client";

interface Props {
  language: 'ar' | 'en';
}

interface Automation {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  status: string;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
}

// Status labels
const statusLabels: Record<string, { ar: string; en: string; color: string }> = {
  ACTIVE: { ar: 'نشط', en: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  INACTIVE: { ar: 'غير نشط', en: 'Inactive', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  PAUSED: { ar: 'متوقف مؤقتاً', en: 'Paused', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
};

// Trigger type labels
const triggerTypeLabels: Record<string, { ar: string; en: string }> = {
  SCHEDULE: { ar: 'مجدول', en: 'Scheduled' },
  event: { ar: 'بناء على حدث', en: 'Event-based' },
  threshold: { ar: 'بناء على حد', en: 'Threshold-based' },
};

// Action type labels
const actionTypeLabels: Record<string, { ar: string; en: string }> = {
  notification: { ar: 'إشعار', en: 'Notification' },
  EMAIL: { ar: 'بريد إلكتروني', en: 'Email' },
  task: { ar: 'إنشاء مهمة', en: 'Create Task' },
};

// Trigger type icons
const _triggerTypeIcons: Record<string, string> = {
  SCHEDULE: 'clock',
  event: 'zap',
  threshold: 'trending',
};

// Templates data
const templates = [
  {
    name: { ar: 'تنبيه المهام المتأخرة', en: 'Overdue Task Alerts' },
    icon: 'bell',
    description: { ar: 'عند تجاوز المهمة لموعد التسليم → إنشاء إشعار', en: 'When task is overdue → create notification' },
    triggerType: 'event',
    actionType: 'notification',
  },
  {
    name: { ar: 'إتمام المشروع تلقائياً', en: 'Auto-complete Projects' },
    icon: 'check',
    description: { ar: 'عند وصول نسبة الإنجاز 100% → تحديث حالة المشروع', en: 'When project reaches 100% → mark as completed' },
    triggerType: 'event',
    actionType: 'task',
  },
  {
    name: { ar: 'تذكير الفواتير المستحقة', en: 'Invoice Reminders' },
    icon: 'mail',
    description: { ar: 'عند اقتراب موعد استحقاق الفاتورة → إرسال تذكير', en: 'When invoice is overdue → send reminder' },
    triggerType: 'schedule',
    actionType: 'email',
  },
  {
    name: { ar: 'مراقبة الميزانية', en: 'Budget Monitor' },
    icon: 'trending',
    description: { ar: 'عند تجاوز حد الميزانية → إرسال تنبيه', en: 'When budget threshold exceeded → send alert' },
    triggerType: 'threshold',
    actionType: 'notification',
  },
  {
    name: { ar: 'تقرير يومي تلقائي', en: 'Daily Auto Report' },
    icon: 'file',
    description: { ar: 'إنشاء تقرير يومي تلقائي للأنشطة', en: 'Auto-generate daily activity report' },
    triggerType: 'schedule',
    actionType: 'email',
  },
  {
    name: { ar: 'تنبيه الموافقات المعلقة', en: 'Pending Approval Alerts' },
    icon: 'bell',
    description: { ar: 'عند وجود موافقة معلقة أكثر من 24 ساعة → إشعار', en: 'When approval pending > 24h → notify manager' },
    triggerType: 'event',
    actionType: 'notification',
  },
];

function TemplateIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className || 'h-6 w-6';
  switch (icon) {
    case 'bell': return <Bell className={cn(cls, 'text-brand-navy-600 dark:text-brand-navy-400')} />;
    case 'check': return <CheckCircle2 className={cn(cls, 'text-emerald-600 dark:text-emerald-400')} />;
    case 'mail': return <Mail className={cn(cls, 'text-sky-600 dark:text-sky-400')} />;
    case 'trending': return <TrendingUp className={cn(cls, 'text-amber-600 dark:text-amber-400')} />;
    case 'file': return <FileText className={cn(cls, 'text-violet-600 dark:text-violet-400')} />;
    default: return <Zap className={cls} />;
  }
}

function TriggerIcon({ type }: { type: string }) {
  switch (type) {
    case 'schedule': return <Clock className="h-4 w-4 text-sky-500" />;
    case 'event': return <Zap className="h-4 w-4 text-amber-500" />;
    case 'threshold': return <TrendingUp className="h-4 w-4 text-violet-500" />;
    default: return <Zap className="h-4 w-4 text-slate-400" />;
  }
}

export default function AutomationsPage({ language }: Props) {
  const tAuto = useTranslations();
  const isAr = language === 'ar';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAutomation, setNewAutomation] = useState({
    name: '',
    description: '',
    triggerType: 'event',
    actionType: 'notification',
  });

  // Fetch automations
  const { data: automationsData, isLoading } = useQuery<{ data: Automation[] }>({
    queryKey: ['automations'],
    queryFn: () => fetch('/api/automations').then((r) => r.json()),
  });
  const automations = automationsData?.data || [];

  // Toggle automation status
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: getMutationHeaders(),
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast({
        title: tAuto('auto.updated'),
        description: tAuto('auto.automationStatusUpdated'),
      });
    },
    onError: () => {
      toast({
        title: tAuto('auto.error'),
        description: tAuto('auto.failedToUpdateStatus'),
        variant: 'destructive',
      });
    },
  });

  // Create automation
  const createMutation = useMutation({
    mutationFn: (data: typeof newAutomation) =>
      fetch('/api/automations', {
        method: 'POST',
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['automations'] });
        setCreateDialogOpen(false);
        setNewAutomation({ name: '', description: '', triggerType: 'event', actionType: 'notification' });
        toast({
          title: tAuto('auto.success'),
          description: tAuto('auto.automationCreatedSuccessfully'),
        });
      }
    },
    onError: () => {
      toast({
        title: tAuto('auto.error'),
        description: tAuto('auto.failedToCreateAutomation'),
        variant: 'destructive',
      });
    },
  });

  // Delete automation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/automations/${id}`, { method: "DELETE", headers: getMutationHeaders() }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast({
        title: tAuto('auto.deleted'),
        description: tAuto('auto.automationDeletedSuccessfully'),
      });
    },
  });

  // Stats
  const activeCount = automations.filter((a) => a.status === 'ACTIVE').length;
  const inactiveCount = automations.filter((a) => a.status === 'INACTIVE').length;
  const totalRuns = automations.reduce((sum, a) => sum + a.runCount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-navy-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {tAuto('auto.automations')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {tAuto('auto.automateRepetitiveTasksAndWorkflows')}
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white gap-1.5 shadow-sm shadow-brand-navy-500/20">
              <Plus className="w-4 h-4" />
              {tAuto('auto.newAutomation')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir={isAr ? 'rtl' : 'ltr'}>
            <DialogHeader>
              <DialogTitle>{tAuto('auto.createNewAutomation')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{tAuto('auto.name')}</Label>
                <Input
                  value={newAutomation.name}
                  onChange={(e) => setNewAutomation({ ...newAutomation, name: e.target.value })}
                  placeholder={tAuto('auto.overdueTaskAlerts')}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{tAuto('auto.description')}</Label>
                <Input
                  value={newAutomation.description}
                  onChange={(e) => setNewAutomation({ ...newAutomation, description: e.target.value })}
                  placeholder={tAuto('auto.optionalDescription')}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{tAuto('auto.triggerType')}</Label>
                  <Select
                    value={newAutomation.triggerType}
                    onValueChange={(v) => setNewAutomation({ ...newAutomation, triggerType: v })}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(triggerTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {isAr ? label.ar : label.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{tAuto('auto.actionType')}</Label>
                  <Select
                    value={newAutomation.actionType}
                    onValueChange={(v) => setNewAutomation({ ...newAutomation, actionType: v })}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(actionTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {isAr ? label.ar : label.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => createMutation.mutate(newAutomation)}
                disabled={createMutation.isPending || !newAutomation.name}
                className="w-full bg-brand-navy-600 hover:bg-brand-navy-700 text-white h-10 rounded-lg shadow-sm shadow-brand-navy-500/20"
              >
                {createMutation.isPending ? (
                  <RotateCcw className="h-4 w-4 animate-spin me-2" />
                ) : null}
                {tAuto('auto.createAutomation')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.total')}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{automations.length}</p>
              </div>
              <div className="w-10 h-10 bg-brand-navy-100 dark:bg-brand-navy-900/30 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-brand-navy-600 dark:text-brand-navy-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{tAuto('auto.active')}</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{activeCount}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <Play className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.inactive')}</p>
                <p className="text-2xl font-bold text-slate-900/80 dark:text-white/80 tabular-nums">{inactiveCount}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                <Pause className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-violet-600 dark:text-violet-400">{tAuto('auto.totalRuns')}</p>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">{totalRuns}</p>
              </div>
              <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {tAuto('auto.activeRules')}
        </h2>
        {automations.map((automation) => {
          const statusInfo = statusLabels[automation.status] || statusLabels.INACTIVE;
          const isActive = automation.status === 'ACTIVE';
          return (
            <Card key={automation.id} className="border-slate-200 dark:border-slate-700/50 hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                      isActive ? 'bg-brand-navy-50 dark:bg-brand-navy-950' : 'bg-slate-100 dark:bg-slate-800'
                    )}>
                      <TriggerIcon type={automation.triggerType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{automation.name}</h3>
                        <Badge className={cn('text-[10px] h-5 px-1.5 border-0 font-medium flex items-center gap-1', statusInfo.color)}>
                          <StatusIcon status={automation.status} className="h-3 w-3" />
                          {isAr ? statusInfo.ar : statusInfo.en}
                        </Badge>
                      </div>
                      {automation.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{automation.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <div className="flex items-center gap-1.5">
                          <TriggerIcon type={automation.triggerType} />
                          <span className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.trigger')}</span>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {triggerTypeLabels[automation.triggerType]?.[isAr ? 'ar' : 'en'] || automation.triggerType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {actionTypeLabels[automation.actionType]?.[isAr ? 'ar' : 'en'] || automation.actionType}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Play className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{tAuto('auto.runs')}</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{automation.runCount}</span>
                        </div>
                        {automation.lastRunAt && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-400">
                              {new Date(automation.lastRunAt).toLocaleString(isAr ? 'ar-SA' : 'en-US')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleStatusMutation.mutate({
                        id: automation.id,
                        status: isActive ? 'INACTIVE' : 'ACTIVE',
                      })}
                      disabled={toggleStatusMutation.isPending}
                      className={cn(
                        'w-11 h-6 rounded-full transition-colors relative',
                        isActive ? 'bg-brand-navy-500' : 'bg-slate-300 dark:bg-slate-600'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all',
                        isActive
                          ? (isAr ? 'left-0.5' : 'right-0.5')
                          : (isAr ? 'right-0.5' : 'left-0.5')
                      )} />
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                      onClick={() => deleteMutation.mutate(automation.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Templates */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {tAuto('auto.readyTemplates')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template, index) => (
            <Card
              key={index}
              className="border-slate-200 dark:border-slate-700/50 hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer"
              onClick={() => {
                setNewAutomation({
                  name: isAr ? template.name.ar : template.name.en,
                  description: isAr ? template.description.ar : template.description.en,
                  triggerType: template.triggerType,
                  actionType: template.actionType,
                });
                setCreateDialogOpen(true);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <TemplateIcon icon={template.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                      {isAr ? template.name.ar : template.name.en}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {isAr ? template.description.ar : template.description.en}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {triggerTypeLabels[template.triggerType]?.[isAr ? 'ar' : 'en']}
                      </Badge>
                      <ArrowUpRight className="h-3 w-3 text-slate-400" />
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {actionTypeLabels[template.actionType]?.[isAr ? 'ar' : 'en']}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {automations.length === 0 && (
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {tAuto('auto.noAutomationsYet')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
              {tAuto('auto.createANewAutomationOrUseOneOfTheReadyMa')}
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {tAuto('auto.createAutomation')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
