"use client";


import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, FolderKanban, List,
  Sparkles, HardHat,
  CreditCard, FileText, Users, Shield,
  BarChart2, MapPin, Send, BookOpen,
  Calendar, BellRing, Activity, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavStore } from "@/store/nav-store";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BottomNavItem {
  pageId: string;
  icon: typeof LayoutDashboard;
  labelAr: string;
  labelEn: string;
}

interface MoreMenuItem {
  pageId: string;
  icon: typeof LayoutDashboard;
  labelAr: string;
  labelEn: string;
}

const bottomNavItems: BottomNavItem[] = [
  { pageId: "dashboard", icon: LayoutDashboard, labelAr: "الرئيسية", labelEn: "Home" },
  { pageId: "field-portal", icon: HardHat, labelAr: "الموقع", labelEn: "Site" },
  { pageId: "projects", icon: FolderKanban, labelAr: "المشاريع", labelEn: "Projects" },
  { pageId: "tasks", icon: List, labelAr: "المهام", labelEn: "Tasks" },
  { pageId: "ai-assistant", icon: Sparkles, labelAr: "المساعد الذكي", labelEn: "AI" },
];

const moreMenuItems: MoreMenuItem[] = [
  { pageId: "clients", icon: Users, labelAr: "العملاء", labelEn: "Clients" },
  { pageId: "contracts", icon: FileText, labelAr: "العقود", labelEn: "Contracts" },
  { pageId: "documents", icon: FileText, labelAr: "المستندات", labelEn: "Documents" },
  { pageId: "financial-invoices", icon: CreditCard, labelAr: "الفواتير", labelEn: "Invoices" },
  { pageId: "site-visits", icon: MapPin, labelAr: "زيارات الموقع", labelEn: "Site Visits" },
  { pageId: "site-diary", icon: BookOpen, labelAr: "اليومية الميدانية", labelEn: "Site Diary" },
  { pageId: "approvals", icon: Shield, labelAr: "الاعتمادات والموافقات", labelEn: "Approvals" },
  { pageId: "meetings", icon: Calendar, labelAr: "الاجتماعات", labelEn: "Meetings" },
  { pageId: "transmittals", icon: Send, labelAr: "الإحالات", labelEn: "Transmittals" },
  { pageId: "risks", icon: Shield, labelAr: "المخاطر", labelEn: "Risks" },
  { pageId: "reports", icon: BarChart2, labelAr: "التقارير", labelEn: "Reports" },
  { pageId: "notifications", icon: BellRing, labelAr: "الإشعارات", labelEn: "Notifications" },
  { pageId: "activity-log", icon: Activity, labelAr: "سجل النشاط", labelEn: "Activity Log" },
  { pageId: "calendar", icon: Calendar, labelAr: "التقويم", labelEn: "Calendar" },
  { pageId: "knowledge", icon: BookOpen, labelAr: "قاعدة المعرفة", labelEn: "Knowledge" },
  { pageId: "search", icon: Search, labelAr: "البحث", labelEn: "Search" },
  { pageId: "help", icon: BookOpen, labelAr: "المساعدة", labelEn: "Help" },
];

