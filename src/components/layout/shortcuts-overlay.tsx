"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutsOverlayProps {
  language: "ar" | "en";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

const shortcuts: ShortcutItem[] = [
  {
    keys: ["Ctrl", "K"],
    labelAr: "بحث",
    labelEn: "Search",
    descriptionAr: "فتح البحث العام",
    descriptionEn: "Open global search",
  },
  {
    keys: ["Alt", "N"],
    labelAr: "مشروع جديد",
    labelEn: "New Project",
    descriptionAr: "إنشاء مشروع جديد",
    descriptionEn: "Create a new project",
  },
  {
    keys: ["Alt", "T"],
    labelAr: "مهمة جديدة",
    labelEn: "New Task",
    descriptionAr: "إضافة مهمة جديدة",
    descriptionEn: "Add a new task",
  },
  {
    keys: ["Alt", "I"],
    labelAr: "فاتورة جديدة",
    labelEn: "New Invoice",
    descriptionAr: "إنشاء فاتورة جديدة",
    descriptionEn: "Create a new invoice",
  },
  {
    keys: ["Escape"],
    labelAr: "إغلاق",
    labelEn: "Close",
    descriptionAr: "إغلاق النافذة الحالية",
    descriptionEn: "Close current dialog",
  },
  {
    keys: ["?"],
    labelAr: "الاختصارات",
    labelEn: "Shortcuts",
    descriptionAr: "عرض اختصارات لوحة المفاتيح",
    descriptionEn: "Show keyboard shortcuts",
  },
  {
    keys: ["1"],
    labelAr: "لوحة التحكم",
    labelEn: "Dashboard",
    descriptionAr: "الذهاب إلى لوحة التحكم",
    descriptionEn: "Navigate to dashboard",
  },
  {
    keys: ["2"],
    labelAr: "المشاريع",
    labelEn: "Projects",
    descriptionAr: "الذهاب إلى المشاريع",
    descriptionEn: "Navigate to projects",
  },
  {
    keys: ["3"],
    labelAr: "المهام",
    labelEn: "Tasks",
    descriptionAr: "الذهاب إلى المهام",
    descriptionEn: "Navigate to tasks",
  },
  {
    keys: ["4"],
    labelAr: "العملاء",
    labelEn: "Clients",
    descriptionAr: "الذهاب إلى العملاء",
    descriptionEn: "Navigate to clients",
  },
  {
    keys: ["5"],
    labelAr: "الفواتير",
    labelEn: "Invoices",
    descriptionAr: "الذهاب إلى الفواتير",
    descriptionEn: "Navigate to invoices",
  },
  {
    keys: ["6"],
    labelAr: "التقويم",
    labelEn: "Calendar",
    descriptionAr: "الذهاب إلى التقويم",
    descriptionEn: "Navigate to calendar",
  },
];

function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md",
        "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
        "text-xs font-mono font-medium text-slate-600 dark:text-slate-300",
        "shadow-[0_1px_0_1px_rgba(0,0,0,0.05)]",
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default function ShortcutsOverlay({
  language,
  open,
  onOpenChange,
}: ShortcutsOverlayProps) {
  const isAr = language === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden border border-white/10 dark:border-slate-700/50 shadow-2xl">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/30">
              <Keyboard className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400" />
            </div>
            {t("اختصارات لوحة المفاتيح", "Keyboard Shortcuts")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.map((shortcut, idx) => (
              <div
                key={idx}
                className={cn(
                  "group flex flex-col gap-2 rounded-lg p-3 transition-colors",
                  "bg-slate-50 dark:bg-slate-800/50",
                  "hover:bg-brand-navy-50 dark:hover:bg-brand-navy-950/20",
                  "border border-transparent hover:border-brand-navy-200 dark:hover:border-brand-navy-800/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t(shortcut.labelAr, shortcut.labelEn)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {shortcut.keys.map((key, keyIdx) => (
                      <span key={keyIdx} className="contents">
                        {keyIdx > 0 && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mx-0.5">+</span>
                        )}
                        <Kbd>{key}</Kbd>
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  {t(shortcut.descriptionAr, shortcut.descriptionEn)}
                </p>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
              {t(
                "اضغط على Escape أو ؟ للإغلاق",
                "Press Escape or ? to close"
              )}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
