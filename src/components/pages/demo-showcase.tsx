'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles, Brain, CreditCard, MessageCircle, FileText,
  Shield, Users, Building2, BarChart3,
  Lock, Globe, Zap, AlertTriangle, CheckCircle2,
  ArrowLeft, ArrowRight, ExternalLink, Play,
  Smartphone, FileSpreadsheet, Layers
} from 'lucide-react';

interface ShowcaseSection {
  id: string;
  icon: React.ElementType;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  status: 'live' | 'demo' | 'needs-config';
  features: Array<{ ar: string; en: string; demo: boolean }>;
  demoUrl?: string;
}

const SECTIONS: ShowcaseSection[] = [
  {
    id: 'ai-assistant',
    icon: Brain,
    titleAr: 'المساعد الذكي الهندسي',
    titleEn: 'AI Engineering Assistant',
    descAr: 'مساعد ذكي يفهم السياق الهندسي ويجيب على استفساراتك عن المشاريع والفواتير والميزانيات',
    descEn: 'Context-aware AI assistant that answers questions about projects, invoices, and budgets',
    status: 'demo',
    demoUrl: '/dashboard/ai-assistant',
    features: [
      { ar: 'محادثة تفاعلية بالعربي والإنجليزي', en: 'Bilingual chat (AR/EN)', demo: true },
      { ar: 'يفهم سياق مشروعك ويجيب بذكاء', en: 'Project context awareness', demo: true },
      { ar: 'تحليل الصور والمستندات الهندسية', en: 'Image & document analysis', demo: false },
      { ar: 'دعم 9 مزودين (OpenAI, Gemini, ZAI...)', en: '9 providers supported', demo: false },
    ],
  },
  {
    id: 'accounting',
    icon: FileSpreadsheet,
    titleAr: 'المحاسبة المزدوجة',
    titleEn: 'Double-Entry Accounting',
    descAr: 'نظام محاسبة كامل بقيد مزدوج، شجرة حسابات، ميزان مراجعة، قائمة دخل وميزانية عمومية',
    descEn: 'Full double-entry accounting with chart of accounts, trial balance, P&L, and balance sheet',
    status: 'live',
    demoUrl: '/dashboard/finance/accounts',
    features: [
      { ar: 'شجرة الحسابات الهرمية', en: 'Hierarchical chart of accounts', demo: true },
      { ar: 'قيود اليومية المعتمدة', en: 'Approved journal entries', demo: true },
      { ar: 'ميزان المراجعة التلقائي', en: 'Auto trial balance', demo: true },
      { ar: 'قائمة الدخل والميزانية العمومية', en: 'P&L and Balance Sheet', demo: true },
      { ar: 'ضريبة القيمة المضافة الإماراتية (5%)', en: 'UAE VAT (5%) compliance', demo: true },
    ],
  },
  {
    id: 'crm-whatsapp',
    icon: MessageCircle,
    titleAr: 'إدارة العملاء وواتساب',
    titleEn: 'CRM & WhatsApp',
    descAr: 'لوحة Kanban لإدارة الصفقات + تكامل واتساب business لإرسال الرسائل للعملاء',
    descEn: 'Kanban deals board + WhatsApp Business integration for client messaging',
    status: 'demo',
    demoUrl: '/dashboard/crm',
    features: [
      { ar: 'لوحة Kanban لمراحل العملاء', en: 'Kanban deals board', demo: true },
      { ar: 'تحويل العميل لـ Won يفتح مشروع تلقائيًا', en: 'Won → auto project creation', demo: true },
      { ar: 'إرسال رسائل واتساب من داخل النظام', en: 'Send WhatsApp from system', demo: false },
      { ar: 'تتبع محادثات العميل', en: 'Client conversation tracking', demo: true },
    ],
  },
  {
    id: 'payments',
    icon: CreditCard,
    titleAr: 'المدفوعات والاشتراكات',
    titleEn: 'Payments & Subscriptions',
    descAr: 'تكامل Stripe للمدفوعات والاشتراكات الشهرية، فواتير إلكترونية، خطط متعددة',
    descEn: 'Stripe integration for payments and monthly subscriptions, e-invoices, multiple plans',
    status: 'needs-config',
    demoUrl: '/dashboard/billing',
    features: [
      { ar: 'خطط اشتراك (Basic, Pro, Enterprise)', en: 'Subscription plans', demo: true },
      { ar: 'فواتير Stripe إلكترونية', en: 'Stripe e-invoices', demo: false },
      { ar: 'بوابة دفع Stripe Checkout', en: 'Stripe Checkout gateway', demo: false },
      { ar: 'إدارة طرق الدفع', en: 'Payment method management', demo: false },
    ],
  },
  {
    id: 'projects',
    icon: Building2,
    titleAr: 'إدارة المشاريع الهندسية',
    titleEn: 'Engineering Project Management',
    descAr: 'مشاريع، مهام، مراحل، Gantt، زيارات موقع، عيوب، RFIs، عطاءات، BOQ',
    descEn: 'Projects, tasks, stages, Gantt, site visits, defects, RFIs, bids, BOQ',
    status: 'live',
    demoUrl: '/dashboard/projects',
    features: [
      { ar: 'مخطط Gantt التفاعلي', en: 'Interactive Gantt chart', demo: true },
      { ar: 'إدارة BOQ وجداول الكميات', en: 'BOQ management', demo: true },
      { ar: 'زيارات الموقع مع GPS', en: 'Site visits with GPS', demo: true },
      { ar: 'تتبع العيوب (Defects)', en: 'Defects tracking', demo: true },
      { ar: 'RFIs و Submittals', en: 'RFIs & Submittals', demo: true },
      { ar: 'عطاءات (Tenders) وتقييمها', en: 'Tenders & evaluation', demo: true },
    ],
  },
  {
    id: 'mobile-app',
    icon: Smartphone,
    titleAr: 'تطبيق الموبايل للمهندسين',
    titleEn: 'Mobile App for Engineers',
    descAr: 'تطبيق Expo React Native للمهندسين الميدانيين مع وضع offline ومزامنة تلقائية',
    descEn: 'Expo React Native app for field engineers with offline mode and auto-sync',
    status: 'needs-config',
    demoUrl: '/dashboard/features-hub',
    features: [
      { ar: 'وضع offline كامل (SQLite)', en: 'Full offline mode (SQLite)', demo: true },
      { ar: 'تسجيل زيارات الموقع بالـ GPS', en: 'GPS site visit logging', demo: true },
      { ar: 'التقاط الصور من الموقع', en: 'On-site photo capture', demo: true },
      { ar: 'مزامنة تلقائية عند عودة الاتصال', en: 'Auto-sync on reconnect', demo: true },
      { ar: 'يحتاج تشغيل منفصل: cd mobile && bun start', en: 'Separate: cd mobile && bun start', demo: false },
    ],
  },
  {
    id: 'cad-viewer',
    icon: Layers,
    titleAr: 'عارض رسومات الأوتوكاد',
    titleEn: 'AutoCAD Viewer',
    descAr: 'عارض تفاعلي لملفات DXF/DWG مع zoom و pan وطبقات متعددة',
    descEn: 'Interactive DXF/DWG viewer with zoom, pan, and multi-layer support',
    status: 'live',
    demoUrl: '/dashboard/projects',
    features: [
      { ar: 'عارض DXF تفاعلي', en: 'Interactive DXF viewer', demo: true },
      { ar: 'Zoom و Pan', en: 'Zoom & Pan', demo: true },
      { ar: 'إدارة الطبقات (Layers)', en: 'Layer management', demo: true },
      { ar: 'رفع ملفات CAD', en: 'Upload CAD files', demo: true },
    ],
  },
  {
    id: 'dubai-municipality',
    icon: Building2,
    titleAr: 'تكامل بلدية دبي',
    titleEn: 'Dubai Municipality Integration',
    descAr: 'بوابة ربط معاملات بلدية دبي الذكية لتقديم التراخيص وتتبعها',
    descEn: 'Dubai Municipality smart portal for permit submissions and tracking',
    status: 'demo',
    demoUrl: '/dashboard/municipality-correspondence',
    features: [
      { ar: 'تقديم طلبات الترخيص', en: 'Permit applications', demo: true },
      { ar: 'تتبع حالة المعاملات', en: 'Application status tracking', demo: true },
      { ar: 'ربط مباشر مع API البلدية', en: 'Direct DM API integration', demo: false },
    ],
  },
  {
    id: 'ai-audit',
    icon: AlertTriangle,
    titleAr: 'محرك كشف الاحتيال المالي',
    titleEn: 'AI Financial Anomaly Detection',
    descAr: 'ذكاء اصطناعي يكشف الفوترة المزدوجة، التأخر غير الطبيعي، وتجاوز الميزانية',
    descEn: 'AI engine detecting double billing, abnormal delays, and budget overruns',
    status: 'needs-config',
    demoUrl: '/dashboard/finance/revenue',
    features: [
      { ar: 'كشف الدفعات المكررة (7 أيام)', en: 'Duplicate payment detection (7 days)', demo: true },
      { ar: 'تنبيهات التأخر (60+ يوم)', en: 'Overdue alerts (60+ days)', demo: true },
      { ar: 'كشف تجاوز الميزانية', en: 'Budget overrun detection', demo: true },
      { ar: 'إشعارات تلقائية للـ admins', en: 'Auto admin notifications', demo: true },
      { ar: 'يحتاج CRON_SECRET + scheduler خارجي', en: 'Needs CRON_SECRET + external scheduler', demo: false },
    ],
  },
  {
    id: 'weekly-reports',
    icon: FileText,
    titleAr: 'التقارير الأسبوعية PDF',
    titleEn: 'Weekly PDF Reports',
    descAr: 'توليد تقرير مالي PDF أسبوعيًا وإرساله بالبريد للمدراء تلقائيًا',
    descEn: 'Weekly PDF financial report auto-generated and emailed to managers',
    status: 'needs-config',
    demoUrl: '/dashboard/report-builder',
    features: [
      { ar: 'تقرير PDF احترافي بالعملة المحلية', en: 'Pro PDF report in local currency', demo: true },
      { ar: 'ملخص آخر 3 شهور', en: '3-month summary', demo: true },
      { ar: 'إرسال تلقائي للمدراء', en: 'Auto email to managers', demo: false },
      { ar: 'يحتاج SMTP + CRON_SECRET + scheduler', en: 'Needs SMTP + CRON_SECRET + scheduler', demo: false },
    ],
  },
  {
    id: 'security',
    icon: Shield,
    titleAr: 'الأمان والصلاحيات',
    titleEn: 'Security & RBAC',
    descAr: 'مصادقة قوية: JWT + 2FA + OAuth + RBAC + CSRF + CSP + rate limiting',
    descEn: 'Strong auth: JWT + 2FA + OAuth + RBAC + CSRF + CSP + rate limiting',
    status: 'live',
    demoUrl: '/dashboard/profile',
    features: [
      { ar: 'JWT مع refresh token rotation', en: 'JWT with refresh rotation', demo: true },
      { ar: '2FA عبر TOTP وكود احتياطي', en: '2FA via TOTP + backup codes', demo: true },
      { ar: 'Google + Microsoft OAuth', en: 'Google + Microsoft OAuth', demo: false },
      { ar: 'RBAC (12 دور مختلف)', en: 'RBAC (12 roles)', demo: true },
      { ar: 'CSRF protection', en: 'CSRF protection', demo: true },
      { ar: 'CSP بـ nonces لكل طلب', en: 'Per-request CSP nonces', demo: true },
      { ar: 'Rate limiting متدرج', en: 'Tiered rate limiting', demo: true },
      { ar: 'Account lockout بعد 5 محاولات', en: 'Account lockout (5 attempts)', demo: true },
    ],
  },
  {
    id: 'realtime',
    icon: Zap,
    titleAr: 'الوقت الفعلي والإشعارات',
    titleEn: 'Real-time & Notifications',
    descAr: 'Socket.io للـ chat والإشعارات الفورية، Web Push للإشعارات على الموبايل',
    descEn: 'Socket.io for chat & instant notifications, Web Push for mobile push',
    status: 'demo',
    demoUrl: '/dashboard/features-hub',
    features: [
      { ar: 'Socket.io chat داخل النظام', en: 'In-app Socket.io chat', demo: true },
      { ar: 'إشعارات فورية داخل التطبيق', en: 'In-app instant notifications', demo: true },
      { ar: 'Web Push notifications', en: 'Web Push notifications', demo: false },
      { ar: 'يحتاج VAPID keys + chat-service على port 3003', en: 'Needs VAPID + chat-service on 3003', demo: false },
    ],
  },
  {
    id: 'hr',
    icon: Users,
    titleAr: 'الموارد البشرية',
    titleEn: 'Human Resources',
    descAr: 'موظفين، حضور، إجازات، موافقات، أدوار، وأذونات',
    descEn: 'Employees, attendance, leaves, approvals, roles, and permissions',
    status: 'live',
    demoUrl: '/dashboard/employees',
    features: [
      { ar: 'إدارة الموظفين والأدوار', en: 'Employee & role management', demo: true },
      { ar: 'تتبع الحضور والانصراف', en: 'Attendance tracking', demo: true },
      { ar: 'طلبات الإجازات والموافقات', en: 'Leave requests & approvals', demo: true },
      { ar: 'تتبع ساعات العمل (Timesheets)', en: 'Work hours timesheets', demo: true },
    ],
  },
  {
    id: 'pwa',
    icon: Smartphone,
    titleAr: 'تطبيق ويب تقدمي (PWA)',
    titleEn: 'Progressive Web App',
    descAr: 'يعمل كـ app على الموبايل، يدعم offline mode، وقابل للتثبيت',
    descEn: 'Works as a mobile app, supports offline mode, installable',
    status: 'live',
    demoUrl: '/dashboard',
    features: [
      { ar: 'قابل للتثبيت على الموبايل', en: 'Installable on mobile', demo: true },
      { ar: 'يعمل offline (Serwist)', en: 'Offline support (Serwist)', demo: true },
      { ar: 'Service worker تلقائي', en: 'Auto service worker', demo: true },
    ],
  },
  {
    id: 'multilingual',
    icon: Globe,
    titleAr: 'ثنائي اللغة + Hijri',
    titleEn: 'Bilingual + Hijri',
    descAr: 'عربي/إنجليزي مع RTL/LTR و تقويم هجري',
    descEn: 'Arabic/English with RTL/LTR and Hijri calendar',
    status: 'live',
    demoUrl: '/dashboard',
    features: [
      { ar: 'عربي/إنجليزي بالكامل', en: 'Full AR/EN', demo: true },
      { ar: 'RTL/LTR تلقائي', en: 'Auto RTL/LTR', demo: true },
      { ar: 'تقويم هجري', en: 'Hijri calendar', demo: true },
    ],
  },
  {
    id: 'monitoring',
    icon: BarChart3,
    titleAr: 'المراقبة والـ logs',
    titleEn: 'Monitoring & Logging',
    descAr: 'Sentry للأخطاء، Winston للـ logs، Activity Log و Security Audit Log',
    descEn: 'Sentry for errors, Winston for logs, Activity Log & Security Audit Log',
    status: 'demo',
    demoUrl: '/dashboard/activity-log',
    features: [
      { ar: 'Activity Log لكل العمليات', en: 'Activity Log for all operations', demo: true },
      { ar: 'Security Audit Log', en: 'Security Audit Log', demo: true },
      { ar: 'Winston structured logging', en: 'Winston structured logging', demo: true },
      { ar: 'Sentry error tracking', en: 'Sentry error tracking', demo: false },
      { ar: 'Sentry performance monitoring', en: 'Sentry performance monitoring', demo: false },
    ],
  },
];