export default function MobileBottomNav({ language }: { language: "ar" | "en" }) {
  const tAuto = useTranslations();
  const isAr = language === "ar";
  const { currentPage, setCurrentPage } = useNavStore();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [pressedId, setPressedId] = useState<string | null>(null);

  // Refs for floating indicator positioning
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });

  // ─── Notification count via react-query ─────────────────────────
  const { data: notifData } = useQuery({
    queryKey: ["notification-count-mobile"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 60000,
  });
  const notifCount = notifData?.count ?? 0;

  // ─── Compute active index for the floating indicator ────────────
  const activeIndex = bottomNavItems.findIndex(
    (item) => currentPage === item.pageId || currentPage.startsWith(item.pageId + "-")
  );

  // ─── Sliding floating indicator ─────────────────────────────────
  const updateIndicator = useCallback(() => {
    if (!navRef.current || activeIndex === -1) return;
    const btn = buttonRefs.current.get(bottomNavItems[activeIndex]?.pageId ?? "");
    if (!btn) return;

    const navRect = navRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();

    setIndicatorStyle({
      left: btnRect.left - navRect.left + btnRect.width / 2,
      width: 24,
      opacity: 1,
    });
  }, [activeIndex]);

  useEffect(() => {
    // Small delay to let layout settle after render
    const timer = requestAnimationFrame(() => {
      updateIndicator();
    });
    return () => cancelAnimationFrame(timer);
  }, [activeIndex, updateIndicator]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => updateIndicator();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateIndicator]);

  // ─── Haptic-like tap feedback ───────────────────────────────────
  const handleNavClick = (pageId: string) => {
    setCurrentPage(pageId);
    setMoreSheetOpen(false);
  };

  const handlePointerDown = (pageId: string) => {
    setPressedId(pageId);
  };

  const handlePointerUp = () => {
    setPressedId(null);
  };

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 md:hidden",
          // Glassmorphism background
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl",
          // Top border with subtle gradient feel
          "border-t border-slate-200/60 dark:border-slate-700/60",
          // Enhanced shadow
          "shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Floating indicator bar at the top of the nav */}
        <div
          className="absolute top-0 h-[3px] pointer-events-none z-10"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: indicatorStyle.opacity,
            transform: "translateX(-50%)",
            transition: "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease, width 0.25s ease",
          }}
        >
          <div className="w-full h-full rounded-full bg-gradient-to-r from-brand-navy-400 via-brand-navy-500 to-emerald-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>

        <div ref={navRef} className="flex items-center justify-around px-1 py-1.5">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentPage === item.pageId ||
              currentPage.startsWith(item.pageId + "-");
            const isPressed = pressedId === item.pageId;

            return (
              <button
                key={item.pageId}
                ref={(el) => {
                  if (el) {
                    buttonRefs.current.set(item.pageId, el);
                  } else {
                    buttonRefs.current.delete(item.pageId);
                  }
                }}
                onClick={() => handleNavClick(item.pageId)}
                onPointerDown={() => handlePointerDown(item.pageId)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl relative min-w-[56px]",
                  // Haptic press animation
                  "transition-[transform,background-color,color] duration-200",
                  "active:scale-[0.88]",
                  isPressed && !isActive && "scale-[0.88]",
                  // Active pill background
                  isActive
                    ? "bg-brand-navy-50/80 dark:bg-brand-navy-900/25 text-brand-navy-600 dark:text-brand-navy-400"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400"
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-transform duration-300",
                      isActive && "scale-110"
                    )}
                  />
                  {/* Notification badge on dashboard icon */}
                  {item.pageId === "dashboard" && notifCount > 0 && (
                    <span
                      className={cn(
                        "absolute -top-1.5 -right-2 flex items-center justify-center",
                        "min-w-[16px] h-4 px-1 rounded-full",
                        "bg-red-500 text-white text-[9px] font-bold leading-none",
                        "ring-2 ring-white dark:ring-slate-900",
                        "animate-[badge-pulse_2s_ease-in-out_infinite]"
                      )}
                    >
                      {notifCount > 99 ? "99+" : notifCount}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight transition-all duration-200",
                    isActive && "font-semibold"
                  )}
                >
                  {isAr ? item.labelAr : item.labelEn}
                </span>
              </button>
            );
          })}

          {/* More button - opens Sheet */}
          <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
            <SheetTrigger asChild>
              <button
                onPointerDown={() => handlePointerDown("__more__")}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl relative min-w-[56px]",
                  "text-slate-400 dark:text-slate-500 transition-[transform] duration-200",
                  "active:scale-[0.88]",
                  pressedId === "__more__" && "scale-[0.88]"
                )}
              >
                <div className="grid grid-cols-3 grid-rows-2 gap-0.5 w-5 h-5">
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                </div>
                <span className="text-[10px] font-medium leading-tight">
                  {tAuto('auto.more')}
                </span>
              </button>
            </SheetTrigger>
            <SheetContent
              side={isAr ? "right" : "left"}
              className="w-72 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            >
              <SheetTitle className="sr-only">
                {tAuto('auto.moreOptions1')}
              </SheetTitle>
              <div className="flex items-center h-14 px-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {tAuto('auto.more')}
                </h3>
              </div>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <div className="p-2 space-y-1">
                  {moreMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.pageId;

                    return (
                      <button
                        key={item.pageId}
                        onClick={() => handleNavClick(item.pageId)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                          "active:scale-[0.97]",
                          isActive
                            ? "bg-brand-navy-500/10 text-brand-navy-600 dark:text-brand-navy-400 border border-brand-navy-500/20"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-medium">
                          {isAr ? item.labelAr : item.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Badge pulse keyframes (injected once) */}
      <style jsx global>{`
        @keyframes badge-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.15);
          }
        }
      `}</style>
    </>
  );
}
