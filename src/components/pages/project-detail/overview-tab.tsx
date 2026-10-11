"use client";


import { useTranslations } from 'next-intl';
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Building2,
  HardHat,
  Zap,
  Users,
  Clock,
  Wallet,
  CalendarRange,
  Timer,
  Pencil,
  Plus,
  Star,
  Phone,
  ArrowUpRight,
  CheckCircle2,
  GitBranch,
  UsersRound,
  FileText,
  History,
  CreditCard,
  Receipt,
  PiggyBank,
  CheckSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { StatCard, DepartmentProgress } from "./helpers";
import { PIPELINE_STAGES } from "./constants";
import { getContractorCategoryLabel } from "./helpers";
import type { ProjectData } from "./types";

// ===== OVERVIEW TAB CONTENT =====
export default function OverviewTab({
  project,
  language,
  onViewAllDocuments,
}: {
  project: ProjectData;
  language: "ar" | "en";
  onViewAllDocuments?: () => void;
}) {
  const tAuto = useTranslations();
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const totalInvoiced = project?.invoices?.reduce((s, i) => s + Number(i.total), 0) || 0;
  const totalPaid = project?.invoices?.reduce((s, i) => s + Number(i.paidAmount), 0) || 0;

  // Real activities for this project
  const { data: projectActivities = [] } = useQuery<Array<{
    id: string;
    details: string;
    createdAt: string;
    user?: { name: string };
  }>>({
    queryKey: ["project-overview-activities", project.id],
    queryFn: async () => {
      const res = await fetch(`/api/activity-log?projectId=${project.id}&limit=5`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json;
    },
    staleTime: 60 * 1000,
  });

  // Real documents for this project
  const { data: projectDocuments = [] } = useQuery<Array<{
    id: string;
    name: string;
    fileSize?: number;
    createdAt: string;
  }>>({
    queryKey: ["project-overview-documents", project.id],
    queryFn: async () => {
      const res = await fetch(`/api/documents?projectId=${project.id}&limit=5`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json;
    },
    staleTime: 60 * 1000,
  });
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-navy-600 via-brand-navy-500 to-cyan-500 dark:from-brand-navy-800 dark:via-brand-navy-700 dark:to-cyan-700 p-6 md:p-8 text-white">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z'/%3E%3C/g%3E%3C/svg%3E")` 
        }} />
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              {/* Key Metrics Pills */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs">
                  <CalendarRange className="h-3 w-3" />
                  <span className="text-white/70">{t("البدء", "Start")}:</span>
                  <span className="font-semibold">
                    {project.startDate ? new Date(project.startDate).toLocaleDateString(isAr ? "ar-AE" : "en-US", { month: "short", day: "numeric" }) : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs">
                  <Timer className="h-3 w-3" />
                  <span className="text-white/70">{t("الانتهاء", "End")}:</span>
                  <span className="font-semibold">
                    {project.endDate ? new Date(project.endDate).toLocaleDateString(isAr ? "ar-AE" : "en-US", { month: "short", day: "numeric" }) : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs">
                  <Wallet className="h-3 w-3" />
                  <span className="text-mono font-semibold">{project.budget.toLocaleString()} {tAuto('auto.aED')}</span>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-white text-brand-navy-700 hover:bg-white/90 font-medium shadow-md">
                  <Pencil className="h-3.5 w-3.5" />
                  {t("تعديل المشروع", "Edit Project")}
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm">
                  <Plus className="h-3.5 w-3.5" />
                  {t("إضافة مهمة", "Add Task")}
                </Button>
              </div>
            </div>

            {/* Large Progress Ring */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                <svg width={120} height={120} className="transform -rotate-90">
                  <circle cx={60} cy={60} r={52} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={8} />
                  <circle
                    cx={60} cy={60} r={52} fill="none" stroke="#fff" strokeWidth={8}
                    strokeDasharray={52 * 2 * Math.PI}
                    strokeDashoffset={52 * 2 * Math.PI - (project.progress / 100) * 52 * 2 * Math.PI}
                    strokeLinecap="round" className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white tabular-nums">{Math.round(project.progress)}%</span>
                  <span className="text-[10px] text-white/60">{t("الإنجاز", "Progress")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={t("الميزانية", "Budget")}
          value={<>{project.budget.toLocaleString()} <span className="text-xs text-slate-400">AED</span></>}
          icon={PiggyBank}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          label={t("الفواتير", "Invoiced")}
          value={<>{totalInvoiced.toLocaleString()} <span className="text-xs text-slate-400">AED</span></>}
          icon={Receipt}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          label={t("المدفوع", "Paid")}
          value={<>{totalPaid.toLocaleString()} <span className="text-xs text-slate-400">AED</span></>}
          icon={CreditCard}
          color="bg-brand-navy-100 text-brand-navy-600 dark:bg-brand-navy-900/30 dark:text-brand-navy-400"
        />
        <StatCard
          label={t("المهام", "Tasks")}
          value={project.taskStats?.total || 0}
          icon={CheckSquare}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
      </div>

      {/* Department Progress */}
      {project.stages && project.stages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DepartmentProgress
            stages={project.stages}
            department="ARCHITECTURAL"
            language={language}
            label={t("القسم المعماري", "Architectural")}
            icon={Building2}
            accentColor="#133371"
          />
          <DepartmentProgress
            stages={project.stages}
            department="STRUCTURAL"
            language={language}
            label={t("القسم الإنشائي", "Structural")}
            icon={HardHat}
            accentColor="#f59e0b"
          />
          <DepartmentProgress
            stages={project.stages}
            department="MEP"
            language={language}
            label={t("الكهرباء والميكانيك", "MEP")}
            icon={Zap}
            accentColor="#3b82f6"
          />
        </div>
      )}



      {/* Time Remaining Card */}
      {project.endDate && (
        <Card className="border-slate-200 dark:border-slate-700/50" style={{ borderInlineStartWidth: "4px", borderInlineStartColor: project.endDate && new Date(project.endDate) < new Date() ? "#ef4444" : "#3b82f6" }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{t("الوقت المتبقي", "Time Remaining")}</h4>
                </div>
              </div>
              <span className={cn("text-lg font-bold", new Date(project.endDate) < new Date() ? "text-red-500" : "text-blue-600")}>
                {(() => {
                  const now = new Date();
                  const end = new Date(project.endDate!);
                  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysLeft < 0) return `${Math.abs(daysLeft)} ${t("يوم متأخر", "days overdue")}`;
                  return `${daysLeft} ${t("يوم", "days")}`;
                })()}
              </span>
            </div>
            <Progress
              value={(() => {
                if (!project.startDate || !project.endDate) return 0;
                const start = new Date(project.startDate).getTime();
                const end = new Date(project.endDate).getTime();
                const now = Date.now();
                if (now >= end) return 100;
                if (now <= start) return 0;
                return Math.round(((now - start) / (end - start)) * 100);
              })()}
              className="h-2 bg-slate-100 dark:bg-slate-800"
            />
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
              <span>{project.startDate ? new Date(project.startDate).toLocaleDateString(isAr ? "ar-AE" : "en-US", { month: "short", day: "numeric" }) : "—"}</span>
              <span>{project.endDate ? new Date(project.endDate).toLocaleDateString(isAr ? "ar-AE" : "en-US", { month: "short", day: "numeric" }) : "—"}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary Bar */}
      <Card className="border-slate-200 dark:border-slate-700/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{t("الملخص المالي", "Financial Summary")}</h4>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-6 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
              {project.budget > 0 && (
                <>
                  <div
                    className="bg-emerald-500 h-full flex items-center justify-center text-[9px] font-bold text-white transition-all"
                    style={{ width: `${Math.min((totalPaid / project.budget) * 100, 100)}%` }}
                    title={t("المدفوع", "Paid")}
                  >
                    {totalPaid > 0 && `${Math.round((totalPaid / project.budget) * 100)}%`}
                  </div>
                  <div
                    className="bg-blue-400 h-full flex items-center justify-center text-[9px] font-bold text-white transition-all"
                    style={{ width: `${Math.max(((totalInvoiced - totalPaid) / project.budget) * 100, 0)}%` }}
                    title={t("مستحق", "Invoiced")}
                  />
                  <div
                    className="bg-slate-200 dark:bg-slate-700 h-full flex-1"
                    title={t("متبقي", "Remaining")}
                  />
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-300" />
              <span className="text-slate-500">{t("قيمة العقد", "Contract")}: <span className="font-bold text-slate-900 dark:text-white">{project.budget.toLocaleString()} AED</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-500">{t("المدفوع", "Paid")}: <span className="font-bold text-emerald-600">{totalPaid.toLocaleString()} AED</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="text-slate-500">{t("مستحق", "Invoiced")}: <span className="font-bold text-blue-600">{totalInvoiced.toLocaleString()} AED</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="text-slate-500">{t("متبقي", "Remaining")}: <span className="font-bold text-slate-900 dark:text-white">{Math.max(project.budget - totalPaid, 0).toLocaleString()} AED</span></span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Client & Contractor & Project Info (Second Set) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client Info Card — Enhanced with clickable contacts */}
        <Card className="border-slate-200 dark:border-slate-700/50" style={{ borderInlineStartWidth: "4px", borderInlineStartColor: "#133371" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center">
                <Users className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400" />
              </div>
              <div>
                <span className="text-slate-900 dark:text-white">{t("العميل", "Client")}</span>
                <p className="text-[10px] text-slate-400 font-normal">{t("مالك المشروع", "Project Owner")}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{t("الاسم", "Name")}</span>
              <span className="font-medium text-slate-900 dark:text-white">{project.client?.name || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("الشركة", "Company")}</span>
              <span className="font-medium text-slate-900 dark:text-white">{project.client?.company || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{t("البريد", "Email")}</span>
              {project.client?.email ? (
                <a href={`mailto:${project.client.email}`} className="font-medium text-brand-navy-600 dark:text-brand-navy-400 hover:underline">{project.client.email}</a>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{t("الهاتف", "Phone")}</span>
              <div className="flex items-center gap-1">
                {project.client?.phone && (
                  <>
                    <a href={`tel:${project.client.phone}`} className="p-1 rounded-md hover:bg-brand-navy-50 dark:hover:bg-brand-navy-900/20 transition-colors" title={t("اتصال", "Call")}>
                      <Phone className="h-3.5 w-3.5 text-brand-navy-600 dark:text-brand-navy-400" />
                    </a>

                    <span className="font-medium text-slate-900 dark:text-white text-xs" dir="ltr">{project.client.phone}</span>
                  </>
                )}
                {!project.client?.phone && <span className="text-slate-400">—</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contractor Card — Executor (Enhanced) */}
        <Card className="border-slate-200 dark:border-slate-700/50" style={{ borderInlineStartWidth: "4px", borderInlineStartColor: "#f59e0b" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <HardHat className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <span className="text-slate-900 dark:text-white">{t("المقاول", "Contractor")}</span>
                <p className="text-[10px] text-slate-400 font-normal">{t("المنفذ للمشروع", "Project Executor")}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {project.contractor ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("الشركة", "Company")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{project.contractor.companyName || project.contractor.name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("جهة الاتصال", "Contact")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{project.contractor.contactPerson || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("التخصص", "Category")}</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{getContractorCategoryLabel(project.contractor.category, isAr)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{t("التقييم", "Rating")}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn("h-3 w-3", star <= (project.contractor?.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600")}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("السجل التجاري", "CR Number")}</span>
                  <span className="font-medium text-slate-900 dark:text-white" dir="ltr">{project.contractor.crNumber || "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{t("الهاتف", "Phone")}</span>
                  <div className="flex items-center gap-1">
                    {project.contractor.phone && (
                      <>
                        <a href={`tel:${project.contractor.phone}`} className="p-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                          <Phone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        </a>

                        <span className="font-medium text-slate-900 dark:text-white text-xs" dir="ltr">{project.contractor.phone}</span>
                      </>
                    )}
                    {!project.contractor.phone && <span className="text-slate-400">—</span>}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-2">
                  <HardHat className="h-5 w-5 text-amber-300 dark:text-amber-600" />
                </div>
                <p className="text-xs text-slate-400">{t("لم يتم تحديد مقاول", "No contractor assigned")}</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">{t("يمكنك تعيين مقاول من صفحة العطاءات", "Assign a contractor from the Bids page")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Info Card (Second) */}
        <Card className="border-slate-200 dark:border-slate-700/50" style={{ borderInlineStartWidth: "4px", borderInlineStartColor: "#3b82f6" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              {t("معلومات المشروع", "Project Info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">{t("رقم المشروع", "Project No.")}</span>
              <span className="font-medium text-slate-900 dark:text-white">#{project.number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("الموقع", "Location")}</span>
              <span className="font-medium text-slate-900 dark:text-white">{project.location || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("رقم القطعة", "Plot No.")}</span>
              <span className="font-medium text-slate-900 dark:text-white">{project.plotNumber || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{t("النوع", "Type")}</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {project.type === "VILLA" ? t("فيلا", "Villa") :
                 project.type === "BUILDING" ? t("مبنى", "Building") :
                 project.type === "COMMERCIAL" ? t("تجاري", "Commercial") :
                 t("صناعي", "Industrial")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visualization */}
      <Card className="border-slate-200 dark:border-slate-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-brand-navy-500" />
            {t("مراحل المشروع", "Project Lifecycle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center gap-0 min-w-max">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isActive = idx === Math.floor((project.progress / 100) * PIPELINE_STAGES.length);
                const isCompleted = idx < Math.floor((project.progress / 100) * PIPELINE_STAGES.length);
                return (
                  <div key={stage.key} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5 w-24">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        isCompleted ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
                        isActive ? "bg-brand-navy-500 text-white shadow-lg shadow-brand-navy-500/20 animate-pulse" :
                        "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      )}>
                        {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <stage.icon className="h-4 w-4" />}
                      </div>
                      <span className={cn("text-[10px] text-center font-medium", isActive || isCompleted ? "text-slate-900 dark:text-white" : "text-slate-400")}>
                        {isAr ? stage.labelAr : stage.labelEn}
                      </span>
                    </div>
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <div className={cn("w-8 h-1 rounded-full mx-1", isCompleted ? "bg-emerald-400" : "bg-slate-200 dark:bg-slate-700")} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team List with Status */}
      <Card className="border-slate-200 dark:border-slate-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-brand-navy-500" />
            {t("فريق العمل", "Project Team")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {project.assignments && project.assignments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {project.assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {(assignment.user?.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{assignment.user?.name || t("مستخدم", "User")}</p>
                    <p className="text-xs text-slate-500">{assignment.role || assignment.user?.position || t("عضو فريق", "Team Member")}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {t("نشط", "Active")}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              {t("لم يتم تعيين فريق لهذا المشروع بعد", "No team members assigned to this project yet")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Grid: Recent Updates + Quick Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Updates */}
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-blue-500" />
              {t("آخر التحديثات", "Recent Updates")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectActivities.length > 0 ? (
              <div className="space-y-3">
                {projectActivities.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300">{item.details}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.user?.name || t("مستخدم", "User")} · {new Date(item.createdAt).toLocaleDateString(isAr ? "ar-AE" : "en-US", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                {t("لا توجد تحديثات مسجلة مؤخراً", "No recent activity recorded")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Documents */}
        <Card className="border-slate-200 dark:border-slate-700/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                {t("مستندات سريعة", "Quick Documents")}
              </CardTitle>
              {onViewAllDocuments && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-brand-navy-600 hover:text-brand-navy-700 gap-1"
                  onClick={onViewAllDocuments}
                >
                  {t("عرض الكل", "View All")}
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {projectDocuments.length > 0 ? (
              <div className="space-y-2">
                {projectDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group cursor-pointer">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{doc.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : "—"} · {new Date(doc.createdAt).toLocaleDateString(isAr ? "ar-AE" : "en-US", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                {t("لا توجد مستندات مرفوعة لهذا المشروع", "No documents uploaded for this project")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
