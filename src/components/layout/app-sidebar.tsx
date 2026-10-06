"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { useNavStore } from "@/store/nav-store";
import { getNavItems, normalizeRole, roleLabelsAr, type NavItem, type Role } from "@/lib/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, FolderKanban, HardHat, Truck, Package, Warehouse,
  UsersRound, Clock, CalendarOff, BarChart3, ChevronDown, Activity, Sparkles,
  AlertTriangle, Shield, PenTool, Gavel, SearchCheck, ClipboardCheck, Gift,
  UserPlus, BookOpen, Plus, CheckCircle2, TrendingUp, TrendingDown, Wallet, Wind,
  Headphones, Calendar, BookMarked, Search, Bell, User, Settings,
  FolderTree, FileSpreadsheet, FileText, Target,
  type LucideIcon
} from "lucide-react";
import SidebarStats from "@/components/layout/sidebar-stats";
import LogoImage from "@/components/ui/logo-image";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";

// ===== ICON MAP =====
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  HardHat,
  Truck,
  Package,
  Warehouse,
  Settings,
  UsersRound,
  Clock,
  CalendarOff,
  BarChart3,
  Shield,
  Activity,
  Sparkles,
  AlertTriangle,
  Gavel,
  PenTool,
  Search,
  SearchCheck,
  ClipboardCheck,
  Gift,
  Bell,
  User,
  UserPlus,
  BookOpen,
  Plus,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Wind,
  Headphones,
  Calendar,
  BookMarked,
  FolderTree,
  FileSpreadsheet,
  FileText,
  Target,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || LayoutDashboard;
}