const STATUS_BADGES = {
  live: { ar: 'يعمل بالكامل', en: 'Fully Live', color: 'bg-emerald-500' },
  demo: { ar: 'يعمل في الديمو', en: 'Demo Working', color: 'bg-blue-500' },
  'needs-config': { ar: 'يحتاج إعداد', en: 'Needs Config', color: 'bg-amber-500' },
};

export default function DemoShowcase({ language }: { language: 'ar' | 'en' }) {
  const [filter, setFilter] = useState<'all' | 'live' | 'demo' | 'needs-config'>('all');
  const isAr = language === 'ar';

  const filteredSections = filter === 'all'
    ? SECTIONS
    : SECTIONS.filter(s => s.status === filter);

  const stats = {
    total: SECTIONS.length,
    live: SECTIONS.filter(s => s.status === 'live').length,
    demo: SECTIONS.filter(s => s.status === 'demo').length,
    needsConfig: SECTIONS.filter(s => s.status === 'needs-config').length,
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Hero Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {isAr ? 'عرض المميزات الكامل' : 'Complete Features Showcase'}
                </h1>
                <p className="text-xs text-slate-500">
                  {isAr ? 'كل ما يمكنك تجربته في BluePrint ERP' : 'Everything you can try in BluePrint ERP'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 bg-white text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                {isAr ? 'الموقع الرئيسي' : 'Home Website'}
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                {isAr ? 'الذهاب للوحة التحكم' : 'Go to Dashboard'}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Sparkles} label={isAr ? 'إجمالي المميزات' : 'Total Features'} value={stats.total} color="bg-blue-500" />
          <StatCard icon={CheckCircle2} label={isAr ? 'تعمل بالكامل' : 'Fully Working'} value={stats.live} color="bg-emerald-500" />
          <StatCard icon={Play} label={isAr ? 'تعمل في الديمو' : 'Demo Working'} value={stats.demo} color="bg-indigo-500" />
          <StatCard icon={Lock} label={isAr ? 'تحتاج إعداد' : 'Need Config'} value={stats.needsConfig} color="bg-amber-500" />
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
            {isAr ? 'الكل' : 'All'}
          </FilterTab>
          <FilterTab active={filter === 'live'} onClick={() => setFilter('live')} color="emerald">
            {isAr ? 'تعمل بالكامل' : 'Fully Working'}
          </FilterTab>
          <FilterTab active={filter === 'demo'} onClick={() => setFilter('demo')} color="indigo">
            {isAr ? 'تعمل في الديمو' : 'Demo'}
          </FilterTab>
          <FilterTab active={filter === 'needs-config'} onClick={() => setFilter('needs-config')} color="amber">
            {isAr ? 'تحتاج إعداد' : 'Needs Config'}
          </FilterTab>
        </div>

        {/* Legend */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 text-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900 mb-1">
                {isAr ? 'كيف تستخدم هذه الصفحة' : 'How to use this page'}
              </p>
              <p className="text-slate-600 leading-relaxed">
                {isAr
                  ? 'هذه الصفحة تعرض كل ميزات التطبيق. المميزات الخضراء تعمل بالكامل في الديمو، الزرقاء تعمل بشكل جزئي، والصفراء تحتاج إعداد مفاتيح خارجية (Stripe, OpenAI, etc.). اضغط على أي بطاقة للتجربة المباشرة.'
                  : 'This page shows all app features. Green features work fully in demo, blue work partially, yellow need external keys (Stripe, OpenAI, etc.). Click any card to try it live.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSections.map((section, idx) => (
            <FeatureCard key={section.id} section={section} isAr={isAr} index={idx} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-500">
            {isAr
              ? 'BluePrint ERP — نظام إدارة الاستشارات الهندسية للإمارات'
              : 'BluePrint ERP — Engineering Consultancy Management for UAE'}
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function FilterTab({ active, onClick, children, color = 'slate' }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  const colorClasses = {
    slate: active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
    emerald: active ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-600 hover:bg-emerald-50',
    indigo: active ? 'bg-indigo-500 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-50',
    amber: active ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 hover:bg-amber-50',
  };
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 transition-colors ${colorClasses[color as keyof typeof colorClasses]}`}
    >
      {children}
    </button>
  );
}

function FeatureCard({ section, isAr, index }: { section: ShowcaseSection; isAr: boolean; index: number }) {
  const Icon = section.icon;
  const badge = STATUS_BADGES[section.status];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-300 h-full flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-700">
          <Icon className="w-6 h-6" />
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white ${badge.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          {isAr ? badge.ar : badge.en}
        </span>
      </div>

      <h3 className="text-base font-bold text-slate-900 mb-2">
        {isAr ? section.titleAr : section.titleEn}
      </h3>
      <p className="text-xs text-slate-600 leading-relaxed mb-4">
        {isAr ? section.descAr : section.descEn}
      </p>

      <div className="space-y-2 mb-4 flex-grow">
        {section.features.map((feat, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {feat.demo ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            )}
            <span className={feat.demo ? 'text-slate-700' : 'text-slate-400'}>
              {isAr ? feat.ar : feat.en}
            </span>
          </div>
        ))}
      </div>

      {section.demoUrl && (
        <div className="flex items-center gap-2 text-xs font-medium text-blue-600 pt-3 border-t border-slate-100">
          <ExternalLink className="w-3.5 h-3.5" />
          {isAr ? 'جرّب الآن' : 'Try now'}
        </div>
      )}
    </motion.div>
  );

  return section.demoUrl ? <Link href={section.demoUrl}>{content}</Link> : content;
}
