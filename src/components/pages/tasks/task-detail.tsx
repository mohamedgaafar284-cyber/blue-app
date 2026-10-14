"use client";


import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListChecks, Building2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import TaskComments from "@/components/pages/task-comments";
import { type TaskItem, getColumnLabel, getPriorityConfig } from "./types";

// ===== Task Detail Props =====
interface TaskDetailProps {
  ar: boolean;
  language: "ar" | "en";
  commentTask: TaskItem | null;
  onClose: () => void;
}

export function TaskDetail({ ar, language, commentTask, onClose }: TaskDetailProps) {
  const tAuto = useTranslations();
  return (
    <Sheet open={!!commentTask} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="left" className={cn(
        "w-full sm:w-[440px] p-0 flex flex-col",
        "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/50"
      )}>
        {commentTask && (
          <>
            <SheetHeader className="p-4 pb-0">
              <SheetTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 line-clamp-1">
                <ListChecks className="h-4 w-4 text-brand-navy-600 dark:text-brand-navy-400 shrink-0" />
                <span className="truncate">{commentTask.title}</span>
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  getPriorityConfig(commentTask.priority).color
                )}>
                  {ar ? getPriorityConfig(commentTask.priority).label : getPriorityConfig(commentTask.priority).labelEn}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                  {getColumnLabel(commentTask.status, ar)}
                </span>
                {commentTask.project && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {ar ? commentTask.project.name : (commentTask.project.nameEn || commentTask.project.name)}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="border-b border-slate-100 dark:border-slate-800 my-2" />

            <div className="flex-1 min-h-0 p-4">
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-brand-navy-600 dark:text-brand-navy-400" />
                  {tAuto('auto.comments')}
                </h4>
              </div>
              <TaskComments taskId={commentTask.id} language={language} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