// ===== SIDEBAR QUICK STATS =====
function SidebarQuickStats() {
  const _locale = useLocale();
  const t = useTranslations("layout.sidebar");

  const { data } = useQuery({
    queryKey: ["sidebar-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard?statsOnly=true");
      if (!res.ok) return null;
      return res.json() as Promise<{ stats?: { activeProjects: number }; overdueTasksCount?: number } | null>;
    },
    refetchInterval: 60000,
  });

  const activeProjects = data?.stats?.activeProjects ?? 0;
  const overdueTasks = data?.overdueTasksCount ?? 0;

  return (
    <div className="px-2 py-2 space-y-2">
      <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-slate-50/60 dark:bg-slate-800/30">
        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-brand-navy-500" />
          {t("activeProjects")}
        </span>
        <span className="font-bold text-brand-navy-600 dark:text-brand-navy-400 tabular-nums">{activeProjects}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-slate-50/60 dark:bg-slate-800/30">
        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          {t("overdueTasks")}
        </span>
        <span className={`font-bold tabular-nums ${overdueTasks > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
          {overdueTasks}
        </span>
      </div>
    </div>
  );
}



// ===== NAV SECTION HELPERS =====
const MAIN_NAV_IDS = ["dashboard", "field-portal", "clients", "projects", "contractors"];
const BUSINESS_NAV_IDS = ["finance", "employees"];
const TOOLS_NAV_IDS = ["help", "features-hub"];
const SYSTEM_NAV_IDS = ["admin"];

function groupNavItems(items: NavItem[]) {
  return {
    main: items.filter((i) => MAIN_NAV_IDS.includes(i.id)),
    business: items.filter((i) => BUSINESS_NAV_IDS.includes(i.id)),
    tools: items.filter((i) => TOOLS_NAV_IDS.includes(i.id)),
    system: items.filter((i) => SYSTEM_NAV_IDS.includes(i.id)),
  };
}

// ===== SIDEBAR NAV COMPONENT =====
function AppSidebar() {
  const { user } = useAuthStore();
  const { currentPage, setCurrentPage } = useNavStore();
  const _locale = useLocale();
  const t = useTranslations("layout.sidebar");
  const tNav = useTranslations("navItems");
  const isAr = _locale === "ar";
  const [expandedItems, setExpandedItems] = useState<string[]>(["projects"]);
  const { state } = useSidebar();

  if (!user) return null;

  const navItems = getNavItems(user.role);
  const sidebarSide = isAr ? "right" : "left";
  const groups = groupNavItems(navItems);

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleNavClick = (item: NavItem) => {
    if (item.href) {
      // External navigation — open href in same tab
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = item.href;
    } else if (item.children && item.children.length > 0) {
      toggleExpanded(item.id);
    } else {
      setCurrentPage(item.id);
    }
  };

  // Reusable nav item renderer
  const renderNavItem = (item: NavItem) => {
    const Icon = getIcon(item.icon);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isActive = currentPage === item.id || item.children?.some((c) => currentPage === c.id);

    return (
      <SidebarMenuItem key={item.id}>
        {hasChildren ? (
          <>
            <SidebarMenuButton
              id={`tour-sidebar-${item.id}`}
              isActive={isActive}
              onClick={() => handleNavClick(item)}
              tooltip={tNav.has(`${item.id}.label`) ? tNav(`${item.id}.label`) : (isAr ? item.labelAr : item.labelEn)}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{tNav.has(`${item.id}.label`) ? tNav(`${item.id}.label`) : (isAr ? item.labelAr : item.labelEn)}</span>
              <ChevronDown
                className={cn(
                  "ms-auto h-4 w-4 shrink-0 transition-transform duration-200",
                  isExpanded && "rotate-180"
                )}
              />
            </SidebarMenuButton>
            {isExpanded && (
              <SidebarMenuSub>
                {item.children!.map((child) => {
                  const ChildIcon = getIcon(child.icon);
                  return (
                    <SidebarMenuSubItem key={child.id}>
                      <SidebarMenuSubButton
                        isActive={currentPage === child.id}
                        onClick={() => handleNavClick(child)}
                      >
                        <ChildIcon className="h-3.5 w-3.5" />
                        <span>{tNav.has(`${child.id}.label`) ? tNav(`${child.id}.label`) : (isAr ? child.labelAr : child.labelEn)}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            )}
          </>
        ) : (
          <SidebarMenuButton
            id={`tour-sidebar-${item.id}`}
            isActive={currentPage === item.id}
            onClick={() => setCurrentPage(item.id)}
            tooltip={tNav.has(`${item.id}.label`) ? tNav(`${item.id}.label`) : (isAr ? item.labelAr : item.labelEn)}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{tNav.has(`${item.id}.label`) ? tNav(`${item.id}.label`) : (isAr ? item.labelAr : item.labelEn)}</span>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar side={sidebarSide} collapsible="icon" className="border-slate-200/60 dark:border-slate-700/40 sidebar-enhanced">
      <SidebarHeader className="p-3 pb-2">
        <div className={cn(
          "flex items-center gap-3 px-2 py-1.5",
          state === "collapsed" && "justify-center px-0"
        )}>
          <LogoImage size={38} className="shrink-0 shadow-md shadow-brand-navy-500/20 rounded-lg" />
          {state !== "collapsed" && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                BluePrint
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-1">
                {t("subtitle")}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="mx-3 w-auto opacity-60" />

      <SidebarContent className="px-2 py-1.5">
        {/* Main Navigation */}
        {groups.main.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("groupMain")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {groups.main.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Business Management */}
        {groups.business.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("groupManagement")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {groups.business.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Tools & Help */}
        {groups.tools.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("groupTools")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {groups.tools.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System Admin */}
        {groups.system.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t("groupSystem")}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {groups.system.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 pt-1">
        {state !== "collapsed" && <SidebarQuickStats />}
        {state !== "collapsed" && <SidebarStats />}
        <Separator className="my-2 opacity-60" />
        <div className={cn(
          "sidebar-user-card flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-200",
          state === "collapsed" && "justify-center px-0 rounded-none"
        )}>
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-brand-navy-200/60 dark:ring-brand-navy-800/60">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="bg-brand-navy-100 dark:bg-brand-navy-900 text-brand-navy-700 dark:text-brand-navy-300 text-xs font-semibold">
              {user.name?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {state !== "collapsed" && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-none">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-none mt-0.5">
                {roleLabelsAr[normalizeRole(user.role) as Role] || user.role}
              </span>
            </div>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}


export { AppSidebar };