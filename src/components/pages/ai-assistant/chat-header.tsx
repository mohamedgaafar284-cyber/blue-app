"use client";


import { useTranslations } from 'next-intl';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Bot, Trash2, Download, PanelLeftOpen, Zap } from "lucide-react";
import { quickActions } from "./constants";

interface ChatHeaderProps {
  isAr: boolean;
  sidebarOpen: boolean;
  messagesLength: number;
  clearDialogOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setClearDialogOpen: (open: boolean) => void;
  exportChat: () => void;
  clearChat: () => void;
  onQuickAction: (text: string) => void;
  isLoading: boolean;
}

export function ChatHeader({
  isAr,
  sidebarOpen,
  messagesLength,
  clearDialogOpen,
  setSidebarOpen,
  setClearDialogOpen,
  exportChat,
  clearChat,
  onQuickAction,
  isLoading,
}: ChatHeaderProps) {
  const tAuto = useTranslations();
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-lg border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-navy-600 hover:border-brand-navy-300 dark:hover:border-brand-navy-700"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Open chat history"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {tAuto('auto.chatHistory')}
            </TooltipContent>
          </Tooltip>

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-navy-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-brand-navy-500/25">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {tAuto('auto.bluePrintAIAssistant')}
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {tAuto('auto.onlineAndReady')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            <Zap className="h-3 w-3 text-violet-500" />
            <span className="font-medium">BluePrint AI</span>
          </div>

          {/* Export Chat */}
          {messagesLength > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={exportChat}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 h-8 gap-1.5 rounded-lg"
              title={tAuto('auto.exportChat')}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tAuto('auto.export')}</span>
            </Button>
          )}

          {/* Clear Chat */}
          {messagesLength > 0 && (
            <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-red-500 h-8 gap-1.5 rounded-lg"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tAuto('auto.clear')}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto" dir={isAr ? "rtl" : "ltr"}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-red-500" />
                    {tAuto('auto.clearChat')}
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {tAuto('auto.areYouSureYouWantToClearAllMessagesThisA')}
                </p>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setClearDialogOpen(false)}
                    className="h-9 rounded-lg"
                  >
                    {tAuto('auto.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={clearChat}
                    className="h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5 me-1.5" />
                    {tAuto('auto.clearAll')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        {quickActions.map((action) => (
          <button
            key={action.en}
            onClick={() => onQuickAction(isAr ? action.arMsg : action.enMsg)}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap transition-all shrink-0",
              "hover:shadow-md active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
              `border-slate-200 dark:border-slate-700 hover:border-transparent`,
              `hover:bg-gradient-to-r ${action.color} hover:text-white hover:shadow-lg`,
              `text-slate-600 dark:text-slate-400`
            )}
          >
            <action.icon className="h-3.5 w-3.5" />
            {isAr ? action.ar : action.en}
          </button>
        ))}
      </div>
    </>
  );
}
