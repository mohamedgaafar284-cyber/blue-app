"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getMutationHeaders } from "@/lib/csrf-client";
import { useToastFeedback } from "@/hooks/use-toast-feedback";
import { Activity, Plus, Pencil, Trash2, Eye, ChevronDown, CalendarDays, Users, Clock, BarChart3, FolderKanban, CheckSquare, FileSignature, Receipt, FileText, Video, UserPlus, MessageSquare, Upload, ArrowUpDown, Filter, Loader2, Inbox, AlertCircle, RefreshCw, Search, Zap } from 'lucide-react'

interface Props {
  language: "ar" | "en";
  projectId?: string;
}

type _ActionType = "CREATE" | "UPDATE" | "DELETE" | "view" | "status_change" | "comment" | "upload";
type _EntityType = "project" | "task" | "contract" | "invoice" | "document" | "MEETING" | "client" | "employee";

interface ActivityItem {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  metadata?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    EMAIL: string;
    avatar: string;
    role: string;
  };
}

// ===== Avatar Colors =====
const avatarColors = [
  "bg-brand-navy-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-blue-500",
];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ===== Action Type Config =====
const actionConfig: Record<string, {
  icon: typeof Plus;
  color: string;
  bg: string;
  border: string;
  dot: string;
  dotGradient: string;
  ar: string;
  en: string;
}> = {
  CREATE: {
    icon: Plus,
    color: "text-brand-navy-600 dark:text-brand-navy-400",
    bg: "bg-brand-navy-50 dark:bg-brand-navy-900/30",
    border: "border-s-brand-navy-500",
    dot: "bg-brand-navy-500",
    dotGradient: "from-brand-navy-400 to-cyan-500",
    ar: "إنشاء",
    en: "Created",
  },
  UPDATE: {
    icon: Pencil,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
    border: "border-s-amber-500",
    dot: "bg-amber-500",
    dotGradient: "from-amber-400 to-orange-500",
    ar: "تحديث",
    en: "Updated",
  },
  DELETE: {
    icon: Trash2,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-s-red-500",
    dot: "bg-red-500",
    dotGradient: "from-red-400 to-rose-500",
    ar: "حذف",
    en: "Deleted",
  },
  view: {
    icon: Eye,
    color: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-800",
    border: "border-s-slate-400",
    dot: "bg-slate-400",
    dotGradient: "from-slate-300 to-slate-500",
    ar: "عرض",
    en: "Viewed",
  },
  status_change: {
    icon: ArrowUpDown,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30",
    border: "border-s-violet-500",
    dot: "bg-violet-500",
    dotGradient: "from-violet-400 to-purple-500",
    ar: "تغيير حالة",
    en: "Status Change",
  },
  comment: {
    icon: MessageSquare,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-900/30",
    border: "border-s-sky-500",
    dot: "bg-sky-500",
    dotGradient: "from-sky-400 to-blue-500",
    ar: "تعليق",
    en: "Commented",
  },
  upload: {
    icon: Upload,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    border: "border-s-emerald-500",
    dot: "bg-emerald-500",
    dotGradient: "from-emerald-400 to-brand-navy-500",
    ar: "رفع ملف",
    en: "Uploaded",
  },
};

// ===== Entity Type Config =====
const entityConfig: Record<string, {
  icon: typeof FolderKanban;
  ar: string;
  en: string;
}> = {
  project: { icon: FolderKanban, ar: "مشروع", en: "Project" },
  task: { icon: CheckSquare, ar: "مهمة", en: "Task" },
  contract: { icon: FileSignature, ar: "عقد", en: "Contract" },
  invoice: { icon: Receipt, ar: "فاتورة", en: "Invoice" },
  document: { icon: FileText, ar: "مستند", en: "Document" },
  MEETING: { icon: Video, ar: "اجتماع", en: "Meeting" },
  client: { icon: Users, ar: "عميل", en: "Client" },
  employee: { icon: UserPlus, ar: "موظف", en: "Employee" },
};



// ===== Animation Variants =====
const cardVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.35,
      ease: [0.21, 0.47, 0.32, 0.98] as [number, number, number, number],
    },
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

const loadMoreVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ===== Main Component =====
export default function ActivityLog({ language: lang, projectId }: Props) {
  const tAuto = useTranslations();
  const isAr = lang === "ar";
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(10);
  const queryClient = useQueryClient();
  const toastFeedback = useToastFeedback({ ar: isAr });

  // Fetch real activities from API with auto-refresh every 60 seconds
  const { data: apiActivities, isLoading } = useQuery<ActivityItem[]>({
    queryKey: ["activity-log", projectId, entityFilter, periodFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (entityFilter !== "all") params.set("entityType", entityFilter);
      if (periodFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.set("dateFrom", today.toISOString());
      } else if (periodFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.set("dateFrom", weekAgo.toISOString());
      } else if (periodFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        params.set("dateFrom", monthAgo.toISOString());
      }
      params.set("limit", "100");
      if (projectId) params.set("projectId", projectId);

      const res = await fetch(`/api/activity-log?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json(); return json.data || json;
    },
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  // Simulate Activity mutation
  const simulateMutation = useMutation({
    mutationFn: () =>
      fetch("/api/activity-log", {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify({ simulate: true }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-log"] });
      toastFeedback.showSuccess(
        tAuto('auto.activitySimulated'),
        tAuto('auto.randomActivityAddedToTheLog')
      );
    },
    onError: () => {
      toastFeedback.error(tAuto('auto.simulateActivity'));
    },
  });

  // Use real activities from API
  const activities: ActivityItem[] = Array.isArray(apiActivities) ? apiActivities : [];

  const filteredActivities = entityFilter === "all"
    ? activities
    : activities.filter((a) => a.entityType === entityFilter);

  const periodFiltered = periodFilter === "all"
    ? filteredActivities
    : filteredActivities.filter((a) => {
        const now = Date.now();
        const created = new Date(a.createdAt).getTime();
        if (periodFilter === "today") return now - created < 86400000;
        if (periodFilter === "week") return now - created < 7 * 86400000;
        if (periodFilter === "month") return now - created < 30 * 86400000;
        return true;
      });

  const visibleActivities = periodFiltered.slice(0, visibleCount);
  const hasMore = visibleCount < periodFiltered.length;

  // Compute stats
  const totalActivities = activities.length;
  const todayActivities = activities.filter((a) => Date.now() - new Date(a.createdAt).getTime() < 86400000).length;
  const weekActivities = activities.filter((a) => Date.now() - new Date(a.createdAt).getTime() < 7 * 86400000).length;
  const uniqueUsers = new Set(activities.map((a) => a.user?.name || a.userId)).size;

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return tAuto('auto.justNow');
    if (diffMin < 60) return isAr ? `منذ ${diffMin} دقيقة` : `${diffMin} min ago`;
    if (diffHours < 24) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    if (diffDays < 7) return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    return date.toLocaleDateString(isAr ? "ar-AE" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Entity type filter options
  const entityFilterOptions = [
    { key: "all", ar: "الكل", en: "All" },
    { key: "project", ar: "مشاريع", en: "Projects" },
    { key: "task", ar: "مهام", en: "Tasks" },
    { key: "contract", ar: "عقود", en: "Contracts" },
    { key: "invoice", ar: "فواتير", en: "Invoices" },
    { key: "document", ar: "مستندات", en: "Documents" },
    { key: "MEETING", ar: "اجتماعات", en: "Meetings" },
  ];

  // Period filter options
  const periodFilterOptions = [
    { key: "all", ar: "الكل", en: "All" },
    { key: "today", ar: "اليوم", en: "Today" },
    { key: "week", ar: "هذا الأسبوع", en: "This Week" },
    { key: "month", ar: "هذا الشهر", en: "This Month" },
  ];

  // Group by date for timeline
  const groupedByDate: Record<string, ActivityItem[]> = {};
  visibleActivities.forEach((item) => {
    const dateKey = new Date(item.createdAt).toLocaleDateString(isAr ? "ar-AE" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(item);
  });

  const dateKeys = Object.keys(groupedByDate);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-navy-500 to-cyan-600 flex items-center justify-center shadow-md shadow-brand-navy-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {tAuto('auto.activityLog')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {totalActivities} {tAuto('auto.activitiesRecorded')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Simulate Activity Button (Dev Mode) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => simulateMutation.mutate()}
            disabled={simulateMutation.isPending}
            className="gap-1.5 text-xs h-8 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          >
            {simulateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            {tAuto('auto.simulate')}
          </Button>

          <Badge
            variant="outline"
            className="w-fit gap-1.5 border-brand-navy-200 dark:border-brand-navy-800 text-brand-navy-600 dark:text-brand-navy-400 text-xs px-2.5 py-0.5"
          >
            <RefreshCw className="h-3 w-3" />
            {tAuto('auto.liveUpdates')}
          </Badge>
        </div>
      </div>

      {/* ===== Summary Stat Cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Activities */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0 }}
        >
          <Card className="relative overflow-hidden rounded-xl border-slate-200 dark:border-slate-700/50 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-500" />
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-slate-200/60 dark:bg-slate-700/50">
                <BarChart3 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {tAuto('auto.totalActivities')}
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{totalActivities}</p>
          </Card>
        </motion.div>

        {/* Today */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <Card className="relative overflow-hidden rounded-xl border-slate-200 dark:border-slate-700/50 bg-gradient-to-br from-brand-navy-50 to-cyan-50 dark:from-brand-navy-950/40 dark:to-cyan-950/30 p-4">
            <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-brand-navy-400 to-cyan-500 dark:from-brand-navy-600 dark:to-cyan-600" />
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-brand-navy-100/60 dark:bg-brand-navy-900/40">
                <Clock className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400" />
              </div>
              <span className="text-[11px] font-medium text-brand-navy-600 dark:text-brand-navy-400">
                {tAuto('auto.today')}
              </span>
            </div>
            <p className="text-2xl font-bold text-brand-navy-700 dark:text-brand-navy-300 tabular-nums">{todayActivities}</p>
          </Card>
        </motion.div>

        {/* This Week */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden rounded-xl border-slate-200 dark:border-slate-700/50 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/30 p-4">
            <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-sky-400 to-blue-500 dark:from-sky-600 dark:to-blue-600" />
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-sky-100/60 dark:bg-sky-900/40">
                <CalendarDays className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                {tAuto('auto.thisWeek')}
              </span>
            </div>
            <p className="text-2xl font-bold text-sky-700 dark:text-sky-300 tabular-nums">{weekActivities}</p>
          </Card>
        </motion.div>

        {/* Active Users */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <Card className="relative overflow-hidden rounded-xl border-slate-200 dark:border-slate-700/50 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/30 p-4">
            <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-500 dark:from-violet-600 dark:to-purple-600" />
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-violet-100/60 dark:bg-violet-900/40">
                <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-[11px] font-medium text-violet-600 dark:text-violet-400">
                {tAuto('auto.activeUsers')}
              </span>
            </div>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300 tabular-nums">{uniqueUsers}</p>
          </Card>
        </motion.div>
      </div>

      {/* ===== Filters ===== */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Entity Type Filter */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
          {entityFilterOptions.map((opt) => {
            const entityIcon = opt.key !== "all" ? entityConfig[opt.key]?.icon : Filter;
            const Icon = entityIcon || Filter;
            const isActive = entityFilter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { setEntityFilter(opt.key); setVisibleCount(10); }}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <Icon className={cn("h-3 w-3", isActive && "text-brand-navy-600 dark:text-brand-navy-400")} />
                {isAr ? opt.ar : opt.en}
              </button>
            );
          })}
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {periodFilterOptions.map((opt) => {
            const isActive = periodFilter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { setPeriodFilter(opt.key); setVisibleCount(10); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {isAr ? opt.ar : opt.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Activity Timeline ===== */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : periodFiltered.length === 0 ? (
        /* Empty State */
        <Card className="p-12 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {tAuto('auto.noActivitiesFound')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
            {tAuto('auto.noActivitiesMatchTheSelectedFiltersTryCh')}
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-brand-navy-400 to-cyan-500" />
              {tAuto('auto.create')}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
              {tAuto('auto.update')}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-red-400 to-rose-500" />
              {tAuto('auto.delete')}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-violet-400 to-purple-500" />
              {tAuto('auto.status1')}
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {dateKeys.map((dateKey) => {
              const items = groupedByDate[dateKey];
              const isExpanded = expandedDate === dateKey || dateKeys.length <= 2;

              return (
                <motion.div
                  key={dateKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-3 cursor-pointer group" onClick={() => setExpandedDate(isExpanded ? null : dateKey)}>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-1 rounded-full group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors">
                      {dateKey}
                      <span className="ms-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                        ({items.length} {tAuto('auto.activities')})
                      </span>
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                  </div>

                  {/* Timeline Items */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="relative ms-4"
                    >
                      {/* Timeline Line */}
                      <div className={cn(
                        "absolute top-0 bottom-0 w-px bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700",
                        isAr ? "right-[-16px]" : "left-[-16px]"
                      )} />

                      <div className="space-y-3">
                        {items.map((item, index) => {
                          const action = actionConfig[item.action] || actionConfig.view;
                          const entity = entityConfig[item.entityType] || { icon: AlertCircle, ar: item.entityType, en: item.entityType };
                          const ActionIcon = action.icon;
                          const EntityIcon = entity.icon;
                          const userName = item.user?.name || (tAuto('auto.user'));
                          const avatarColor = getAvatarColor(userName);
                          const avatarInitial = userName.charAt(0);

                          return (
                            <motion.div
                              key={item.id}
                              custom={index}
                              variants={cardVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className="relative"
                            >
                              {/* Timeline Dot with gradient */}
                              <div className={cn(
                                "absolute top-5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 z-10 bg-gradient-to-r",
                                action.dotGradient,
                                isAr ? "right-[-20px]" : "left-[-20px]"
                              )} />

                              {/* Activity Card */}
                              <Card className={cn(
                                "p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 transition-all duration-200 hover:shadow-md border-s-4",
                                action.border,
                                "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              )}>
                                <div className="flex items-start gap-3">
                                  {/* User Avatar */}
                                  <div className={cn(
                                    "h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm",
                                    avatarColor
                                  )}>
                                    {avatarInitial}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {userName}
                                      </span>
                                      <span className={cn(
                                        "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                                        action.bg,
                                        action.color
                                      )}>
                                        <ActionIcon className="h-2.5 w-2.5" />
                                        {isAr ? action.ar : action.en}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        <EntityIcon className="h-2.5 w-2.5" />
                                        {isAr ? entity.ar : entity.en}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                                      {item.details}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTimeAgo(item.createdAt)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Action Icon (right side) */}
                                  <div className={cn(
                                    "p-2 rounded-lg shrink-0",
                                    action.bg
                                  )}>
                                    <ActionIcon className={cn("h-4 w-4", action.color)} />
                                  </div>
                                </div>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Load More with smooth animation */}
          <AnimatePresence>
            {hasMore && (
              <motion.div
                variants={loadMoreVariants}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0 }}
                className="flex justify-center pt-2"
              >
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((prev) => prev + 10)}
                  className="gap-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-brand-navy-50 dark:hover:bg-brand-navy-900/20 hover:text-brand-navy-600 dark:hover:text-brand-navy-400 hover:border-brand-navy-200 dark:hover:border-brand-navy-800"
                >
                  <ChevronDown className="h-4 w-4" />
                  {tAuto('auto.loadMore')}
                  <Badge variant="secondary" className="h-4 min-w-[20px] px-1 text-[9px]">
                    {periodFiltered.length - visibleCount}
                  </Badge>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ===== Activity Types Legend ===== */}
      {!isLoading && periodFiltered.length > 0 && (
        <Card className="p-4 rounded-xl border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tAuto('auto.activityTypesLegend')}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(actionConfig).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full bg-gradient-to-r", config.dotGradient)} />
                  <Icon className={cn("h-3 w-3", config.color)} />
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isAr ? config.ar : config.en}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
