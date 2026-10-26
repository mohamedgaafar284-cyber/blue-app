"use client";


import { useTranslations } from 'next-intl';
import { useState } from "react";
import { useNavStore } from "@/store/nav-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FolderKanban,
  List,
  Receipt,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickEntryModal } from "@/components/pages/finance/quick-entry-modal";

interface QuickActionsProps {
  language: "ar" | "en";
}

interface QuickAction {
  id: string;
  labelAr: string;
  labelEn: string;
  page: string;
  icon: typeof Plus;
}

const actions: QuickAction[] = [
  {
    id: "quick-money",
    labelAr: "سجّل حركة مالية",
    labelEn: "Quick Money Entry",
    page: "__money__", // special: opens the QuickEntryModal instead of navigating
    icon: Wallet,
  },
  {
    id: "project",
    labelAr: "مشروع جديد",
    labelEn: "New Project",
    page: "projects",
    icon: FolderKanban,
  },
  {
    id: "task",
    labelAr: "مهمة جديدة",
    labelEn: "New Task",
    page: "tasks",
    icon: List,
  },
  {
    id: "invoice",
    labelAr: "فاتورة جديدة",
    labelEn: "New Invoice",
    page: "financial-invoices",
    icon: Receipt,
  },
  {
    id: "client",
    labelAr: "عميل جديد",
    labelEn: "New Client",
    page: "clients",
    icon: Users,
  },
];

export default function QuickActions({ language }: QuickActionsProps) {
  const tAuto = useTranslations();
  const isAr = language === "ar";
  const [open, setOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const { setCurrentPage } = useNavStore();

  const handleAction = (page: string) => {
    if (page === "__money__") {
      setMoneyOpen(true);
      setOpen(false);
      return;
    }
    setCurrentPage(page);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-24 md:bottom-6 z-40" style={{ [isAr ? "left" : "right"]: "24px" }}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              className={cn(
                "h-14 w-14 rounded-full shadow-lg shadow-brand-navy-500/25 bg-gradient-to-br from-brand-navy-500 to-cyan-600 hover:from-brand-navy-600 hover:to-cyan-700 text-white p-0 transition-all backdrop-blur-md",
                open && "rotate-45"
              )}
              aria-label={open ? "Close quick actions" : "Open quick actions"}
            >
              {open ? (
                <X className="h-6 w-6" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </Button>
          </motion.div>
        </PopoverTrigger>
        <PopoverContent
          align={isAr ? "end" : "start"}
          side="top"
          className="w-auto p-2 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-700/30 shadow-xl mb-2"
        >
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-1"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-1.5">
                  {tAuto('auto.quickActions')}
                </p>
                <Separator />
                {actions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.id}
                      initial={{ opacity: 0, x: isAr ? -10 : 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleAction(action.page)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
                        "hover:bg-brand-navy-50 dark:hover:bg-brand-navy-950/30",
                        "text-slate-700 dark:text-slate-300",
                        "transition-colors cursor-pointer text-start w-full"
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand-navy-100 dark:bg-brand-navy-900/50 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400" />
                      </div>
                      <span className="font-medium">
                        {isAr ? action.labelAr : action.labelEn}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverContent>
      </Popover>

      {/* ⚡ Quick money entry — fixed server-resolved ledger posting */}
      <QuickEntryModal language={language} open={moneyOpen} onOpenChange={setMoneyOpen} />
    </div>
  );
}
