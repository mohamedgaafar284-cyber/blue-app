"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useNavStore } from "@/store/nav-store";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { isOfflineClient, toggleOfflineOverride } from "@/lib/offline-sync";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useA11yCheck, useReducedMotion } from "@/hooks/use-accessibility";
import Breadcrumbs from "@/components/layout/breadcrumbs";
import QuickActions from "@/components/layout/quick-actions";
import WelcomeModal from "@/components/layout/welcome-modal";
import OnboardingWizard from "@/components/onboarding/onboarding-wizard";
import ShortcutsOverlay from "@/components/layout/shortcuts-overlay";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";
import WelcomeNotification from "@/components/welcome-notification";
import ErrorBoundary from '@/components/common/error-boundary';
import { SkipNavContent } from '@/components/common/accessible-components';
import { PageLoadingSkeleton } from '@/components/common/page-loading-skeleton';
import { AnimatePresence, motion } from "framer-motion";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { GuidedTour } from "@/components/guided-tour";
import { useTranslations, useLocale } from "next-intl";

// ===== MAIN APP LAYOUT =====
//
// NOTE: The legacy hash-based SPA routing (~120 lines of
// `{currentPage === "..." && <XPage />}` conditionals + hashchange listener)
// has been removed. File-based routing via Next.js App Router is now the only
// path. The `useFileRouting` prop has been removed — callers always pass
// `children` which are rendered inside the page transition wrapper.
//
// Benefits of this removal:
//   - ~200-400 KB of dead JS no longer shipped to every dashboard route
//   - No more dual-routing-system confusion (hash vs file)
//   - Page transitions keyed on `pathname` (the source of truth) instead of
//     `currentPage` (Zustand state that could drift from the URL)

interface AppLayoutProps {
  language: "ar" | "en";
  children?: React.ReactNode;
}

export default function AppLayout({ language, children }: AppLayoutProps) {
  const { setRouter } = useNavStore();
  const locale = useLocale();
  const _t = useTranslations("layout");
  const _isAr = locale === "ar";

  const router = useRouter();
  const pathname = usePathname();
  const { open: commandPaletteOpen, onOpenChange: setCommandPaletteOpen } = useCommandPalette();

  // Inject Next.js router instance to the Zustand navigation store
  useEffect(() => {
    setRouter(router);
    return () => {
      setRouter(null);
    };
  }, [router, setRouter]);

  // Synchronize nav store state when Next.js file-based routing triggers path changes
  useEffect(() => {
    useNavStore.getState().initFromUrl();
  }, [pathname]);

  useKeyboardShortcuts();
  usePushNotifications();

  // Accessibility checks — dev only. The hook also checks NODE_ENV internally
  // before logging, but we pass `enabled` to skip the DOM scans entirely in prod.
  useA11yCheck({ enabled: process.env.NODE_ENV === 'development' });

  // Respect the user's "Reduce motion" OS preference for the page transition.
  const prefersReducedMotion = useReducedMotion();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(isOfflineClient());

    const handleNetworkChange = () => {
      setOffline(isOfflineClient());
    };

    window.addEventListener("blueprint-network-status-change", handleNetworkChange);
    window.addEventListener("online", handleNetworkChange);
    window.addEventListener("offline", handleNetworkChange);

    return () => {
      window.removeEventListener("blueprint-network-status-change", handleNetworkChange);
      window.removeEventListener("online", handleNetworkChange);
      window.removeEventListener("offline", handleNetworkChange);
    };
  }, []);

  // ===== Onboarding check =====
  // Check if the user has completed onboarding. We use a combination of:
  // 1. localStorage flag (fast, avoids flash of content on refresh)
  // 2. API check (authoritative, synced across devices)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    // Fast path: if localStorage says completed, skip the API check
    const localFlag = localStorage.getItem("blueprint-onboarding-completed");
    if (localFlag === "true") {
      // Use requestAnimationFrame to avoid the cascading-render lint warning
      requestAnimationFrame(() => setOnboardingChecked(true));
      return;
    }

    // Otherwise, check the API
    fetch("/api/user/onboarding", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.onboardingCompleted) {
          localStorage.setItem("blueprint-onboarding-completed", "true");
        } else {
          setShowOnboarding(true);
        }
      })
      .catch(() => {
        // On error, don't show onboarding — graceful degradation
      })
      .finally(() => {
        setOnboardingChecked(true);
      });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "?" && !isInputFocused) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Whether the current route is the dashboard home (controls WelcomeModal visibility)
  const isDashboardHome = pathname === "/dashboard" || pathname === "/dashboard/";

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--sidebar-width-mobile": "20rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-col flex-1">
          {offline && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-400 px-4 py-2 text-xs flex items-center justify-between font-sans">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                {_isAr 
                  ? "⚠️ أنت تعمل الآن بدون اتصال بالإنترنت. سيتم حفظ جميع التعديلات ومزامنتها تلقائياً عند استعادة الاتصال."
                  : "⚠️ You are working offline. All changes will be saved locally and synced automatically when connection is restored."}
              </span>
              <button
                onClick={() => {
                  toggleOfflineOverride("online");
                  toast.success(_isAr ? "تم استعادة الاتصال بالإنترنت!" : "Connection restored!");
                }}
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
              >
                {_isAr ? "محاكاة اتصال" : "Simulate Online"}
              </button>
            </div>
          )}
          {!offline && typeof window !== "undefined" && localStorage.getItem("blueprint_offline_override") === "offline" && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-800 dark:text-emerald-400 px-4 py-2 text-xs flex items-center justify-between font-sans">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {_isAr ? "الاتصال بالإنترنت نشط." : "Connection is online."}
              </span>
              <button
                onClick={() => {
                  toggleOfflineOverride("offline");
                  toast.warning(_isAr ? "تم قطع الاتصال بالإنترنت!" : "Disconnected!");
                }}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
              >
                {_isAr ? "محاكاة انقطاع" : "Simulate Offline"}
              </button>
            </div>
          )}
          <Breadcrumbs language={language} />
          {/*
            Main content area.
            - `flex-1` so it grows to fill below the header/breadcrumbs.
            - `overflow-y-auto` is a no-op in the current layout (the
              SidebarProvider wrapper has `min-h-svh` not `h-svh`, so the
              body scrolls, not this main) — kept for future-proofing if
              the wrapper ever gains an explicit height.
            - `pb-[calc(...)]` reserves room for the fixed MobileBottomNav
              (~64px tall + iOS safe-area) so the last cards/rows aren't
              hidden behind it on mobile. `md:pb-6` gives a small breathing
              room on desktop where the bottom nav is hidden.
          */}
          <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
            <SkipNavContent />
            <ErrorBoundary locale={language}>
            <Suspense fallback={<PageLoadingSkeleton />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.995 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.995 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {/* File-based routing: render children from Next.js page routes */}
                {children}
              </motion.div>
            </AnimatePresence>
            </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </SidebarInset>

      <QuickActions language={language} />
      {isDashboardHome && <WelcomeModal language={language} />}
      <WelcomeNotification />
      <ShortcutsOverlay language={language} open={showShortcuts} onOpenChange={setShowShortcuts} />
      <MobileBottomNav language={language} />
      
      {/* 🚀 Universal Command Palette (Ctrl+K) */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      
      {/* Guided Tour for Demo Mode */}
      <GuidedTour language={language} />

      {/* Onboarding wizard — shown as overlay for new users */}
      {showOnboarding && onboardingChecked && (
        <OnboardingWizard language={language} onComplete={handleOnboardingComplete} />
      )}
    </SidebarProvider>
  );
}
