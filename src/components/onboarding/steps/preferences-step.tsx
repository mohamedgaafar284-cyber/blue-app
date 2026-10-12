"use client";

import { useLanguage } from "@/hooks/use-lang";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Globe, Bell, Moon, Sun, Monitor } from "lucide-react";
import type { OnboardingPreferencesData } from "../types";

interface PreferencesStepProps {
  data: OnboardingPreferencesData;
  onChange: (data: Partial<OnboardingPreferencesData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function PreferencesStep({ data, onChange, onNext, onBack }: PreferencesStepProps) {
  const { t, isAr } = useLanguage();

  const themeOptions = [
    { value: "light", icon: Sun, ar: "فاتح", en: "Light" },
    { value: "dark", icon: Moon, ar: "داكن", en: "Dark" },
    { value: "system", icon: Monitor, ar: "تلقائي", en: "System" },
  ] as const;

  return (
    <div className="flex flex-col items-center px-4 sm:px-8 py-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-full bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center mx-auto mb-3">
          <Globe className="h-6 w-6 text-brand-navy-600 dark:text-brand-navy-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
          {t("تفضيلاتك", "Your Preferences")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t("خصص إعداداتك الأساسية", "Customize your basic settings")}
        </p>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Language */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("اللغة", "Language")}
          </Label>
          <Select
            value={data.language}
            onValueChange={(value) => onChange({ language: value as "ar" | "en" })}
          >
            <SelectTrigger className="w-full" aria-label={t("اختر اللغة", "Select language")}>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-slate-400" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30 flex items-center justify-center">
              <Bell className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("الإشعارات", "Notifications")}
              </p>
              <p className="text-xs text-slate-400">
                {t("تلقي تنبيهات بالمهام والمشاريع", "Receive alerts for tasks and projects")}
              </p>
            </div>
          </div>
          <Switch
            checked={data.notifications}
            onCheckedChange={(checked) => onChange({ notifications: checked })}
            aria-label={t("تفعيل الإشعارات", "Enable notifications")}
          />
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("المظهر", "Theme")}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = data.theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onChange({ theme: opt.value })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-navy-500 ${
                    isSelected
                      ? "border-brand-navy-500 bg-brand-navy-50 dark:bg-brand-navy-900/20"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                  aria-label={isAr ? opt.ar : opt.en}
                  aria-pressed={isSelected}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-brand-navy-600 dark:text-brand-navy-400" : "text-slate-400"}`} />
                  <span className={`text-xs font-medium ${isSelected ? "text-brand-navy-600 dark:text-brand-navy-400" : "text-slate-500"}`}>
                    {isAr ? opt.ar : opt.en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="w-full max-w-md mt-8 flex flex-col gap-2">
        <Button
          onClick={onNext}
          className="w-full h-11 bg-gradient-to-r from-brand-navy-500 to-cyan-600 hover:from-brand-navy-600 hover:to-cyan-700 text-white font-semibold rounded-xl"
          aria-label={t("التالي", "Next")}
        >
          {t("التالي", "Next")}
        </Button>
        <button
          onClick={onBack}
          className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-center py-2 transition-colors"
          aria-label={t("السابق", "Back")}
        >
          {t("السابق", "Back")}
        </button>
      </div>
    </div>
  );
}
