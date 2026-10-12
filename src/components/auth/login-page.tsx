"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  Loader2,
  Eye,
  EyeOff,
  Languages,
  FolderKanban,
  ListChecks,
  BarChart3,
  Users,
  Mail,
  Lock,
  ChevronLeft,
  ArrowRight,
  Home,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useToast } from "@/hooks/use-toast";
import LogoImage from "@/components/ui/logo-image";
import { cn } from "@/lib/utils";
import { SkipNavContent } from "@/components/common/accessible-components";
import { extractErrorMessage } from "@/lib/api/fetch-client";
import GoogleLoginButton from "@/components/auth/google-login-button";
import TurnstileCaptcha from "@/components/auth/turnstile-captcha";
import { useTranslations, useLocale } from "next-intl";

interface LoginPageProps {
  language?: "ar" | "en";
}

// DEMO ONLY — these demo emails are shown for demo mode testing only
const ROLES = [
  { value: "admin@blueprint.ae", labelAr: "المدير العام", labelEn: "Admin" },
  { value: "pm@blueprint.ae", labelAr: "مدير مشاريع", labelEn: "Manager" },
  { value: "eng@blueprint.ae", labelAr: "مهندس معماري", labelEn: "Arch. Eng" },
  { value: "struct@blueprint.ae", labelAr: "مهندس إنشائي", labelEn: "Struct. Eng" },
  { value: "elec@blueprint.ae", labelAr: "مهندس كهربائي", labelEn: "Elec. Eng" },
  { value: "site@blueprint.ae", labelAr: "مهندس موقع", labelEn: "Site Eng" },
  { value: "mep@blueprint.ae", labelAr: "مهندس ميكانيكا", labelEn: "MEP Eng" },
  { value: "draft@blueprint.ae", labelAr: "رسام", labelEn: "Draftsman" },
  { value: "acc@blueprint.ae", labelAr: "محاسب", labelEn: "Accountant" },
  { value: "sec@blueprint.ae", labelAr: "سكرتيرة", labelEn: "Secretary" },
  { value: "hr@blueprint.ae", labelAr: "موارد بشرية", labelEn: "HR" },
  { value: "viewer@blueprint.ae", labelAr: "مشاهد", labelEn: "Viewer" },
];

// SECURITY: Demo passwords are NEVER included in the client bundle.
// Demo credentials are fetched from the server API only when DEMO_MODE=true.

const FEATURES = [
  {
    icon: FolderKanban,
    titleAr: "إدارة المشاريع المتقدمة",
    titleEn: "Advanced Project Management",
    descAr: "تتبع المشاريع والمراحل والمواعيد النهائية",
    descEn: "Track projects, stages, and deadlines",
  },
  {
    icon: ListChecks,
    titleAr: "تتبع المهام الذكي",
    titleEn: "Smart Task Tracking",
    descAr: "لوحة كانبان مع أولويات وSLA",
    descEn: "Kanban board with priorities & SLA",
  },
  {
    icon: BarChart3,
    titleAr: "التقارير والتحليلات",
    titleEn: "Reports & Analytics",
    descAr: "تقارير مالية وتقارير المشاريع والإنتاجية",
    descEn: "Financial, project & productivity reports",
  },
  {
    icon: Users,
    titleAr: "إدارة الفرق والموارد",
    titleEn: "Team & Resource Management",
    descAr: "الحضور والإجازات وأحمال العمل",
    descEn: "Attendance, leave & workload tracking",
  },
];

interface DemoCredential {
  email: string;
  password: string;
  role: string;
  labelAr: string;
  labelEn: string;
}

