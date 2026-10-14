"use client";

import { useEffect } from "react";
import { initAuthFetch } from "@/lib/api/auth-fetch";
import { initAuthStore } from "@/store/auth-store";
import { safeRandomUUID } from "@/lib/utils";

const CSRF_COOKIE_NAME = 'csrf_token';

/**
 * Generate a random CSRF token (client-side, safe for both HTTPS and HTTP)
 */
function generateCsrfToken(): string {
  return safeRandomUUID().replace(/-/g, '');
}

/**
 * Check if the CSRF cookie already exists
 */
function hasCsrfCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes(`${CSRF_COOKIE_NAME}=`);
}

/**
 * Set the CSRF cookie if it doesn't already exist.
 * Previously this was done by the proxy/middleware on page GET requests.
 * Now that the proxy only handles /api/* routes, we set it client-side.
 */
function ensureCsrfCookie(): void {
  if (typeof document === 'undefined') return;
  if (hasCsrfCookie()) return;

  const token = generateCsrfToken();
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; max-age=86400; sameSite=strict${secure}`;
}

/**
 * CSRF Provider Component
 * Initializes the global fetch wrapper to automatically include
 * CSRF tokens on all mutation requests, and ensures the CSRF
 * cookie exists on the client.
 *
 * Must be rendered on the client side, inside the root layout.
 * Place it as high as possible in the component tree.
 */
export function CsrfProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Ensure CSRF cookie exists (previously set by middleware on page requests)
    ensureCsrfCookie();
    // Initialize auth-aware fetch (includes CSRF + 401 refresh handling)
    initAuthFetch();
    // Initialize auth store after fetch is configured to avoid race condition
    initAuthStore();
  }, []);

  return <>{children}</>;
}
