"use client";


import { useTranslations } from 'next-intl';
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { defectSchema, getErrorMessage, type DefectFormData } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { getMutationHeaders } from "@/lib/csrf-client";
import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  AlertTriangle,
  Filter,
  Trash2,
  MoreHorizontal,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ===== Types =====
interface DefectItem {
  id: string;
  projectId: string;
  title: string;
  severity: string;
  location: string;
  photos: string;
  resolutionNotes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string; nameEn: string; number: string } | null;
  assignee: { id: string; name: string; email: string; avatar: string } | null;
}

interface ProjectOption { id: string; name: string; nameEn: string; number: string; }
interface UserOption { id: string; name: string; email: string; avatar: string; }

// ===== Helpers =====
function getSeverityConfig(severity: string) {
  const norm = (severity || "").toUpperCase();
  const configs: Record<string, { label: string; labelEn: string; color: string; gradient: string; borderColor: string; pulse: boolean }> = {
    LOW: { label: "منخفض", labelEn: "Low", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", gradient: "", borderColor: "border-s-slate-300 dark:border-s-slate-600", pulse: false },
    NORMAL: { label: "عادي", labelEn: "Normal", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", gradient: "", borderColor: "border-s-slate-300 dark:border-s-slate-600", pulse: false },
    MEDIUM: { label: "متوسط", labelEn: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", gradient: "from-amber-400 to-amber-500", borderColor: "border-s-amber-400", pulse: false },
    HIGH: { label: "عالي", labelEn: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300", gradient: "from-orange-400 to-red-500", borderColor: "border-s-orange-500", pulse: false },
    CRITICAL: { label: "حرج", labelEn: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300", gradient: "from-red-500 to-red-600", borderColor: "border-s-red-500", pulse: true },
  };
  return configs[norm] || configs.NORMAL;
}

function getStatusConfig(status: string) {
  const norm = (status || "").toUpperCase();
  const configs: Record<string, { label: string; labelEn: string; color: string }> = {
    OPEN: { label: "مفتوح", labelEn: "Open", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    IN_PROGRESS: { label: "قيد التنفيذ", labelEn: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" },
    RESOLVED: { label: "تم الحل", labelEn: "Resolved", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" },
  };
  return configs[norm] || configs.OPEN;
}

// ===== Main Component =====
interface DefectsProps { language: "ar" | "en"; projectId?: string; }

export default function Defects({ language, projectId }: DefectsProps) {
  const tAuto = useTranslations();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const toast = useToastFeedback({ ar });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const { data: defects = [], isLoading } = useQuery<DefectItem[]>({
    queryKey: ["defects", filterProject, filterSeverity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterProject !== "all") params.set("projectId", filterProject);
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      const res = await fetch(`/api/defects?${params}`);
      if (!res.ok) throw new Error("Failed to fetch defects");
      const json = await res.json(); return json.data || json;
    },
  });

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const res = await fetch("/api/projects-simple");
      if (!res.ok) return [];
      const json = await res.json(); return json.data || json;
    },
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await fetch("/api/users-simple");
      if (!res.ok) return [];
      const json = await res.json(); return json.data || json;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/defects", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create defect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      setShowAddDialog(false);
      resetForm();
      toast.created(tAuto('auto.defect'));
    },
    onError: () => {
      toast.error(tAuto('auto.createDefect'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/defects/${id}`, { method: "DELETE", headers: getMutationHeaders() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast.deleted(tAuto('auto.defect'));
    },
    onError: () => {
      toast.error(tAuto('auto.deleteDefect'));
    },
  });

  const defaultDefectForm = { projectId: projectId || "", title: "", severity: "NORMAL" as const, location: "", assigneeId: "", photos: "", notes: "" };
  const [_formData, setFormData] = useState(defaultDefectForm);

  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectSchema) as Resolver<DefectFormData>,
    defaultValues: defaultDefectForm,
  });
  const { register, handleSubmit: rhfHandleSubmit, formState: { errors }, reset, setValue, watch } = form;

  // Auto-set project filter from props
  useEffect(() => {
    if (projectId) {
      setFilterProject(projectId);
      setValue("projectId", projectId);
    }
  }, [projectId, setValue]);

  const resetForm = () => { const f = { ...defaultDefectForm, projectId: projectId || (filterProject !== "all" ? filterProject : "") }; setFormData(f); reset(f); };

  // Summary calculations
  const totalDefects = defects.length;
  const openCount = defects.filter((d) => (d.status || "").toUpperCase() === "OPEN").length;
  const inProgressCount = defects.filter((d) => (d.status || "").toUpperCase() === "IN_PROGRESS").length;
  const resolvedCount = defects.filter((d) => (d.status || "").toUpperCase() === "RESOLVED").length;
  const criticalCount = defects.filter((d) => (d.severity || "").toUpperCase() === "CRITICAL" && (d.status || "").toUpperCase() !== "RESOLVED").length;

  // Severity distribution
  const normalCount = defects.filter((d) => (d.severity || "").toUpperCase() === "NORMAL" || (d.severity || "").toUpperCase() === "LOW").length;
  const mediumCount = defects.filter((d) => (d.severity || "").toUpperCase() === "MEDIUM").length;
  const highCount = defects.filter((d) => (d.severity || "").toUpperCase() === "HIGH").length;
  const criticalTotal = defects.filter((d) => (d.severity || "").toUpperCase() === "CRITICAL").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center">
            <ShieldAlert className="h-4.5 w-4.5 text-brand-navy-600 dark:text-brand-navy-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{tAuto('auto.defects')}</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {defects.length} {tAuto('auto.defects1')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:ms-auto">
          {!projectId && (
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg">
              <Filter className="h-3 w-3 me-1 text-slate-400" />
              <SelectValue placeholder={tAuto('auto.project')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.allProjects')}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          )}
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-[130px] h-8 text-xs rounded-lg">
              <SelectValue placeholder={tAuto('auto.severity')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tAuto('auto.all')}</SelectItem>
              <SelectItem value="NORMAL">{tAuto('auto.normal')}</SelectItem>
              <SelectItem value="MEDIUM">{tAuto('auto.medium')}</SelectItem>
              <SelectItem value="HIGH">{tAuto('auto.high')}</SelectItem>
              <SelectItem value="CRITICAL">{tAuto('auto.critical')}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 bg-brand-navy-600 hover:bg-brand-navy-700 text-white rounded-lg shadow-sm shadow-brand-navy-600/20" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-3.5 w-3.5 me-1" />{tAuto('auto.newDefect')}
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Activity className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.totalDefects')}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{totalDefects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.open')}</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{openCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.inProgress')}</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{inProgressCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tAuto('auto.resolved')}</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{resolvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Distribution Mini Bar */}
      {totalDefects > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {tAuto('auto.severityDistribution')}
            </span>
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                {criticalCount} {tAuto('auto.activeCritical')}
              </span>
            )}
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            {normalCount > 0 && (
              <div className="bg-slate-400 dark:bg-slate-500 transition-all" style={{ width: `${(normalCount / totalDefects) * 100}%` }} />
            )}
            {mediumCount > 0 && (
              <div className="bg-amber-400 dark:bg-amber-500 transition-all" style={{ width: `${(mediumCount / totalDefects) * 100}%` }} />
            )}
            {highCount > 0 && (
              <div className="bg-orange-500 dark:bg-orange-600 transition-all" style={{ width: `${(highCount / totalDefects) * 100}%` }} />
            )}
            {criticalTotal > 0 && (
              <div className="bg-red-500 dark:bg-red-600 transition-all" style={{ width: `${(criticalTotal / totalDefects) * 100}%` }} />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-400" />{tAuto('auto.normal')} ({normalCount})</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-amber-400" />{tAuto('auto.medium')} ({mediumCount})</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-orange-500" />{tAuto('auto.high')} ({highCount})</span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-2 h-2 rounded-full bg-red-500" />{tAuto('auto.critical')} ({criticalTotal})</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">{tAuto('auto.loading')}</div>
        ) : defects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[30vh] text-center p-8">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{tAuto('auto.noDefects')}</h3>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-slate-50/80 dark:bg-slate-800/50">
                  <TableHead className="text-xs font-semibold">{tAuto('auto.title')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.project')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.severity')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.location')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.assignee')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.status1')}</TableHead>
                  <TableHead className="text-xs font-semibold">{tAuto('auto.date')}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.map((defect, _idx) => {
                  const sevCfg = getSeverityConfig(defect.severity);
                  const stCfg = getStatusConfig(defect.status);
                  return (
                    <TableRow key={defect.id} className={cn(
                      "group even:bg-slate-50/50 dark:even:bg-slate-800/20 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      sevCfg.gradient && defect.severity !== "RESOLVED" && "border-s-4",
                      sevCfg.gradient && defect.severity !== "RESOLVED" && sevCfg.borderColor,
                    )}>
                      <TableCell className="text-sm font-medium text-slate-900 dark:text-white max-w-[200px] truncate">{defect.title}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">{defect.project ? (ar ? defect.project.name : defect.project.nameEn || defect.project.name) : "-"}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border-s-2",
                          sevCfg.color,
                          sevCfg.gradient && `border-s-2 border-s-transparent bg-gradient-to-r ${sevCfg.gradient} bg-clip-text text-transparent`,
                        )}>
                          {sevCfg.gradient && (
                            <span className={cn("w-1.5 h-1.5 rounded-full bg-gradient-to-r flex-shrink-0", sevCfg.gradient)} />
                          )}
                          {sevCfg.gradient ? (
                            <span className="text-inherit" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }}>
                              {ar ? sevCfg.label : sevCfg.labelEn}
                            </span>
                          ) : (
                            <span>{ar ? sevCfg.label : sevCfg.labelEn}</span>
                          )}
                          {sevCfg.pulse && defect.status !== "RESOLVED" && (
                            <span className="relative flex h-1.5 w-1.5 ms-0.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-[120px] truncate">{defect.location || "-"}</TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">{defect.assignee?.name || "-"}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", stCfg.color)}>
                          {ar ? stCfg.label : stCfg.labelEn}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{new Date(defect.createdAt).toLocaleDateString(ar ? "ar-AE" : "en-US")}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="More options">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={ar ? "start" : "end"} className="w-36">
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400 focus:text-red-600"
                              onClick={() => { if (confirm(tAuto('auto.deleteThisDefect'))) deleteMutation.mutate(defect.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5 me-2" />{tAuto('auto.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tAuto('auto.newDefect')}</DialogTitle>
            <DialogDescription>{tAuto('auto.recordANewSiteDefect')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={rhfHandleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.title')} *</Label>
              <Input {...register("title")} placeholder={tAuto('auto.defectTitle')} className={cn(errors.title && "border-red-500")} />
              {errors.title && <p className="text-red-500 text-xs mt-1">{getErrorMessage(errors.title.message || "", ar)}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.project')} *</Label>
                {/* eslint-disable-next-line react-hooks/incompatible-library */}
                <Select value={watch("projectId")} onValueChange={(v) => setValue("projectId", v)}>
                  <SelectTrigger className={cn(errors.projectId && "border-red-500")}><SelectValue placeholder={tAuto('auto.selectProject')} /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{ar ? p.name : p.nameEn || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.projectId && <p className="text-red-500 text-xs mt-1">{getErrorMessage(errors.projectId.message || "", ar)}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.severity')}</Label>
                <Select value={watch("severity")} onValueChange={(v) => setValue("severity", v as DefectFormData["severity"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">{tAuto('auto.normal')}</SelectItem>
                    <SelectItem value="MEDIUM">{tAuto('auto.medium')}</SelectItem>
                    <SelectItem value="HIGH">{tAuto('auto.high')}</SelectItem>
                    <SelectItem value="CRITICAL">{tAuto('auto.critical')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.location')}</Label>
                <Input {...register("location")} placeholder={tAuto('auto.defectLocation')} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{tAuto('auto.assignee')}</Label>
                <Select value={watch("assigneeId")} onValueChange={(v) => setValue("assigneeId", v)}>
                  <SelectTrigger><SelectValue placeholder={tAuto('auto.selectAssignee')} /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.photosURLs')}</Label>
              <Input {...register("photos")} placeholder={tAuto('auto.commaSeparatedPhotoURLs')} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">{tAuto('auto.notes')}</Label>
              <Textarea {...register("notes")} placeholder={tAuto('auto.additionalNotes')} rows={3} />
            </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>{tAuto('auto.cancel')}</Button>
            <Button type="submit" className="bg-brand-navy-600 hover:bg-brand-navy-700 text-white" disabled={createMutation.isPending}>
              {createMutation.isPending ? (tAuto('auto.creating')) : (tAuto('auto.create'))}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
