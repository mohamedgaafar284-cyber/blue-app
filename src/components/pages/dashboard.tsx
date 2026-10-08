"use client";


import { useTranslations } from 'next-intl';
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { useNavStore } from "@/store/nav-store";
import { AlertCircle } from "lucide-react";
import { FolderKanban, Receipt, TrendingUp, CheckSquare } from "lucide-react";
import { useDashboardLayout, WidgetSlot, DashboardLayoutManager } from "@/components/pages/dashboard-layout-manager";
import dynamic from "next/dynamic";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { subMonths } from "date-fns";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";

import type { DashboardData, StatCardConfig } from "./dashboard/types";
import { formatCurrency, formatNumber } from "./dashboard/helpers";
import { getActivityFeed } from "./dashboard/activity-data";
import { getTeamPerformance } from "./dashboard/team-data";
import { DashboardSkeleton } from "./dashboard/dashboard-skeleton";
import { WidgetSkeleton } from "@/components/common/page-loading-skeleton";
import { MyTasksWidget } from "./dashboard/my-tasks-widget";
import { WelcomeSection } from "./dashboard/welcome-section";
import { StatCards } from "./dashboard/stat-cards";
import { QuickOverview } from "./dashboard/quick-overview";
import { SystemStatus } from "./dashboard/system-status";
import { RecentProjectsAlerts } from "./dashboard/recent-projects-alerts";
import { GanttTimeline } from "./dashboard/gantt-timeline";
import { DeadlinesTeam } from "./dashboard/deadlines-team";
import { ActivityFeed } from "./dashboard/activity-feed";
import { DeptWorkload } from "./dashboard/dept-workload";

const RevenueDepartment = dynamic(() => import("./dashboard/revenue-department").then(m => m.RevenueDepartment), { ssr: false, loading: () => <WidgetSkeleton /> });
const ChartsSection = dynamic(() => import("./dashboard/charts-section").then(m => m.ChartsSection), { ssr: false, loading: () => <WidgetSkeleton /> });
const ProjectHealthBudget = dynamic(() => import("./dashboard/project-health-budget").then(m => m.ProjectHealthBudget), { ssr: false, loading: () => <WidgetSkeleton /> });
import { FinancialHealthCard } from "./dashboard/financial-health-card";

