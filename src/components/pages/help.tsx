"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavStore } from "@/store/nav-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, Search, Book, MessageCircle, Mail, Phone, ExternalLink, FileText, Settings, Shield, Keyboard, Lightbulb, ChevronRight, Headphones, BookMarked } from 'lucide-react'

import { cn } from "@/lib/utils";

// ===== Bilingual Help Categories =====
const helpCategories = [
  {
    titleAr: "البدء السريع",
    titleEn: "Quick Start",
    icon: Book,
    articles: [
      { titleAr: "كيفية إنشاء مشروع جديد", titleEn: "How to create a new project" },
      { titleAr: "التعرف على واجهة النظام", titleEn: "Getting to know the interface" },
      { titleAr: "إنشاء أول مهمة لك", titleEn: "Create your first task" },
      { titleAr: "إضافة أعضاء الفريق", titleEn: "Add team members" },
    ],
  },
  {
    titleAr: "إدارة المشاريع",
    titleEn: "Project Management",
    icon: FileText,
    articles: [
      { titleAr: "إنشاء وتعديل المشاريع", titleEn: "Create and edit projects" },
      { titleAr: "إدارة المهام والأنشطة", titleEn: "Manage tasks and activities" },
      { titleAr: "تتبع التقدم والمواعيد", titleEn: "Track progress and deadlines" },
      { titleAr: "إدارة أوامر التغيير", titleEn: "Manage change orders" },
    ],
  },
  {
    titleAr: "المالية والمحاسبة",
    titleEn: "Financial & Accounting",
    icon: Settings,
    articles: [
      { titleAr: "إنشاء فواتير ومدفوعات", titleEn: "Create invoices and payments" },
      { titleAr: "إدارة الميزانيات", titleEn: "Budget management" },
      { titleAr: "العروض المالية والعطاءات", titleEn: "Proposals and bids" },
      { titleAr: "تقارير مالية", titleEn: "Financial reports" },
    ],
  },
  {
    titleAr: "إدارة الموقع",
    titleEn: "Site Management",
    icon: Shield,
    articles: [
      { titleAr: "تسجيل زيارات الموقع", titleEn: "Record site visits" },
      { titleAr: "إدارة العيوب", titleEn: "Defects management" },
      { titleAr: "طلبات المعلومات (RFI)", titleEn: "Requests for Information" },
      { titleAr: "يومية الموقع", titleEn: "Site diary" },
    ],
  },
];