export default function LoginPage({ language: _language }: LoginPageProps) {
  const tAuto = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [demoCredentials, setDemoCredentials] = useState<DemoCredential[]>([]);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [requires2FA, setRequires2FA] = useState(false);
  const [showGoogleButton, setShowGoogleButton] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const router = useRouter();

  // First-run detection: with an EMPTY database the login form can never
  // succeed — instead of a dead end, send the user to the setup wizard so a
  // non-technical owner can create the first ADMIN account from the browser.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/setup-status', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { setupNeeded: false }))
      .then((data) => {
        if (data.setupNeeded) {
          setSetupNeeded(true);
          router.replace('/setup');
        }
      })
      .catch(() => {
        /* DB/app unreachable — leave the login form as-is */
      });
    return () => controller.abort();
  }, [router]);

  // Read env var after hydration to avoid SSR mismatch
  useEffect(() => {
    setShowGoogleButton(!!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  }, []);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const { login } = useAuthStore();
  const { toast: _toast } = useToast();

  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("login");

  // Fetch demo credentials from server (only returned in demo mode)
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/demo-credentials', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { credentials: [] }))
      .then((data) => {
        if (Array.isArray(data.credentials)) {
          setDemoCredentials(data.credentials);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // Not in demo mode or fetch failed — no credentials available
        }
      });
    return () => controller.abort();
  }, []);

  // Rotate feature highlights every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFeatureIndex((prev) => (prev + 1) % FEATURES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");

    // Verify captcha on server if a token was collected (i.e. Turnstile is configured)
    if (captchaToken && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      try {
        const verifyRes = await fetch("/api/auth/verify-turnstile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: captchaToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setError(t("errors.captchaFailedRetry"));
          return;
        }
      } catch {
        setError(t("errors.captchaFailed"));
        return;
      }
    } else if (!captchaToken && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      // Turnstile is configured but user hasn't completed captcha
      setError(t("errors.captchaRequired"));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(extractErrorMessage(data.error, t("errors.generic")));
        return;
      }

      if (data.requires2FA) {
        setRequires2FA(true);
        return;
      }

      login({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        avatar: data.avatar,
      });

      // Navigate to dashboard
      window.location.href = "/dashboard";
    } catch {
      setError(t("errors.connection"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFactorCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(extractErrorMessage(data.error, t("errors.invalidCode")));
        return;
      }
      const userData = data.data?.user || data;
      login({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        avatar: userData.avatar,
      });

      window.location.href = "/dashboard";
    } catch {
      setError(t("errors.connection"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requires2FA) {
      await handleVerify2FA(e);
    } else {
      await handleLogin(email, password);
    }
  };

  const handleRoleSelect = async (value: string) => {
    setSelectedRole(value);
    setEmail(value);
    // Auto-fill demo password if available (dev/demo mode only)
    let creds = demoCredentials;
    // If credentials haven't loaded yet, fetch them now
    if (creds.length === 0) {
      try {
        const res = await fetch('/api/auth/demo-credentials');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.credentials) && data.credentials.length > 0) {
            creds = data.credentials;
            setDemoCredentials(creds);
          }
        }
      } catch { /* ignore */ }
    }
    // Use server-provided credentials only
    const cred = creds.find((c) => c.email === value);
    if (cred && cred.password) {
      setPassword(cred.password);
      setShowPassword(true); // Auto-show password in demo mode for clarity
    } else {
      setPassword("");
      setShowPassword(false);
    }
  };

  const handleForgotPassword = () => {
    // Navigate to the forgot-password page
    window.location.href = '/forgot-password';
  };

  const toggleLanguage = () => {
    const newLang = isAr ? "en" : "ar";
    localStorage.setItem("blueprint-lang", newLang);
    document.cookie = `blueprint-lang=${newLang}; path=/; max-age=31536000`;
    document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = newLang;
    window.dispatchEvent(new Event("blueprint-lang-change"));
  };

  return (
    <div
      className="min-h-screen flex bg-white dark:bg-slate-950"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* ===== Branded Panel (hidden on mobile, visible on lg+) ===== */}
      <div className="hidden lg:flex lg:w-[520px] xl:w-[580px] relative overflow-hidden bg-gradient-to-br from-brand-navy-600 via-brand-navy-500 to-cyan-500">
        {/* Animated background pattern */}
        <div className="absolute inset-0">
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.08]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="login-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#login-grid)" />
          </svg>

          {/* Decorative circles */}
          <div className="absolute -top-24 -start-24 w-72 h-72 rounded-full border border-white/10" />
          <div className="absolute top-1/3 -end-32 w-96 h-96 rounded-full border border-white/5" />
          <div className="absolute -bottom-16 start-1/4 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute top-1/4 end-1/4 w-48 h-48 rounded-full bg-cyan-400/10 blur-3xl" />

          {/* Compass Rose */}
          <svg
            className="absolute top-8 end-8 w-32 h-32 opacity-[0.1]"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="0.5" />
            <circle cx="100" cy="100" r="60" stroke="white" strokeWidth="0.3" />
            <circle cx="100" cy="100" r="40" stroke="white" strokeWidth="0.2" />
            <line x1="100" y1="20" x2="100" y2="180" stroke="white" strokeWidth="0.3" />
            <line x1="20" y1="100" x2="180" y2="100" stroke="white" strokeWidth="0.3" />
            <line x1="40" y1="40" x2="160" y2="160" stroke="white" strokeWidth="0.3" />
            <line x1="160" y1="40" x2="40" y2="160" stroke="white" strokeWidth="0.3" />
          </svg>

          {/* UAE / Engineering decorative element */}
          <svg
            className="absolute bottom-12 end-12 w-24 h-24 opacity-[0.08]"
            viewBox="0 0 100 100"
            fill="none"
          >
            <rect x="10" y="60" width="80" height="30" rx="2" stroke="white" strokeWidth="0.8" />
            <path d="M10 60 L50 20 L90 60" stroke="white" strokeWidth="0.8" fill="none" />
            <line x1="30" y1="40" x2="30" y2="60" stroke="white" strokeWidth="0.5" />
            <line x1="50" y1="20" x2="50" y2="60" stroke="white" strokeWidth="0.5" />
            <line x1="70" y1="40" x2="70" y2="60" stroke="white" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Logo & Brand */}
          <div className="animate-fade-in">
            <Link href="/" className="inline-flex items-center gap-3 mb-2 group hover:opacity-95 transition-opacity" title={isAr ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}>
              <LogoImage size={48} className="border border-white/40 group-hover:scale-105 transition-transform" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  BluePrint
                </h1>
                <p className="text-[11px] text-white/60 font-medium">
                  {t("subtitle")}
                </p>
              </div>
            </Link>
          </div>

          {/* Feature Highlights - Center */}
          <div className="flex-1 flex items-center">
            <div className="w-full space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-white/80 font-medium">
                    {t("systemFeatures")}
                  </span>
                </div>

                <div className="space-y-4">
                  {FEATURES.map((feat, idx) => {
                    const FeatIcon = feat.icon;
                    const isActive = idx === featureIndex;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-4 transition-all duration-500",
                          isActive
                            ? "opacity-100 translate-y-0"
                            : "opacity-30 translate-y-1"
                        )}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500",
                            isActive
                              ? "bg-white/20 backdrop-blur-sm border border-white/20"
                              : "bg-white/5 border border-transparent"
                          )}
                        >
                          <FeatIcon className={cn(
                            "w-5 h-5 transition-all duration-500",
                            isActive ? "text-white" : "text-white/40"
                          )} />
                        </div>
                        <div className="pt-1.5">
                          <h3 className={cn(
                            "text-sm font-semibold transition-all duration-500",
                            isActive ? "text-white" : "text-white/40"
                          )}>
                            {isAr ? feat.titleAr : feat.titleEn}
                          </h3>
                          {isActive && (
                            <p className="text-xs text-white/60 mt-1 animate-fade-in">
                              {isAr ? feat.descAr : feat.descEn}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Feature indicator dots */}
              <div className="flex items-center gap-2 pt-2">
                {FEATURES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFeatureIndex(idx)}
                    className={cn(
                      "rounded-full transition-all duration-300 cursor-pointer",
                      idx === featureIndex
                        ? "w-6 h-2 bg-white"
                        : "w-2 h-2 bg-white/30 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom tagline */}
          <div className="animate-fade-in">
            <p className="text-xs text-white/40 leading-relaxed">
              {t("tagline")}
            </p>
            <p className="text-[11px] text-white/25 mt-2">
              © 2025 BluePrint
            </p>
          </div>
        </div>
      </div>

      {/* ===== Login Form Side ===== */}
      <div className="flex-1 flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <SkipNavContent />
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-6">
          <div className="w-full max-w-sm animate-fade-in">
            {/* ===== Login Card with Animated Gradient Border + Frosted Glass ===== */}
            <div className="login-gradient-border rounded-2xl">
              <div className="rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 sm:p-8 space-y-5 shadow-xl shadow-slate-900/5 dark:shadow-black/20">
                {/* Back to Home Link */}
                <div className="flex items-center justify-between pb-1">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-navy-600 dark:text-slate-400 dark:hover:text-cyan-400 transition-colors group"
                  >
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5 transition-transform" />
                    <span>{isAr ? "العودة إلى الموقع الرئيسي" : "Back to Home"}</span>
                  </Link>
                  <Link
                    href="/"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={isAr ? "الصفحة الرئيسية" : "Home"}
                  >
                    <Home className="h-4 w-4" />
                  </Link>
                </div>

                {/* Logo for mobile / top branding */}
                <div className="text-center space-y-3">
                  <Link href="/" className="inline-flex relative group" title={isAr ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}>
                    <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-navy-500 to-cyan-500 blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                    <LogoImage size={64} className="relative shadow-lg shadow-brand-navy-500/20 group-hover:scale-105 transition-transform" />
                    <div className="absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full bg-cyan-400 border-2 border-white dark:border-slate-950" />
                  </Link>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                      {requires2FA
                        ? t("twoFactorAuth")
                        : t("signIn")}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {requires2FA
                        ? t("twoFactorPrompt")
                        : t("welcomePrompt")}
                    </p>
                  </div>
                </div>

                {/* Google Login Button */}
                {showGoogleButton && !requires2FA && (
                  <div className="space-y-4">
                    <GoogleLoginButton />
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl px-2 text-slate-400 dark:text-slate-500">
                          {t("or")}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm animate-scale-in">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    </div>
                  )}

                  {requires2FA ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {t("verificationCode")}
                        </label>
                        <Input
                          type="text"
                          placeholder="000000"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                          required
                          maxLength={8}
                          className="h-12 text-center text-xl tracking-[0.5em] font-mono bg-slate-50/80 dark:bg-slate-800/60"
                          dir="ltr"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-xs text-slate-500"
                        onClick={() => { setRequires2FA(false); setTwoFactorCode(""); }}
                      >
                        {t("backToSignIn")}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Email Field */}
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {t("email")}
                        </label>
                        <div className="relative">
                          <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            type="email"
                            placeholder={t("emailPlaceholder")}
                            value={email || ""}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={cn(
                              "h-11 ps-10 bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700",
                              "focus:border-brand-navy-500 focus:ring-2 focus:ring-brand-navy-500/20 transition-all duration-200",
                              "placeholder:text-slate-400",
                              error && "border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20"
                            )}
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {/* Password Field */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t("password")}
                          </label>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs text-brand-navy-600 dark:text-brand-navy-400 hover:text-brand-navy-700 dark:hover:text-brand-navy-300 transition-colors"
                          >
                            {t("forgotPassword")}
                          </button>
                        </div>
                        {setupNeeded && (
                          <div className="mb-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs">
                            <p className="font-medium text-amber-800 dark:text-amber-300">
                              {isAr ? "🚀 أول مرة تشغّل النظام؟" : "🚀 First time running the system?"}
                            </p>
                            <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                              {isAr
                                ? "لا يوجد أي حساب بعد. أنشئ حساب المدير العام من صفحة الإعداد — بدون أي أوامر برمجية."
                                : "No account exists yet. Create the admin account from the setup page — no terminal commands."}
                            </p>
                            <a
                              href="/setup"
                              className="inline-flex items-center gap-1 mt-1.5 font-medium text-amber-900 dark:text-amber-300 hover:underline"
                            >
                              {isAr ? "الذهاب إلى صفحة الإعداد ←" : "Go to setup page →"}
                            </a>
                          </div>
                        )}
                        <div className="relative">
                          <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={t("passwordPlaceholder")}
                            value={password || ""}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className={cn(
                              "h-11 ps-10 pe-11 bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700",
                              "focus:border-brand-navy-500 focus:ring-2 focus:ring-brand-navy-500/20 transition-all duration-200",
                              "placeholder:text-slate-400",
                              error && "border-red-400 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20"
                            )}
                            dir="ltr"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Turnstile Captcha */}
                      <TurnstileCaptcha onVerify={setCaptchaToken} />

                      {/* Remember Me + Role Selector row */}
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={rememberMe}
                            onCheckedChange={(checked) => setRememberMe(checked === true)}
                            className="data-[state=checked]:bg-brand-navy-500 data-[state=checked]:border-brand-navy-500"
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {t("rememberMe")}
                          </span>
                        </label>
                      </div>
                    </>
                  )}

                  {/* Demo Mode Role Selector */}
                  <div className="pt-2 pb-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {tAuto('auto.quickLoginDemoMode')}
                    </p>
                    <Select value={selectedRole} onValueChange={handleRoleSelect}>
                      <SelectTrigger className="w-full bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:ring-brand-navy-500/20 focus:border-brand-navy-500">
                        <SelectValue placeholder={tAuto('auto.selectARole')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {isAr ? role.labelAr : role.labelEn} - {role.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className={cn(
                      "w-full h-11 bg-gradient-to-r from-brand-navy-500 to-cyan-500",
                      "hover:from-brand-navy-600 hover:to-cyan-600 text-white font-medium",
                      "shadow-lg shadow-brand-navy-500/20 hover:shadow-brand-navy-500/40",
                      "transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer mt-2",
                    )}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin me-2" />
                        {t("signingIn")}
                      </>
                    ) : (
                      <>
                        {requires2FA ? t("verify") : t("signIn")}
                        <ChevronLeft className="h-4 w-4 ms-2 rtl:rotate-180" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Demo Mode Banner */}
                {demoCredentials.length > 0 && selectedRole && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2 animate-scale-in">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                        {t("demoMode")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Separator */}
                <Separator className="bg-slate-200/80 dark:bg-slate-800" />

                {/* Footer inside card */}
                <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                  © 2025 BluePrint - {t("subtitle")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Language Toggle */}
        <div className="px-6 sm:px-8 py-4">
          <div className="max-w-sm mx-auto flex items-center justify-center">
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-brand-navy-600 dark:hover:text-brand-navy-400 transition-colors cursor-pointer"
            >
              <Languages className="h-3.5 w-3.5" />
              <span>{tAuto('auto.text8280')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
