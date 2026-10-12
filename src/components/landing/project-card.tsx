"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, Calendar, Tag, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Project } from "./data";

export function ProjectCard({
  project,
  index,
  language,
}: {
  project: Project;
  index: number;
  language: "ar" | "en";
}) {
  const [open, setOpen] = useState(false);
  const t = (ar: string, en: string) => (language === "ar" ? ar : en);
  const isAr = language === "ar";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={t(project.title, project.titleEn)}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-500 rounded-2xl"
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ delay: index * 0.1, duration: 0.6, ease: "easeOut" as const }}
          className="group relative overflow-hidden rounded-2xl cursor-pointer touch-manipulation select-none active:scale-[0.98] transition-transform duration-150"
        >
          <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden">
            <Image
              src={project.image}
              alt={t(project.title, project.titleEn)}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1D3A]/90 via-[#0B1D3A]/40 to-transparent opacity-70 group-hover:opacity-85 transition-opacity duration-300" />
            
            <div className="absolute top-4 start-4">
              <span className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-[#0B1D3A]">
                {t(project.category, project.categoryEn)}
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              whileHover={{ opacity: 1, scale: 1 }}
              className="absolute top-4 end-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
            >
              <ArrowUpRight className="w-5 h-5 text-[#0B1D3A]" />
            </motion.div>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 + 0.2 }}
            >
              <h3 className="text-xl font-bold text-white mb-2">
                {t(project.title, project.titleEn)}
              </h3>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <span>{project.year}</span>
                <span>•</span>
                <span>{t(project.location, project.locationEn)}</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Project Detail Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl" dir={isAr ? "rtl" : "ltr"}>
          <div className="relative aspect-video w-full overflow-hidden">
            <Image
              src={project.image}
              alt={t(project.title, project.titleEn)}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-4 start-6 end-6">
              <span className="px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full text-xs font-semibold text-[#0F2557] dark:text-cyan-400">
                {t(project.category, project.categoryEn)}
              </span>
              <h2 className="text-2xl font-bold text-white mt-2">
                {t(project.title, project.titleEn)}
              </h2>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <DialogHeader className="sr-only">
              <DialogTitle>{t(project.title, project.titleEn)}</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  {isAr ? "التصنيف" : "Category"}
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {t(project.category, project.categoryEn)}
                </p>
              </div>
              <div className="space-y-1 border-x border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {isAr ? "الموقع" : "Location"}
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {t(project.location, project.locationEn)}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {isAr ? "سنة الإنجاز" : "Year"}
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {project.year}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {isAr
                ? `مشروع هندسي متميز تم تصميمه وإدارته بواسطة فريق BluePrint للاستشارات الهندسية في ${project.location} بأعلى معايير الدقة والامتثال لمعايير البناء والسلامة.`
                : `A distinguished engineering project designed and managed by BluePrint Consultancy in ${project.locationEn}, adhering to the highest standards of safety and excellence.`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {isAr ? "إغلاق" : "Close"}
              </Button>
              <Link href="/quote" onClick={() => setOpen(false)}>
                <Button className="bg-gradient-to-r from-[#0F2557] to-[#1A4A8B] hover:from-[#1A4A8B] hover:to-[#2563EB] text-white rounded-xl shadow-md">
                  <span>{isAr ? "طلب مشروع مماثل" : "Request Similar Project"}</span>
                  <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