// ===== Bilingual FAQs =====
const faqs = [
  {
    questionAr: "كيف يمكنني إعادة تعيين كلمة المرور؟",
    questionEn: "How can I reset my password?",
    answerAr: "يمكنك تغيير كلمة المرور من صفحة الملف الشخصي > تبويب الأمان. أدخل كلمة المرور الحالية والجديدة ثم اضغط على تغيير كلمة المرور.",
    answerEn: "You can change your password from the Profile page > Security tab. Enter your current and new password, then click Change Password.",
  },
  {
    questionAr: "كيف أضيف مستخدمين جدد للفريق؟",
    questionEn: "How do I add new team members?",
    answerAr: "من صفحة الموارد البشرية > الموظفون، اضغط على زر إضافة موظف وأدخل بيانات المستخدم الجديد مع تحديد دوره وصلاحياته.",
    answerEn: "From HR > Employees page, click the Add Employee button and enter the new user details with their role and permissions.",
  },
  {
    questionAr: "هل يمكنني تصدير البيانات من النظام؟",
    questionEn: "Can I export data from the system?",
    answerAr: "نعم، يمكنك تصدير البيانات بتنسيق CSV من صفحات المشاريع والمهام والفواتير وغيرها باستخدام زر التصدير في أعلى الجدول.",
    answerEn: "Yes, you can export data in CSV format from Projects, Tasks, Invoices and other pages using the Export button at the top of the table.",
  },
  {
    questionAr: "كيف أحصل على دعم فني؟",
    questionEn: "How do I get technical support?",
    answerAr: "يمكنك التواصل معنا عبر البريد الإلكتروني support@blueprint.ae أو الهاتف. فريق الدعم متاح من الأحد إلى الخميس.",
    answerEn: "You can contact us via email at support@blueprint.ae or by phone. Support is available Sunday through Thursday.",
  },
  {
    questionAr: "كيف أستخدم المساعد الذكي (AI)؟",
    questionEn: "How do I use the AI Assistant?",
    answerAr: "انتقل إلى صفحة المساعد الذكي من القائمة الجانبية أو الشريط السفلي للموبايل. اكتب سؤالك وسيقوم المساعد بالإجابة بناءً على بيانات نظامك.",
    answerEn: "Navigate to the AI Assistant page from the sidebar or mobile bottom nav. Type your question and the assistant will respond based on your system data.",
  },
  {
    questionAr: "كيف أدير موافقات المشاريع؟",
    questionEn: "How do I manage project approvals?",
    answerAr: "من صفحة الموافقات، يمكنك عرض الطلبات المعلقة والموافقة عليها أو رفضها. كل طلب يمر بسلسلة موافقات متعددة حسب نوعه.",
    answerEn: "From the Approvals page, you can view pending requests and approve or reject them. Each request goes through an approval chain based on its type.",
  },
  {
    questionAr: "هل بياناتي آمنة في النظام؟",
    questionEn: "Is my data secure in the system?",
    answerAr: "نعم، نستخدم أحدث تقنيات التشفير والأمان لحماية بياناتك. جميع البيانات محفوظة بقاعدة بيانات محلية آمنة مع صلاحيات وصول مفصلة.",
    answerEn: "Yes, we use the latest encryption and security technologies to protect your data. All data is stored in a secure local database with granular access permissions.",
  },
];

// ===== Keyboard Shortcuts Reference =====
const keyboardShortcuts = [
  { keys: ["Ctrl", "K"], descAr: "فتح البحث", descEn: "Open Search" },
  { keys: ["Ctrl", "N"], descAr: "مشروع جديد", descEn: "New Project" },
  { keys: ["Ctrl", "T"], descAr: "مهمة جديدة", descEn: "New Task" },
  { keys: ["Ctrl", "I"], descAr: "فاتورة جديدة", descEn: "New Invoice" },
  { keys: ["Escape"], descAr: "إغلاق النافذة", descEn: "Close Dialog" },
  { keys: ["?"], descAr: "اختصارات لوحة المفاتيح", descEn: "Keyboard Shortcuts" },
  { keys: ["1"], descAr: "لوحة التحكم", descEn: "Dashboard" },
  { keys: ["2"], descAr: "المشاريع", descEn: "Projects" },
  { keys: ["3"], descAr: "المهام", descEn: "Tasks" },
  { keys: ["4"], descAr: "العملاء", descEn: "Clients" },
  { keys: ["5"], descAr: "الفواتير", descEn: "Invoices" },
  { keys: ["6"], descAr: "التقويم", descEn: "Calendar" },
];

// ===== Knowledge Article Interface =====
interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatar: string } | null;
}

