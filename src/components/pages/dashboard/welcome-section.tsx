"use client";
 



import { useTranslations } from 'next-intl';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Plus, UserRoundPlus, HardHat } from "lucide-react";
import { formatToHijri } from "@/lib/hijri-utils";

interface WelcomeSectionProps {
  userName: string | undefined;
  alertsCount: number;
  isAr: boolean;
  onNavigate: (page: string) => void;
}

export function WelcomeSection({ userName, alertsCount, isAr, onNavigate }: WelcomeSectionProps) {
  const tAuto = useTranslations();
  // Defer date rendering to client to avoid hydration mismatch
  // Shows Hijri date alongside Gregorian in Arabic mode
  const [dateStr, setDateStr] = useState("");
  useEffect(() => {
    const now = new Date();
    const gregorian = now.toLocaleDateString(isAr ? "ar-AE" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (isAr) {
      try {
        const hijri = formatToHijri(now, { day: 'numeric', month: 'long', year: 'numeric', locale: 'ar' });
        setDateStr(`${gregorian} | ${hijri} هـ`);
      } catch {
        setDateStr(gregorian);
      }
    } else {
      setDateStr(gregorian);
    }
  }, [isAr]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isAr ? `مرحباً، ${userName || "مستخدم"}` : `Welcome, ${userName || "User"}`}
          </h2>
          {/* Notification Bell */}
          <button
            onClick={() => onNavigate("notifications")}
            className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600 flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 group"
            title={tAuto('auto.notifications')}
          >
            <Bell className="h-4 w-4 text-white" />
            <span className="absolute -top-1 -end-1 h-5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-white dark:ring-slate-900 shadow-sm">
              {alertsCount}
            </span>
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {tAuto('auto.hereSYourActivitySummaryAndKeyPerformanc')}
        </p>
        {/* Quick Create Buttons */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button
            onClick={() => onNavigate("field-portal")}
            size="sm"
            className="h-8 px-3 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm rounded-lg"
          >
            <HardHat className="h-3.5 w-3.5" />
            {isAr ? "بوابة الموقع الميدانية" : "Field Portal"}
          </Button>
          <Button
            onClick={() => onNavigate("clients")}
            size="sm"
            className="h-8 px-3 text-xs gap-1.5 bg-gradient-to-r from-brand-navy-500 to-brand-navy-600 hover:from-brand-navy-600 hover:to-brand-navy-700 text-white shadow-sm rounded-lg"
          >
            <UserRoundPlus className="h-3.5 w-3.5" />
            {tAuto('auto.newClient')}
          </Button>
          <Button
            onClick={() => onNavigate("projects")}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs gap-1.5 border-brand-navy-200 dark:border-brand-navy-800 text-brand-navy-700 dark:text-brand-navy-400 hover:bg-brand-navy-50 dark:hover:bg-brand-navy-950/30 rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" />
            {tAuto('auto.newProject')}
          </Button>
        </div>
      </div>
      {dateStr && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {dateStr}
        </p>
      )}
    </div>
  );
}
