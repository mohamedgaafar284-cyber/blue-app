"use client";

import { useEffect, useCallback } from "react";
import { useNavStore } from "@/store/nav-store";

interface KeyboardShortcutsOptions {
  /** Whether shortcuts are active (default: true) */
  enabled?: boolean;
  /** Custom handler for Ctrl+K (overrides default open search) */
  onCtrlK?: () => void;
  /** Custom handler for Escape (overrides default go to dashboard) */
  onEscape?: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const { enabled = true, onCtrlK, onEscape } = options;
  const { setCurrentPage, currentPage } = useNavStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ctrl+K / Cmd+K: Open global search (works everywhere, even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (onCtrlK) {
          onCtrlK();
        } else {
          // Toggle: if already on search, go to dashboard; otherwise open search
          if (currentPage === "search") {
            setCurrentPage("dashboard");
          } else {
            setCurrentPage("search");
          }
        }
        return;
      }

      // Quick Creation Shortcuts (Ctrl + Shift + Key or Ctrl + Key when not typing)
      if ((e.metaKey || e.ctrlKey) && !isInputFocused) {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          setCurrentPage("projects");
          return;
        }
        if (e.key === "t" || e.key === "T") {
          e.preventDefault();
          setCurrentPage("tasks");
          return;
        }
        if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          setCurrentPage("financial-invoices");
          return;
        }
      }

      // Number Navigation Shortcuts (1-6) when not typing
      if (!isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const numberKeyMap: Record<string, string> = {
          "1": "dashboard",
          "2": "projects",
          "3": "tasks",
          "4": "clients",
          "5": "financial-invoices",
          "6": "calendar",
        };
        if (numberKeyMap[e.key]) {
          e.preventDefault();
          setCurrentPage(numberKeyMap[e.key]);
          return;
        }
      }

      // Escape: Close current view / go back to dashboard
      // Only fires when NOT in an input (except when search is open)
      if (e.key === "Escape") {
        if (isInputFocused && currentPage !== "search") return;
        e.preventDefault();
        if (onEscape) {
          onEscape();
        } else {
          setCurrentPage("dashboard");
        }
        return;
      }
    },
    [enabled, onCtrlK, onEscape, currentPage, setCurrentPage]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