function getCategoryConfig(cat: string) {
  const configs: Record<string, { ar: string; en: string; color: string; icon: string }> = {
    guide: { ar: "دليل", en: "Guide", color: "bg-brand-navy-100 text-brand-navy-700 dark:bg-brand-navy-900/50 dark:text-brand-navy-300", icon: "📘" },
    faq: { ar: "أسئلة شائعة", en: "FAQ", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", icon: "❓" },
    policy: { ar: "سياسة", en: "Policy", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", icon: "📋" },
    template: { ar: "قالب", en: "Template", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", icon: "📄" },
  };
  return configs[cat] || configs.GUIDE;
}

export default function HelpPage({ language, projectId }: { language: "ar" | "en"; projectId?: string }) {
  const tAuto = useTranslations();
  const isAr = language === "ar";
  const [searchQuery, setSearchQuery] = useState("");
  const { setCurrentPage } = useNavStore();

  // Fetch knowledge base articles
  const { data: kbArticles = [], isLoading: kbLoading } = useQuery<KnowledgeArticle[]>({
    queryKey: ["help-kb-articles", projectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      params.set("limit", "5");
      const res = await fetch(`/api/knowledge?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Navigate to Knowledge page
  const navigateToKnowledge = () => {
    setCurrentPage("knowledge");
  };

  // Filter FAQs based on search
  const filteredFaqs = faqs.filter((faq) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      faq.questionAr.includes(query) ||
      faq.questionEn.toLowerCase().includes(query) ||
      faq.answerAr.includes(query) ||
      faq.answerEn.toLowerCase().includes(query)
    );
  });

  // Filter categories articles based on search
  const filteredCategories = helpCategories
    .map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (a) =>
          !searchQuery ||
          a.titleAr.includes(searchQuery) ||
          a.titleEn.toLowerCase().includes(searchQuery)
      ),
    }))
    .filter((cat) => cat.articles.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-navy-500 to-brand-navy-600 text-white mb-4 shadow-lg shadow-brand-navy-500/20">
          <Headphones className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {tAuto('auto.helpCenter')}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          {tAuto('auto.howCanWeHelpYouToday')}
        </p>
      </div>

      {/* Search */}
      <Card className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <CardContent className="p-4">
          <div className="relative">
            <Search className={cn(
              "absolute top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5",
              isAr ? "right-3" : "left-3"
            )} />
            <Input
              placeholder={tAuto('auto.searchHelpCenter')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "py-6 text-lg bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white",
                tAuto('auto.ps12Pe4')
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: BookMarked, titleAr: "قاعدة المعرفة", titleEn: "Knowledge Base", descAr: "مقالات ودليل شامل", descEn: "Articles & comprehensive guide", color: "text-brand-navy-500", bg: "bg-brand-navy-50 dark:bg-brand-navy-500/10", onClick: navigateToKnowledge },
          { icon: Book, titleAr: "الدليل الشامل", titleEn: "User Guide", descAr: "جولة تعليمية تفاعلية", descEn: "Interactive system tour", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", onClick: () => window.dispatchEvent(new CustomEvent('restart-blueprint-tour')) },
          { icon: MessageCircle, titleAr: "المساعد الذكي", titleEn: "AI Assistant", descAr: "اطرح سؤالك على الذكاء الاصطناعي", descEn: "Ask questions to AI", color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10", onClick: () => setCurrentPage("ai-assistant") },
          { icon: Mail, titleAr: "تواصل معنا", titleEn: "Contact Us", descAr: "support@blueprint.ae", descEn: "Direct email support", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", onClick: () => { window.open("mailto:support@blueprint.ae?subject=Blueprint%20ERP%20Support", "_blank"); } },
        ].map((item) => (
          <Card
            key={item.titleEn}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
            onClick={item.onClick}
          >
            <CardContent className="p-4 text-center">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3", item.bg)}>
                <item.icon className={cn("w-6 h-6", item.color)} />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{isAr ? item.titleAr : item.titleEn}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{isAr ? item.descAr : item.descEn}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Knowledge Base Articles Section */}
      {kbArticles.length > 0 && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <div className="w-8 h-8 rounded-lg bg-brand-navy-50 dark:bg-brand-navy-500/10 flex items-center justify-center">
                  <BookMarked className="w-4 h-4 text-brand-navy-500" />
                </div>
                {tAuto('auto.knowledgeBaseArticles')}
                <Badge variant="secondary" className="text-[10px]">{kbArticles.length}</Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-brand-navy-600 dark:text-brand-navy-400 hover:bg-brand-navy-50 dark:hover:bg-brand-navy-900/20 gap-1"
                onClick={navigateToKnowledge}
              >
                {tAuto('auto.viewAll')}
                <ChevronRight className={cn("h-3.5 w-3.5", isAr ? "rotate-180" : "")} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kbArticles.slice(0, 5).map((article) => {
                const catCfg = getCategoryConfig(article.category);
                return (
                  <button
                    key={article.id}
                    onClick={navigateToKnowledge}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-brand-navy-200 dark:hover:border-brand-navy-800/50 hover:bg-brand-navy-50/50 dark:hover:bg-brand-navy-900/10 transition-all text-start group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-navy-50 dark:bg-brand-navy-900/20 flex items-center justify-center shrink-0">
                      <span className="text-sm">{catCfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-brand-navy-600 dark:group-hover:text-brand-navy-400 transition-colors truncate">{article.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{article.content.slice(0, 100)}...</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className={cn("text-[10px] h-5", catCfg.color)}>{isAr ? catCfg.ar : catCfg.en}</Badge>
                        <span className="text-[10px] text-slate-400">{isAr ? `${article.views} مشاهدة` : `${article.views} views`}</span>
                      </div>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 text-slate-300 group-hover:text-brand-navy-500 transition-colors shrink-0 mt-0.5", isAr ? "rotate-180" : "")} />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KB Loading Skeleton */}
      {kbLoading && kbArticles.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {/* KB Empty State (not loading, no articles) */}
      {!kbLoading && kbArticles.length === 0 && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
          <CardContent className="p-8 text-center">
            <BookMarked className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {tAuto('auto.noArticlesYet')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Help Categories - linked to Knowledge page */}
      {filteredCategories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.titleEn} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-base">
                    <div className="w-8 h-8 rounded-lg bg-brand-navy-50 dark:bg-brand-navy-500/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-brand-navy-500" />
                    </div>
                    {isAr ? category.titleAr : category.titleEn}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {category.articles.map((article, i) => (
                      <li key={i}>
                        <button
                          onClick={navigateToKnowledge}
                          className="flex items-center justify-between w-full text-start text-slate-600 dark:text-slate-400 hover:text-brand-navy-500 dark:hover:text-brand-navy-400 transition-colors py-1.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 group"
                        >
                          <span className="text-sm">{isAr ? article.titleAr : article.titleEn}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* FAQs */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-amber-500" />
            </div>
            {tAuto('auto.frequentlyAskedQuestions')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFaqs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {filteredFaqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border-slate-200 dark:border-slate-700"
                >
                  <AccordionTrigger className="text-slate-900 dark:text-white hover:text-brand-navy-500 dark:hover:text-brand-navy-400 text-start">
                    {isAr ? faq.questionAr : faq.questionEn}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isAr ? faq.answerAr : faq.answerEn}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {tAuto('auto.noResultsFoundForYourSearch')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Reference */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-sky-500" />
            </div>
            {tAuto('auto.keyboardShortcuts')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {keyboardShortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {isAr ? shortcut.descAr : shortcut.descEn}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-slate-400 text-xs mx-0.5">+</span>}
                      <kbd className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 text-[11px] font-mono font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded shadow-sm">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="bg-gradient-to-br from-brand-navy-50 to-cyan-50 dark:from-brand-navy-500/10 dark:to-cyan-500/10 border border-brand-navy-200 dark:border-brand-navy-500/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-navy-100 dark:bg-brand-navy-500/20 flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-brand-navy-600 dark:text-brand-navy-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                {tAuto('auto.proTip')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {tAuto('auto.useKeyboardShortcutsToSpeedUpYourWorkflo')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {tAuto('auto.didnTFindWhatYouReLookingFor')}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">
              {tAuto('auto.ourSupportTeamIsReadyToHelp')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button className="bg-brand-navy-500 hover:bg-brand-navy-600 text-white shadow-md shadow-brand-navy-500/20" asChild>
                <a href="mailto:support@blueprint.ae">
                  <Mail className="w-4 h-4 me-2" />
                  support@blueprint.ae
                </a>
              </Button>
              <Button variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800" asChild>
                <a href="tel:+97142438593">
                  <Phone className="w-4 h-4 me-2" />
                  {isAr ? "+971 4 243 8593" : "+971 4 243 8593"}
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
