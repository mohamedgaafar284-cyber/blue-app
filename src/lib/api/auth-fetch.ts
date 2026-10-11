/**
 * Auth-Aware Global Fetch Wrapper
 * غلاف طلبات API مع مصادقة تلقائية
 *
 * This module patches the global `fetch` to automatically:
 * 1. Include CSRF tokens on mutation requests (via csrf-fetch)
 * 2. Intercept 401 responses and attempt token refresh
 * 3. Retry the original request after successful refresh
 * 4. Redirect to login page when refresh fails
 *
 * Must be initialized on the client side only (call initAuthFetch() once).
 * Typically called from CsrfProvider or a similar root-level provider.
 */

import { initCsrfFetch } from '@/lib/api/csrf-fetch';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Routes that should NOT trigger the refresh flow */
const REFRESH_EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/ws-token',
  '/api/auth/session',
  '/api/auth/demo-credentials',
];

/** Maximum number of refresh attempts before giving up */
const _MAX_REFRESH_ATTEMPTS = 1;

// ─── State ──────────────────────────────────────────────────────────────────

/** Reference to the true native fetch, captured before any patching */
const NATIVE_FETCH: typeof fetch | null = typeof window !== 'undefined' ? window.fetch : null;
let initialized = false;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if a URL is an auth route that should be exempt from refresh.
 */
function isAuthRoute(url: string): boolean {
  return REFRESH_EXEMPT_ROUTES.some(route => url.includes(route));
}

/**
 * Attempt to refresh the access token by calling /api/auth/refresh.
 * Returns true if refresh was successful, false otherwise.
 *
 * Uses a shared promise to prevent multiple concurrent refresh requests
 * (if multiple API calls fail with 401 at the same time, only one refresh
 * request is made and all callers wait for the same result).
 */
async function attemptTokenRefresh(): Promise<boolean> {
  // If a refresh is already in progress, wait for it
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        return true;
      }

      // If refresh returns 401 (invalid/expired token) or 500 (server error),
      // the session is unrecoverable — clear stale cookies and reject.
      // This prevents infinite retry loops when the refresh token is orphaned
      // or the database has inconsistent data.
      if (response.status === 401 || response.status === 500) {
        // Best-effort: call logout to clear cookies server-side
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
      }

      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Redirect the user to the dashboard (which shows the login form
 * when not authenticated). Uses window.location for a hard redirect
 * to clear any stale client state.
 */
function redirectToLogin(): void {
  if (typeof window !== 'undefined') {
    // Avoid reloading if we are already on the dashboard/login page
    if (window.location.pathname !== '/dashboard' && window.location.pathname !== '/login') {
      window.location.replace('/dashboard');
    }
  }
}

// ─── Initialization ─────────────────────────────────────────────────────────

/**
 * Initialize the auth-aware fetch wrapper.
 * Call this once on the client side (e.g., in a provider or layout).
 *
 * This does TWO things:
 * 1. Initializes the CSRF fetch wrapper (csrf-fetch.ts)
 * 2. Wraps it with 401 response handling and automatic token refresh
 *
 * The layering works like this:
 *   window.fetch → authAwareFetch → csrfAwareFetch → originalFetch
 */
export function initAuthFetch(): void {
  if (typeof window === 'undefined' || initialized) return;

  // First, initialize the CSRF fetch wrapper
  initCsrfFetch();

  // Save a reference to the current fetch (which is now the CSRF-patched one)
  const csrfPatchedFetch = window.fetch;
  initialized = true;

  window.fetch = async function authAwareFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Clone the request if it has a body, so the retry can reuse it
    // (Request body can only be consumed once; cloning preserves it for retry)
    const clonedInput = input instanceof Request ? input.clone() : null;

    // Make the initial request via the CSRF-patched fetch
    const response = await csrfPatchedFetch.call(window, input, init);

    // If not a 401, return the response as-is
    if (response.status !== 401) {
      return response;
    }

    // Determine the URL from the request input
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;

    // Don't try to refresh for auth routes (login, register, etc.)
    if (isAuthRoute(url)) {
      return response;
    }

    // Don't retry if this was already a retry (prevent infinite loops)
    const isRetry = init?.headers instanceof Headers
      ? init.headers.has('X-Auth-Retry')
      : typeof init?.headers === 'object' && init?.headers !== null
        ? 'X-Auth-Retry' in (init.headers as Record<string, unknown>)
        : false;

    if (isRetry) {
      // Already retried once — refresh failed, redirect to login
      redirectToLogin();
      return response;
    }

    // Attempt to refresh the token
    const refreshed = await attemptTokenRefresh();

    if (!refreshed) {
      // Refresh failed — redirect to login
      redirectToLogin();
      return response;
    }

    // Token refreshed successfully — retry the original request
    // Add a header to mark this as a retry and prevent infinite loops
    const retryHeaders = new Headers(init?.headers as HeadersInit || {});
    retryHeaders.set('X-Auth-Retry', 'true');

    const retryInit: RequestInit = {
      ...init,
      headers: retryHeaders,
    };

    return csrfPatchedFetch.call(window, clonedInput || input, retryInit);
  };
}

/**
 * Restore the original native fetch (for testing or cleanup).
 */
export function restoreAuthFetch(): void {
  if (NATIVE_FETCH && typeof window !== 'undefined' && initialized) {
    window.fetch = NATIVE_FETCH;
    initialized = false;
  }
}
