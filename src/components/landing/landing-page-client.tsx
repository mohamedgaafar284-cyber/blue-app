"use client";


import { useTranslations } from 'next-intl';
import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/hooks/use-lang";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Compass, Phone, Users, Award, Zap, Star, Menu, X, Target, Headphones, ArrowUpRight, FileCheck } from 'lucide-react'

import { Button } from '@/components/ui/button';
import LogoImage from '@/components/ui/logo-image';
import { SkipNavContent } from "@/components/common/accessible-components";
import { NAV_LINKS, PROJECTS, SERVICES, DEFAULT_STATS, useCounter } from "@/components/landing/data";
import { AnimatedText } from "@/components/landing/animated-text";
import { HeroVideoBackground } from "@/components/landing/hero-video-background";
import { ProjectCard } from "@/components/landing/project-card";
import { ContactSection } from "@/components/landing/contact-section";
export default function LandingPageClient() {
  const tAuto = useTranslations();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { lang: language, toggleLanguage: hookToggleLanguage } = useLanguage();

  // Dynamic stats — fetched from API, fallback to defaults
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [company, setCompany] = useState({
    phone: "+971 50 161 1234",
    email: "info@blueprint-rak.com",
    address: "رأس الخيمة، الإمارات العربية المتحدة",
    workingHours: "08:00-17:00",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/public/stats', { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setStats([
            { ...DEFAULT_STATS[0], value: data.completedProjects || 0, suffix: data.completedProjects > 0 ? "+" : "" },
            { ...DEFAULT_STATS[1], value: data.satisfiedClients || 0, suffix: data.satisfiedClients > 0 ? "+" : "" },
            { ...DEFAULT_STATS[2], value: data.engineeringDisciplines || 0, suffix: "" },
            { ...DEFAULT_STATS[3], value: data.ongoingProjects || 0, suffix: data.ongoingProjects > 0 ? "+" : "" },
          ]);
          if (data.company) {
            setCompany(data.company);
          }
        }
      })
      .catch(err => { if (err.name !== 'AbortError') { /* ignore non-abort errors */ } });
    return () => controller.abort();
  }, []);

  const t = (ar: string, en: string) => (language === "ar" ? ar : en);

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = hookToggleLanguage;

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setShowScrollTop(window.scrollY > 400);
          setScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const statsCounter0 = useCounter(stats[0].value, 2000, true);
  const statsCounter1 = useCounter(stats[1].value, 2000, true);
  const statsCounter2 = useCounter(stats[2].value, 2000, true);
  const statsCounter3 = useCounter(stats[3].value, 1500, true);
  const statCounters = [statsCounter0, statsCounter1, statsCounter2, statsCounter3];
  return (
    <div className="min-h-screen bg-[#F8FAFF]" dir={language === "ar" ? "rtl" : "ltr"} style={{ fontFamily: "var(--font-ibm-plex-arabic), var(--font-jakarta), system-ui, sans-serif" }}>
      {/* ===== HEADER ===== */}
      <header className={`fixed top-[var(--demo-banner-height,0px)] left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/95 shadow-md backdrop-blur-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="flex items-center gap-3">
              <LogoImage size={40} />
              <div>
                <h1 className={`text-lg font-bold ${scrolled ? 'text-[#0A1628]' : 'text-white'}`}>BluePrint</h1>
                <p className={`text-[10px] font-medium ${scrolled ? 'text-[#4A6FA5]' : 'text-blue-200/80'}`}>
                  {t("مكتب الاستشارات الهندسية", "Engineering Consultancy")}
                </p>
              </div>
            </Link>

            <nav className={`hidden md:flex items-center gap-1 rounded-full px-2 border ${scrolled ? 'bg-[#F8FAFF]/80 backdrop-blur-xl border-blue-100/50' : 'bg-white/[0.08] backdrop-blur-xl border-white/[0.12]'}`}>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href + link.labelEn}
                  href={link.href}
                  className={`px-4 py-3 text-sm hover:text-[#0F2557] transition-colors font-medium relative group ${scrolled ? 'text-[#4A6FA5]' : 'text-blue-100/80 hover:text-white'}`}
                >
                  {t(link.label, link.labelEn)}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[#0F2557] rounded-full transition-all duration-300 group-hover:w-4" />
                </Link>
              ))}
              <button
                onClick={toggleLanguage}
                className={`px-3 py-2 text-xs font-medium transition-colors ${scrolled ? 'text-[#4A6FA5] hover:text-[#0F2557]' : 'text-blue-200/80 hover:text-white'}`}
              >
                {tAuto('auto.text163')}
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${scrolled ? 'text-[#0F2557] hover:bg-slate-100' : 'text-white hover:bg-white/10'}`}>
                  {t("دخول النظام", "ERP Login")}
                </Button>
              </Link>
              <Link href="/quote">
                <Button className="bg-gradient-to-r from-[#0F2557] to-[#1A4A8B] hover:from-[#1A4A8B] hover:to-[#2563EB] text-white rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide shadow-[0_4px_20px_rgba(15,37,87,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_6px_30px_rgba(15,37,87,0.5)]">
                  {t("ابدأ مشروعك", "Start Your Project")}
                </Button>
              </Link>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 transition-colors"
              aria-label={mobileMenuOpen ? t("إغلاق القائمة", "Close menu") : t("فتح القائمة", "Open menu")}
            >
              {mobileMenuOpen ? <X className={`w-6 h-6 ${scrolled ? 'text-[#0A1628]' : 'text-white'}`} /> : <Menu className={`w-6 h-6 ${scrolled ? 'text-[#0A1628]' : 'text-white'}`} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#0A1628]/95 backdrop-blur-xl border-t border-[#1A4A8B]/20 overflow-hidden"
            >
              <div className="px-4 py-3 space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href + link.labelEn}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm text-blue-100 hover:text-white transition-colors font-medium"
                  >
                    {t(link.label, link.labelEn)}
                  </Link>
                ))}
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full mt-2 border-white/30 text-white hover:bg-white/10 rounded-full">
                    {t("دخول النظام", "ERP Login")}
                  </Button>
                </Link>
                <Link href="/quote" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full mt-2 bg-white text-[#0B1D3A] rounded-full">
                    {t("ابدأ مشروعك", "Start Your Project")}
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-20 min-h-screen overflow-hidden">
        <HeroVideoBackground />

        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-grid)" />
          </svg>
        </div>

        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 -start-20 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute bottom-10 -end-20 w-96 h-96 rounded-full bg-[#1A4A8B]/20 blur-3xl"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <motion.div initial="hidden" animate="visible" className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" as const }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-light text-white leading-[1.1] tracking-tight">
                <span className="block">{t("منزل لأحلامك.", "A home for your dreams.")}</span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" as const }}
            >
              <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-light text-blue-100/90 mt-4 leading-[1.15]" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.15)" }}>
                <AnimatedText 
                  text={t("نصمم ونبني بأعلى معايير الجودة والاحترافية", "Design and build with the highest standards of quality and professionalism")}
                  language={language}
                />
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" as const }}
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/quote">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button className="w-full sm:w-auto px-10 h-14 text-base bg-white text-[#0A1628] hover:bg-blue-50 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.15),0_4px_20px_rgba(15,37,87,0.25)] transition-all duration-300 font-semibold tracking-wide">
                    {t("ابدأ مشروعك الآن", "Start Your Project Now")}
                    <ArrowUpRight className="w-5 h-5 ms-2" />
                  </Button>
                </motion.div>
              </Link>
              <a href="tel:+971501611234">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" className="w-full sm:w-auto px-10 h-14 text-base border-2 border-white/25 text-white hover:bg-white/15 hover:border-white/40 rounded-full backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 font-semibold tracking-wide">
                    <Phone className="w-5 h-5 me-2" />
                    {t("اتصل بنا", "Call Us")}
                  </Button>
                </motion.div>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" as const }}
              className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm"
            >
              {[
                { labelAr: "+250 مشروع", labelEn: "+250 Projects", icon: Building2 },
                { labelAr: "+180 عميل", labelEn: "+180 Clients", icon: Users },
                { labelAr: "فريق متخصص", labelEn: "Specialized Team", icon: Award },
              ].map((item) => (
                <div key={item.labelEn} className="flex items-center gap-2 text-blue-200/70">
                  <item.icon className="w-4 h-4" />
                  <span>{t(item.labelAr, item.labelEn)}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 50L48 45C96 40 192 30 288 28C384 26 480 32 576 40C672 48 768 58 864 55C960 52 1056 36 1152 30C1248 24 1344 28 1392 30L1440 32V100H1392C1344 100 1248 100 1152 100C1056 100 960 100 864 100C768 100 672 100 576 100C480 100 384 100 288 100C192 100 96 100 48 100H0V50Z" fill="#F8FAFF" />
          </svg>
        </div>
      </section>

      <SkipNavContent />

      {/* ===== STATS SECTION ===== */}
      <section className="py-16 sm:py-20 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              const counter = statCounters[i];
              return (
                <motion.div
                  key={stat.label}
                  ref={counter.ref}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center p-8 rounded-2xl bg-white border border-blue-100/50 shadow-[0_1px_3px_rgba(15,37,87,0.04)] hover:shadow-[0_12px_40px_rgba(15,37,87,0.1)] hover:-translate-y-1.5 transition-all duration-400"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F2557] to-[#1A4A8B] mb-4 shadow-[0_4px_12px_rgba(15,37,87,0.2)]">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-[#0A1628] tabular-nums font-[family-name:var(--font-jakarta)]">
                    {counter.count}{stat.suffix}
                  </div>
                  <div className="text-sm text-[#4A6FA5] mt-1">{t(stat.label, stat.labelEn)}</div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ===== PROJECTS GRID ===== */}
      <section id="projects" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-[#EFF6FF] text-[#1A4A8B] rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
              <Building2 className="w-4 h-4" />
              {t("أعمالنا", "Our Work")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] tracking-tight">{t("مشاريع مميزة", "Featured Projects")}</h2>
            <p className="mt-3 text-[#4A6FA5] max-w-2xl mx-auto">{t("نعرض لكم مجموعة من أبرز المشاريع التي قمنا بتنفيذها بكفاءة واحترافية عالية", "We present to you a selection of the most prominent projects we have executed")}</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROJECTS.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} language={language} />
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="text-center mt-12">
            <a href="#projects">
              <Button variant="outline" className="px-8 h-12 border-2 border-[#0F2557]/20 text-[#0F2557] hover:bg-[#0F2557] hover:text-white hover:border-[#0F2557] rounded-full font-semibold tracking-wide transition-all duration-300">
                {t("عرض جميع المشاريع", "View All Projects")}
                <ArrowUpRight className="w-4 h-4 ms-2" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ===== SERVICES SECTION ===== */}
      <section id="services" className="py-16 sm:py-24 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-[#EFF6FF] text-[#1A4A8B] rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
              <Compass className="w-4 h-4" />
              {t("خدماتنا", "Services")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] tracking-tight">{t("حلول هندسية شاملة", "Comprehensive Engineering Solutions")}</h2>
            <p className="mt-3 text-[#4A6FA5] max-w-2xl mx-auto">{t("نقدم مجموعة متكاملة من الخدمات الهندسية التي تغطي جميع مراحل المشروع", "We offer an integrated suite of engineering services covering all project phases")}</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service, i) => {
              const Icon = service.icon;
              return (
                <motion.div key={service.titleEn} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="group p-6 bg-white rounded-2xl border border-blue-100/50 hover:border-[#0F2557]/20 hover:shadow-[0_12px_40px_rgba(15,37,87,0.1)] transition-all duration-400 cursor-pointer hover:-translate-y-1.5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0F2557] to-[#1A4A8B] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-[0_4px_12px_rgba(15,37,87,0.2)]">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0A1628] mb-2">{t(service.title, service.titleEn)}</h3>
                  <p className="text-sm text-[#4A6FA5] leading-relaxed">{t(service.desc, service.descEn)}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ===== ABOUT SECTION ===== */}
      <section id="about" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-[#EFF6FF] text-[#1A4A8B] rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
              <Award className="w-4 h-4" />
              {t("من نحن", "About Us")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0A1628] tracking-tight">{t("لماذا تختار BluePrint؟", "Why Choose BluePrint?")}</h2>
            <p className="mt-3 text-[#4A6FA5] max-w-2xl mx-auto">{t("نحن شريكك الهندسي الموثوق في رأس الخيمة - نجمع بين الإبداع والدقة والموثوقية", "Your trusted engineering partner in Ras Al Khaimah - combining creativity, precision, and reliability")}</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: "فريق مهني متخصص", titleEn: "Specialized Professional Team", desc: "مهندسون معتمدون ذوو خبرات واسعة في مشاريع رأس الخيمة", descEn: "Certified engineers with extensive experience in RAK projects" },
              { icon: FileCheck, title: "خبرة في الموافقات الحكومية", titleEn: "Government Approvals Expertise", desc: "علاقات مميزة مع البلدية والدفاع المدني وجهات الترخيص", descEn: "Strong relationships with Municipality and licensing authorities" },
              { icon: Target, title: "التزام بالمواعيد", titleEn: "Commitment to Deadlines", desc: "التزام صارم بجدول المواعيد وتسليم المشاريع في الوقت المحدد", descEn: "Strict commitment to project timelines and on-schedule delivery" },
              { icon: Star, title: "أسعار تنافسية", titleEn: "Competitive Pricing", desc: "أسعار شفافة وعادلة مع الحفاظ على أعلى مستويات الجودة", descEn: "Transparent and fair pricing with highest quality standards" },
              { icon: Zap, title: "نهج رقمي متطور", titleEn: "Advanced Digital Approach", desc: "نستخدم أحدث التقنيات لإدارة المشاريع والتواصل مع العملاء", descEn: "We use the latest technologies for project management" },
              { icon: Headphones, title: "دعم متواصل", titleEn: "Continuous Support", desc: "فريق خدمة عملاء متاح للإجابة على استفساراتكم", descEn: "Customer service team available to answer your inquiries" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center p-8 rounded-2xl bg-gradient-to-b from-[#EFF6FF]/80 to-white border border-blue-100/40 hover:shadow-[0_12px_40px_rgba(15,37,87,0.1)] hover:-translate-y-1.5 transition-all duration-400">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] text-[#0F2557] mb-4 shadow-[0_2px_8px_rgba(15,37,87,0.08)]">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0A1628] mb-2">{t(item.title, item.titleEn)}</h3>
                  <p className="text-sm text-[#4A6FA5] leading-relaxed">{t(item.desc, item.descEn)}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ===== CONTACT SECTION ===== */}
      <ContactSection company={company} />

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#0A1628] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <LogoImage size={32} />
              <div>
                <h3 className="text-white font-bold">BluePrint</h3>
                <p className="text-blue-200/60 text-xs">{t("مكتب الاستشارات الهندسية", "Engineering Consultancy")}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-blue-200/60">
              {NAV_LINKS.map((link) => (
                <Link key={link.href + link.labelEn} href={link.href} className="hover:text-white transition-colors">
                  {t(link.label, link.labelEn)}
                </Link>
              ))}
            </div>
            <p className="text-blue-200/40 text-sm">© {new Date().getFullYear()} BluePrint. {t("جميع الحقوق محفوظة", "All rights reserved")}</p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 end-6 z-50 w-12 h-12 bg-[#0F2557] text-white rounded-full shadow-lg hover:bg-[#1A4A8B] transition-colors flex items-center justify-center"
          aria-label={t("العودة للأعلى", "Back to top")}
        >
          <ArrowUpRight className="w-5 h-5 rotate-[-45deg]" />
        </motion.button>
      )}
    </div>
  );
}
