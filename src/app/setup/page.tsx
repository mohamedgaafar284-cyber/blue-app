'use client';

/**
 * First-Run Setup Wizard — صفحة الإعداد الأول
 *
 * GOAL (UX): a non-technical engineering-office owner opens the app for the
 * very first time and creates their organization + ADMIN account entirely
 * from the browser — ZERO terminal commands. This page replaces the
 * mandatory `npx tsx prisma/clean-init.ts` flow (which remains available
 * for CI/automation as an alternative).
 *
 * Flow:
 *   Step 1 — Company info (name + optional tax number)
 *   Step 2 — Admin account (name, email, password with strength meter)
 *   Done   — Success screen → button to /login
 *
 * SECURITY:
 * - On mount: GET /api/auth/setup-status. If setup is NOT needed the page
 *   shows "already configured" (with a link to /login) — it never loops.
 * - The POST endpoint itself is fail-closed server-side (atomic
 *   "zero users" check) — this UI is convenience, not the security layer.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import LogoImage from '@/components/ui/logo-image';
import {
  Building2, UserCog, Eye, EyeOff, Loader2, CheckCircle2,
  AlertTriangle, ArrowLeft, ArrowRight, LogIn, ShieldCheck, KeyRound,
} from 'lucide-react';

type Step = 1 | 2 | 3; // 1: company, 2: admin account, 3: done

interface FormState {
  organizationName: string;
  taxNumber: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}

const INITIAL_FORM: FormState = {
  organizationName: '',
  taxNumber: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  confirmPassword: '',
};

function passwordScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 5);
}

export default function SetupPage() {
  const router = useRouter();
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [statusLoading, setStatusLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // First-run detection
  useEffect(() => {
    fetch('/api/auth/setup-status')
      .then((res) => res.json())
      .then((data) => setSetupNeeded(!!data.setupNeeded))
      .catch(() => setSetupNeeded(null))
      .finally(() => setStatusLoading(false));
  }, []);

  const validateStep1 = useCallback((): string | null => {
    if (form.organizationName.trim().length < 2) {
      return isAr ? 'اكتب اسم الشركة (حرفين على الأقل)' : 'Enter the company name (min 2 characters)';
    }
    return null;
  }, [form.organizationName, isAr]);

  const validateStep2 = useCallback((): string | null => {
    if (form.adminName.trim().length < 2) {
      return isAr ? 'اكتب اسمك الكامل' : 'Enter your full name';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) {
      return isAr ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Invalid email format';
    }
    if (form.adminPassword.length < 12) {
      return isAr
        ? 'كلمة المرور يجب أن تكون 12 خانة على الأقل'
        : 'Password must be at least 12 characters';
    }
    if (form.adminPassword !== form.confirmPassword) {
      return isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match';
    }
    return null;
  }, [form, isAr]);

  const handleSubmit = async () => {
    const validationError = validateStep2();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: form.organizationName.trim(),
          ...(form.taxNumber.trim() ? { taxNumber: form.taxNumber.trim() } : {}),
          adminName: form.adminName.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          adminPassword: form.adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || (isAr ? 'حدث خطأ غير متوقع' : 'Unexpected error'));
        return;
      }
      setCreatedEmail(form.adminEmail.trim().toLowerCase());
      setStep(3);
    } catch {
      setError(
        isAr
          ? 'فشل الاتصال بالخادم. تأكد أن التطبيق يعمل ثم أعد المحاولة.'
          : 'Could not reach the server. Make sure the app is running and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const score = passwordScore(form.adminPassword);
  const scoreLabels = isAr
    ? ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'قوية جداً']
    : ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const scoreColors = [
    'bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600',
  ];

  // ── Loading state ────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-navy-600" />
      </div>
    );
  }

  // ── Setup already done ──────────────────────────────────────────
  if (setupNeeded === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950">
              <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold">
              {isAr ? 'النظام مهيأ بالفعل' : 'System Already Configured'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isAr
                ? 'يوجد حساب مسؤول في قاعدة البيانات. لا حاجة لإعادة الإعداد — سجّل دخولك مباشرة.'
                : 'An admin account already exists. No setup needed — sign in directly.'}
            </p>
            <Button className="w-full gap-2" onClick={() => router.push('/login')}>
              <LogIn className="w-4 h-4" />
              {isAr ? 'الذهاب إلى تسجيل الدخول' : 'Go to Sign In'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-lg space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <LogoImage size={64} className="mx-auto shadow-lg shadow-brand-navy-500/20" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isAr ? 'أهلاً بك في BluePrint 👋' : 'Welcome to BluePrint 👋'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAr
                ? 'إعداد لمرة واحدة يستغرق دقيقة — أنشئ شركتك وحساب المدير العام من هنا مباشرة، بدون أي أوامر برمجية.'
                : 'A one-time setup that takes a minute — create your company and admin account right here, no terminal commands.'}
            </p>
          </div>

          {/* Step indicator */}
          {step < 3 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                    step >= s ? 'bg-brand-navy-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {s}
                  </div>
                  {s === 1 && <div className="w-8 h-0.5 bg-slate-200 dark:bg-slate-800" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 1: Company */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-brand-navy-600" />
                {isAr ? 'بيانات الشركة' : 'Company Information'}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? 'هذه هي المؤسسة التي ستُدار داخل النظام (المكتب الهندسي).'
                  : 'This is the organization that will be managed in the system (the engineering office).'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">{isAr ? 'اسم الشركة / المكتب *' : 'Company / Office Name *'}</Label>
                <Input
                  id="orgName"
                  value={form.organizationName}
                  onChange={(e) => set('organizationName', e.target.value)}
                  placeholder={isAr ? 'مثال: مكتب النخبة للاستشارات الهندسية' : 'e.g. Elite Engineering Consultancy'}
                  className="h-11"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxNumber">{isAr ? 'الرقم الضريبي TRN (اختياري)' : 'Tax Number TRN (optional)'}</Label>
                <Input
                  id="taxNumber"
                  value={form.taxNumber}
                  onChange={(e) => set('taxNumber', e.target.value)}
                  placeholder="100020304000003"
                  dir="ltr"
                  className="h-11 font-mono"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? 'يظهر تلقائياً على الفواتير الرسمية. يمكنك إضافته لاحقاً من الإعدادات.'
                    : 'Appears on official invoices. You can add it later from Settings.'}
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full h-11 gap-2"
                onClick={() => {
                  const v = validateStep1();
                  if (v) { setError(v); return; }
                  setError(null);
                  setStep(2);
                }}
              >
                {isAr ? 'التالي — إنشاء حساب المدير' : 'Next — Create Admin Account'}
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Admin account */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCog className="w-5 h-5 text-brand-navy-600" />
                {isAr ? 'حساب المدير العام' : 'Administrator Account'}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? 'هذا الحساب سيملك صلاحيات كاملة — منه ستضيف الموظفين والمدراء لاحقاً بضغطة زر.'
                  : 'This account gets full permissions — you will add employees and managers from it later with a click.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminName">{isAr ? 'اسمك الكامل *' : 'Your Full Name *'}</Label>
                <Input
                  id="adminName"
                  value={form.adminName}
                  onChange={(e) => set('adminName', e.target.value)}
                  placeholder={isAr ? 'مثال: م. محمد جعفر' : 'e.g. Mohamed Gaafar'}
                  className="h-11"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminEmail">{isAr ? 'البريد الإلكتروني (اسم المستخدم) *' : 'Email (username) *'}</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => set('adminEmail', e.target.value)}
                  placeholder="admin@yourcompany.ae"
                  dir="ltr"
                  className="h-11"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPassword">{isAr ? 'كلمة المرور *' : 'Password *'}</Label>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={form.adminPassword}
                    onChange={(e) => set('adminPassword', e.target.value)}
                    placeholder={isAr ? '12 خانة على الأقل' : 'At least 12 characters'}
                    dir="ltr"
                    className="h-11 pe-10"
                    maxLength={128}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.adminPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? scoreColors[score] : 'bg-slate-200 dark:bg-slate-800'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isAr ? 'قوة كلمة المرور: ' : 'Password strength: '}
                      <span className="font-medium">{scoreLabels[score]}</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  placeholder="••••••••••••"
                  dir="ltr"
                  className="h-11"
                  maxLength={128}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 gap-2"
                  onClick={() => { setStep(1); setError(null); }}
                  disabled={loading}
                >
                  {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                  {isAr ? 'رجوع' : 'Back'}
                </Button>
                <Button className="flex-1 h-11 gap-2" onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isAr ? 'جاري الإنشاء...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      {isAr ? 'إنشاء الحساب وتشغيل النظام' : 'Create Account & Launch'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <Card className="border-emerald-500/50">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold">
                {isAr ? 'تم تجهيز النظام بنجاح 🎉' : 'Your System Is Ready 🎉'}
              </h2>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  {isAr ? 'حساب المدير العام: ' : 'Admin account: '}
                  <span className="font-mono font-medium text-foreground" dir="ltr">{createdEmail}</span>
                </p>
                <p>
                  {isAr
                    ? 'سجّل دخولك الآن، ثم أضف الموظفين من: إدارة النظام ← المستخدمين ← إضافة مستخدم.'
                    : 'Sign in now, then add employees from: System Admin → Users → Add User.'}
                </p>
              </div>
              <Alert className="text-start border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs">
                  {isAr
                    ? 'احفظ كلمة المرور في مكان آمن. عند أول دخول يمكنك تفعيل التحقق بخطوتين (2FA) من ملفك الشخصي.'
                    : 'Store the password safely. After your first login you can enable two-factor authentication (2FA) from your profile.'}
                </AlertDescription>
              </Alert>
              <Button className="w-full h-11 gap-2" onClick={() => router.push('/login')}>
                <LogIn className="w-4 h-4" />
                {isAr ? 'اذهب إلى تسجيل الدخول' : 'Go to Sign In'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          {isAr ? 'BluePrint — نظام إدارة المكاتب الاستشارية الهندسية' : 'BluePrint — Engineering Consultancy ERP'}
        </p>
      </div>
    </div>
  );
}
