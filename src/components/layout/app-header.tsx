"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useNavStore } from "@/store/nav-store";
import { useLanguage } from "@/hooks/use-lang";
import { normalizeRole, roleLabelsAr, pageTitleMap, type Role } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Globe, Settings, LogOut, HelpCircle, ExternalLink } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import NotificationDropdown from "@/components/notification-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";



// ===== HEADER COMPONENT =====
function AppHeader() {
  const tAuto = useTranslations();
  const { user, logout } = useAuthStore();
  const { currentPage, setCurrentPage } = useNavStore();
  const locale = useLocale();
  const t = useTranslations("layout.header");
  const tTitle = useTranslations("pageTitles");
  const isAr = locale === "ar";
  const { toggleLanguage } = useLanguage();
  const [searchFocused, setSearchFocused] = useState(false);

  const pageTitle = pageTitleMap[currentPage] || { ar: "لوحة التحكم", en: "Dashboard" };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  // Trigger Command Palette via custom event or helper
  const triggerCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  };

  return (
    <header className="relative sticky top-[var(--demo-banner-height,0px)] z-30 flex h-14 items-center gap-3 border-b border-slate-200/60 dark:border-slate-700/40 bg-gradient-to-r from-white/90 via-white/85 to-brand-navy-50/80 dark:from-slate-900/90 dark:via-slate-900/85 dark:to-brand-navy-950/80 backdrop-blur-xl shadow-sm shadow-slate-200/30 dark:shadow-slate-900/30 px-4 lg:px-6">
      {/* Teal gradient accent line at top */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-navy-500 via-cyan-400 to-brand-navy-500 dark:from-brand-navy-400 dark:via-cyan-300 dark:to-brand-navy-400" />

      <SidebarTrigger className="-ms-1" aria-label={tAuto('auto.toggleSidebar')} />
      <Separator orientation="vertical" className="h-6" />

      {/* Page Title */}
      <h1 className="text-base font-semibold text-slate-900 dark:text-white flex-1 truncate">
        {tTitle.has(currentPage) ? tTitle(currentPage) : (isAr ? pageTitle.ar : pageTitle.en)}
      </h1>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {/* Search Bar - Desktop */}
                <button
          id="tour-header-search"
          onClick={triggerCommandPalette}
          type="button"
          className="hidden md:flex items-center relative rounded-lg border w-56 border-slate-200/80 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/40 hover:border-brand-navy-400/50 hover:bg-white dark:hover:bg-slate-800 px-3 h-9 text-xs text-slate-400 transition-all cursor-pointer"
        >
          <Search className="h-3.5 w-3.5 me-2 text-slate-400" />
          <span className="flex-1 text-start">{t("search")}</span>
          <kbd className="pointer-events-none inline-flex h-5 items-center rounded border px-1.5 font-mono text-[10px] font-medium border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
            Ctrl+K
          </kbd>
        </button>

        {/* Search Button - Mobile */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-all duration-200"
                onClick={triggerCommandPalette}
                aria-label={tAuto('auto.search')}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("searchBtn")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Language Toggle */}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 transition-all duration-200"
                onClick={toggleLanguage}
                aria-label={tAuto('auto.toggleLanguage')}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{locale === "ar" ? "English" : "عربي"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Theme Toggle */}
        <ThemeToggle label={t("darkMode")} />

        {/* Notifications Dropdown Bell */}
        <NotificationDropdown />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* User Dropdown with Online Indicator */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button id="tour-header-profile" variant="ghost" className="relative h-9 gap-2 px-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-200">
              <div className="relative">
                <Avatar className="h-7 w-7 ring-1 ring-slate-200/80 dark:ring-slate-700/60">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback className="bg-brand-navy-100 dark:bg-brand-navy-900 text-brand-navy-700 dark:text-brand-navy-300 text-xs font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                {/* Online status green dot */}
                <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </div>
              <span className="hidden md:block text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                {user?.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isAr ? "start" : "end"} className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Avatar className="h-10 w-10 ring-2 ring-brand-navy-200/40 dark:ring-brand-navy-800/40">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="bg-brand-navy-100 dark:bg-brand-navy-900 text-brand-navy-700 dark:text-brand-navy-300 text-sm font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {t("online")}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-2">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] font-medium bg-brand-navy-50 dark:bg-brand-navy-950/40 text-brand-navy-700 dark:text-brand-navy-400 hover:bg-brand-navy-100 dark:hover:bg-brand-navy-950/60 border-brand-navy-200/60 dark:border-brand-navy-800/40">
                {roleLabelsAr[normalizeRole(user?.role || '') as Role] || user?.role}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer font-sans" onClick={() => window.dispatchEvent(new CustomEvent('restart-blueprint-tour'))}>
              <HelpCircle className="me-2 h-4 w-4" />
              {t("restartTour")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => useNavStore.getState().setCurrentPage("settings")}>
              <Settings className="me-2 h-4 w-4" />
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => window.open("/", "_blank", "noopener,noreferrer")}>
              <ExternalLink className="me-2 h-4 w-4" />
              {isAr ? "زيارة الموقع الرئيسي" : "Visit Website"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600" onClick={handleLogout}>
              <LogOut className="me-2 h-4 w-4" />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}


export { AppHeader };