"use client";


import { useTranslations } from 'next-intl';
import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Palette,
  Bell,
  Shield,
  CreditCard,
} from "lucide-react";
import { getMutationHeaders } from "@/lib/csrf-client";
import { CompanyTab } from "./settings/company-tab";
import { AppearanceTab } from "./settings/appearance-tab";
import { NotificationsTab } from "./settings/notifications-tab";
import { SecurityTab } from "./settings/security-tab";
import { BillingTab } from "./settings/billing-tab";
import { setCachedCurrency } from "@/hooks/use-currency";

import { SettingsSkeleton } from "./settings/settings-skeleton";
import type { NotificationSettings, PasswordForm, DangerConfirmType } from "./settings/types";

interface Props {
  language: "ar" | "en";
}

export default function SettingsPage({ language: lang }: Props) {
  const tAuto = useTranslations();
  const isAr = lang === "ar";
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => fetch("/api/settings/company").then((r) => r.json()),
  });

  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [accentColor, setAccentColorLocal] = useState("teal");
  const [notifSettings, setNotifSettingsLocal] = useState<NotificationSettings>({
    projectUpdates: true,
    taskDeadlines: true,
    invoiceReminders: true,
    meetingReminders: true,
    siteVisitAlerts: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [accentSaving, setAccentSaving] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState<DangerConfirmType>("");
  const [dangerError, setDangerError] = useState("");
  const [dangerSuccess, setDangerSuccess] = useState("");
  const [_logoUploading, _setLogoUploading] = useState(false);
  const [_logoPreview, _setLogoPreview] = useState<string | null>(null);
  const _fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user preferences (accent color, notification settings)
  const { data: preferences } = useQuery({
    queryKey: ["user-preferences"],
    queryFn: () => fetch("/api/settings/preferences").then((r) => r.json()),
  });

  // Initialize preferences when loaded
  useEffect(() => {
    if (preferences) {
      setAccentColorLocal(preferences.accentColor || "teal");
      if (preferences.notifications) {
        setNotifSettingsLocal((prev) => ({ ...prev, ...preferences.notifications }));
      }
    }
  }, [preferences]);

  // Fetch current session info
  const { data: sessionData } = useQuery({
    queryKey: ["auth-session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
  });

  // Save accent color to server
  const saveAccentColor = useCallback(async (color: string) => {
    setAccentSaving(true);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({ accentColor: color }),
      });
      if (!res.ok) {
        const _data = await res.json();
      }
    } catch {
      // Error already shown via UI
    } finally {
      setAccentSaving(false);
    }
  }, []);

  // Save notification settings to server
  const saveNotifSettings = useCallback(async (settings: Record<string, boolean>) => {
    setNotifSaving(true);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({ notifications: settings }),
      });
      if (!res.ok) {
        const _data = await res.json();
      }
    } catch {
      // Error already shown via UI
    } finally {
      setNotifSaving(false);
    }
  }, []);

  // Handle accent color change
  const handleAccentColorChange = useCallback((color: string) => {
    setAccentColorLocal(color);
    saveAccentColor(color);
  }, [saveAccentColor]);

  // Handle notification toggle
  const handleNotifToggle = useCallback((key: string, checked: boolean) => {
    setNotifSettingsLocal((prev) => {
      const updated = { ...prev, [key]: checked };
      saveNotifSettings(updated);
      return updated;
    });
  }, [saveNotifSettings]);

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name || "",
        nameEn: settings.nameEn || "",
        email: settings.email || "",
        phone: settings.phone || "",
        address: settings.address || "",
        taxNumber: settings.taxNumber || "",
        currency: settings.currency || "AED",
        timezone: settings.timezone || "Asia/Dubai",
        workingHours: settings.workingHours || "08:00-17:00",
      });
      setWorkingDays((settings.workingDays || "").split(",").filter(Boolean));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch("/api/settings/company", {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (formData.currency) {
        setCachedCurrency(String(formData.currency));
      }
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setSaved(true);
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      setSaving(false);
    },
  });

  const handleSave = () => {
    setSaving(true);
    updateMutation.mutate({
      ...formData,
      workingDays: workingDays.join(","),
    });
  };

  const toggleWorkingDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const updateField = (key: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Tabs defaultValue="COMPANY" dir={isAr ? "rtl" : "ltr"} className="w-full">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 gap-1 h-auto p-1 bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="COMPANY" className="text-xs px-2 py-2.5 gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tAuto('auto.company')}</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs px-2 py-2.5 gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tAuto('auto.theme')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs px-2 py-2.5 gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tAuto('auto.alerts')}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs px-2 py-2.5 gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tAuto('auto.security')}</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="text-xs px-2 py-2.5 gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tAuto('auto.billing')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Company Info Tab */}
        <TabsContent value="COMPANY" className="mt-4">
          <CompanyTab
            isAr={isAr}
            formData={formData}
            settings={settings}
            workingDays={workingDays}
            saving={saving}
            saved={saved}
            logoUploading={_logoUploading}
            logoPreview={_logoPreview}
            updateField={updateField}
            toggleWorkingDay={toggleWorkingDay}
            handleSave={handleSave}
          />
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-4">
          <AppearanceTab
            isAr={isAr}
            accentColor={accentColor}
            accentSaving={accentSaving}
            handleAccentColorChange={handleAccentColorChange}
          />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab
            isAr={isAr}
            notifSettings={notifSettings}
            notifSaving={notifSaving}
            handleNotifToggle={handleNotifToggle}
          />
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-4">
          <SecurityTab
            isAr={isAr}
            passwordForm={passwordForm}
            setPasswordForm={setPasswordForm}
            passwordSaving={passwordSaving}
            passwordError={passwordError}
            passwordSuccess={passwordSuccess}
            setPasswordError={setPasswordError}
            setPasswordSuccess={setPasswordSuccess}
            setPasswordSaving={setPasswordSaving}
            dangerConfirm={dangerConfirm}
            setDangerConfirm={setDangerConfirm}
            dangerError={dangerError}
            setDangerError={setDangerError}
            dangerSuccess={dangerSuccess}
            setDangerSuccess={setDangerSuccess}
            sessionData={sessionData}
          />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="mt-4">
          <BillingTab isAr={isAr} />
        </TabsContent>


      </Tabs>
    </div>
  );
}