// ===== Main Dashboard Component =====
export default function Dashboard({ language }: { language: "ar" | "en" }) {
  const tAuto = useTranslations();
  const isAr = language === "ar";
  const { user } = useAuthStore();
  const { setCurrentPage, setCurrentProjectId } = useNavStore();

  const layout = useDashboardLayout();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 1),
    to: new Date(),
  });

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["dashboard", dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from.toISOString());
      if (dateRange?.to) params.append("to", dateRange.to.toISOString());
      
      const res = await fetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <DashboardSkeleton isAr={isAr} />;

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {tAuto('auto.errorLoadingData')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {tAuto('auto.failedToLoadDashboardData')}
        </p>
      </div>
    );
  }

  const { stats, invoices, revenue, activeTasksCount, overdueTasksCount } = data;
  const recentProjects = Array.isArray(data?.recentProjects) ? data.recentProjects : [];
  const upcomingTasks = Array.isArray(data?.upcomingTasks) ? data.upcomingTasks : [];
  const departmentProgress = Array.isArray(data?.departmentProgress) ? data.departmentProgress : [];
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];

  // Use API data for activity feed and team performance (with mock fallback)
  const activities = getActivityFeed(data, isAr);
  const teamPerformance = getTeamPerformance(departmentProgress, isAr);

  // Project status pie chart data (derived from real API stats)
  const projectStatusData = [
    { name: tAuto('auto.active'), value: stats.activeProjects, color: "#0d9488" },
    { name: tAuto('auto.completed'), value: stats.completedProjects, color: "#10b981" },
    { name: tAuto('auto.delayed'), value: stats.delayedProjects, color: "#ef4444" },
    { name: tAuto('auto.onHold'), value: Math.max(0, stats.totalProjects - stats.activeProjects - stats.completedProjects - stats.delayedProjects), color: "#f59e0b" },
  ];

  // Task trend data from API
  const taskTrendData = (data?.taskTrend && data.taskTrend.length > 0)
    ? data.taskTrend.map(t => ({ month: isAr ? t.labelAr : t.labelEn, created: t.created, COMPLETED: t.completed }))
    : [];

  // Budget overview data from API
  const budgetOverviewData = (data?.budgetOverview && data.budgetOverview.length > 0)
    ? data.budgetOverview.map(p => ({ name: isAr ? p.name : (p.nameEn || p.name), budget: Number(p.budget) }))
    : [];

  const handleProjectClick = (projectId: string) => {
    setCurrentProjectId(projectId);
    setCurrentPage("projects");
  };

  // Stat cards config
  const statCards: StatCardConfig[] = [
    {
      label: tAuto('auto.totalProjects'),
      value: formatNumber(stats.totalProjects, language),
      icon: FolderKanban,
      gradientFrom: "from-brand-navy-500",
      gradientTo: "to-brand-navy-600",
      borderAccent: "border-s-brand-navy-500",
      bgColor: "bg-brand-navy-100 dark:bg-brand-navy-950/30",
      iconColor: "text-brand-navy-600 dark:text-brand-navy-400",
      trend: { value: stats.activeProjects, label: tAuto('auto.aCTIVE'), isPositive: true },
      secondaryBadge: stats.delayedProjects > 0 ? { value: stats.delayedProjects, label: tAuto('auto.dELAYED'), type: "danger" as const } : null,
    },
    {
      label: tAuto('auto.outstandingInvoices'),
      value: formatCurrency(invoices.outstandingTotal, language),
      valueSuffix: "AED",
      icon: Receipt,
      gradientFrom: "from-amber-500",
      gradientTo: "to-amber-600",
      borderAccent: "border-s-amber-500",
      bgColor: "bg-amber-100 dark:bg-amber-950/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      trend: invoices.overdueCount > 0 ? { value: invoices.overdueCount, label: tAuto('auto.oVERDUE'), isPositive: false } : null,
      secondaryBadge: null,
      valueSub: `(${invoices.outstandingCount})`,
    },
    {
      label: tAuto('auto.thisMonthRevenue'),
      value: formatCurrency(revenue.thisMonth, language),
      valueSuffix: "AED",
      icon: TrendingUp,
      gradientFrom: "from-emerald-500",
      gradientTo: "to-emerald-600",
      borderAccent: "border-s-emerald-500",
      bgColor: "bg-emerald-100 dark:bg-emerald-950/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      trend: revenue.change !== 0 ? { value: Math.abs(revenue.change), label: "%", isPositive: revenue.change > 0, showArrow: true } : null,
      secondaryBadge: null,
      valueSub: revenue.change !== 0 ? (tAuto('auto.vsLastMonth')) : undefined,
    },
    {
      label: tAuto('auto.upcomingTasks7Days'),
      value: formatNumber(activeTasksCount, language),
      icon: CheckSquare,
      gradientFrom: "from-blue-500",
      gradientTo: "to-blue-600",
      borderAccent: "border-s-blue-500",
      bgColor: "bg-blue-100 dark:bg-blue-950/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      trend: overdueTasksCount > 0 ? { value: overdueTasksCount, label: tAuto('auto.oVERDUE'), isPositive: false } : null,
      secondaryBadge: null,
    },
  ];

  // Department accent colors
  const deptAccents: Record<string, string> = {
    ARCHITECTURAL: "bg-brand-navy-500",
    STRUCTURAL: "bg-amber-500",
    MEP: "bg-violet-500",
  };

  return (
    <div className="space-y-6">
      {/* ===== Welcome Section with Notification Bell & Quick Create ===== */}
      <div id="tour-dashboard-overview" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <WelcomeSection
          userName={user?.name}
          alertsCount={alerts.length}
          isAr={isAr}
          onNavigate={setCurrentPage}
        />
        <DatePickerWithRange date={dateRange} setDate={setDateRange} isAr={isAr} />
      </div>

      {/* ===== Stats Cards ===== */}
      <DashboardLayoutManager layout={layout} language={language}>
      <WidgetSlot widgetId="kpi-cards" layout={layout} language={language}>
        <StatCards statCards={statCards} />
      </WidgetSlot>

      {/* ===== QW4: Real-time Financial Health Snapshot ===== */}
      <FinancialHealthCard language={language} />

      <WidgetSlot widgetId="quick-overview" layout={layout} language={language}>
        {/* ===== Quick Overview Strip ===== */}
        <QuickOverview
          stats={stats}
          overdueTasksCount={overdueTasksCount}
          invoices={invoices}
          upcomingTasks={upcomingTasks}
          isAr={isAr}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="revenue-chart" layout={layout} language={language}>
        {/* ===== Revenue Chart + Department Progress ===== */}
        <RevenueDepartment
          revenue={revenue}
          departmentProgress={departmentProgress}
          isAr={isAr}
          deptAccents={deptAccents}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="my-tasks" layout={layout} language={language}>
        {/* ===== My Tasks Widget ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Suspense fallback={<WidgetSkeleton />}>
              <MyTasksWidget language={language} />
            </Suspense>
          </div>

          {/* ===== System Status Widget ===== */}
          <Suspense fallback={<WidgetSkeleton />}>
            <SystemStatus isAr={isAr} />
          </Suspense>
        </div>
      </WidgetSlot>

      <WidgetSlot widgetId="recent-projects" layout={layout} language={language}>
        {/* ===== Recent Projects Table + Alerts ===== */}
        <RecentProjectsAlerts
          recentProjects={recentProjects}
          alerts={alerts}
          isAr={isAr}
          onProjectClick={handleProjectClick}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="gantt-timeline" layout={layout} language={language}>
        {/* ===== Project Gantt Timeline ===== */}
        <GanttTimeline
          recentProjects={recentProjects}
          isAr={isAr}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="deadlines-team" layout={layout} language={language}>
        {/* ===== Upcoming Deadlines + Team Performance ===== */}
        <DeadlinesTeam
          upcomingTasks={upcomingTasks}
          teamPerformance={teamPerformance}
          isAr={isAr}
          onProjectClick={handleProjectClick}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="activity-overview" layout={layout} language={language}>
        {/* ===== Recent Activity Feed + Quick Project Overview ===== */}
        <ActivityFeed
          activities={activities}
          recentProjects={recentProjects}
          isAr={isAr}
          onProjectClick={handleProjectClick}
          onNavigate={setCurrentPage}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="charts-section" layout={layout} language={language}>
        {/* ===== New Chart Sections ===== */}
        <ChartsSection
          projectStatusData={projectStatusData}
          taskTrendData={taskTrendData}
          stats={stats}
          isAr={isAr}
          language={language}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="dept-workload" layout={layout} language={language}>
        {/* ===== Department Workload Overview ===== */}
        <DeptWorkload
          departmentProgress={departmentProgress}
          stats={stats}
          activeTasksCount={activeTasksCount}
          overdueTasksCount={overdueTasksCount}
          invoices={invoices}
          isAr={isAr}
        />
      </WidgetSlot>

      <WidgetSlot widgetId="project-health" layout={layout} language={language}>
        {/* ===== Project Health Widget + Budget Overview ===== */}
        <ProjectHealthBudget
          budgetOverviewData={budgetOverviewData}
          language={language}
        />
      </WidgetSlot>

      </DashboardLayoutManager>
    </div>
  );
}
