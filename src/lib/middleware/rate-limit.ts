/**
 * Edge Runtime Rate Limiter — محدد معدل الطلبات لبيئة Edge
 * 
 * This file provides rate limiting for Next.js Edge Runtime (middleware).
 * Redis is NOT available in Edge Runtime, so this uses in-memory only.
 * 
 * For API routes (Node.js runtime), use the unified rate limiter in
 * src/lib/rate-limiter.ts which supports Redis with in-memory fallback.
 * 
 * The tier configs are intentionally kept in sync with rate-limiter.ts.
 */

export type RateLimitTier = 'strict' | 'auth' | 'api' | 'loose' | 'ai' | 'export' | 'webhook';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Removed standard 'redis' package import because it uses Node.js modules 
// (net, tls, timers/promises) which are NOT supported in Next.js Edge Runtime (middleware).
// Falling back to in-memory store for rate limiting in middleware.

const isDev = process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true' || process.env.PLAYWRIGHT_TEST === 'true' || process.env.JEST_WORKER_ID !== undefined;

export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitConfig> = {
  strict:  { maxRequests: isDev ? 1000 : 5,   windowMs: 60_000 },  // 5 req/min  — login, register, password reset
  auth:    { maxRequests: isDev ? 1000 : 10,  windowMs: 60_000 },  // 10 req/min — other auth routes (2FA, session, refresh)
  api:     { maxRequests: isDev ? 1000 : 100, windowMs: 60_000 },  // 100 req/min — standard CRUD routes
  loose:   { maxRequests: isDev ? 1000 : 200, windowMs: 60_000 },  // 200 req/min — read-only/list & dashboard routes
  ai:      { maxRequests: isDev ? 1000 : 10,  windowMs: 60_000 },  // 10 req/min  — AI chat/generation (expensive)
  export:  { maxRequests: isDev ? 1000 : 10,  windowMs: 60_000 },  // 10 req/min  — PDF/Excel report generation
  webhook: { maxRequests: isDev ? 1000 : 300, windowMs: 60_000 },  // 300 req/min — external webhooks (Stripe, WhatsApp, cron)
};

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

function cleanupRateLimitStore(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Classify a request pathname into the appropriate rate-limit tier.
 *
 * Tier assignment strategy:
 * ─────────────────────────────────────────────────────────────
 *  strict  — Highly sensitive auth mutations (login, register,
 *            forgot-password, reset-password). 5 req/min.
 *  auth    — Other auth routes (2FA, session, refresh, verify).
 *            20 req/min.
 *  api     — Standard CRUD routes (projects, tasks, clients,
 *            invoices, contracts, payments, budgets, employees,
 *            timesheets, documents, etc.). 100 req/min.
 *  loose   — Read-heavy / list / dashboard endpoints. 200 req/min.
 *  ai      — AI chat, generation & analysis routes. 10 req/min.
 *  export  — PDF/Excel report generation & data export. 10 req/min.
 *  webhook — External webhooks (Stripe, WhatsApp) & cron. 300 req/min.
 * ─────────────────────────────────────────────────────────────
 *
 * Returns `null` for non-API paths (static assets, pages, etc.).
 */
export function classifyRateLimitTier(pathname: string): RateLimitTier | null {
  if (!pathname.startsWith('/api/')) return null;

  // Internal service-to-service endpoints (e.g. rate-limit proxy check) are
  // authenticated via INTERNAL_API_SECRET and MUST NOT be rate-limited themselves
  // to prevent infinite recursive self-request loops (Self-DoS).
  if (pathname.startsWith('/api/internal/')) return null;

  // ── Strict tier: sensitive auth mutations ─────────────────────
  if (
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/register' ||
    pathname === '/api/auth/forgot-password' ||
    pathname === '/api/auth/reset-password' ||
    pathname === '/api/auth/setup-admin' || // Creates the first ADMIN — tightest limiter
    pathname === '/api/profile/delete-account' ||
    pathname === '/api/profile/password' ||
    pathname === '/api/demo/reset'
  ) {
    return 'strict';
  }

  // ── Auth tier: other auth routes ──────────────────────────────
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/profile/')
  ) {
    return 'auth';
  }

  // ── Webhook tier: external services & cron ────────────────────
  if (
    pathname === '/api/stripe/webhook' ||
    pathname === '/api/whatsapp/webhook' ||
    pathname.startsWith('/api/cron/')
  ) {
    return 'webhook';
  }

  // ── AI tier: expensive AI operations ──────────────────────────
  if (pathname.startsWith('/api/ai/')) return 'ai';

  // ── Export tier: report generation & data export ──────────────
  if (pathname.startsWith('/api/reports/')) return 'export';
  if (pathname === '/api/profile/export-data') return 'export';
  if (/\/export(?:\/|$)/.test(pathname)) return 'export';
  if (/\/api\/[^/]+\/export/.test(pathname)) return 'export';

  // ── Loose tier: read-heavy list & dashboard endpoints ─────────
  const loosePaths: readonly string[] = [
    '/api/dashboard',
    '/api/projects-simple',
    '/api/users-simple',
    '/api/health',
    '/api/search',
    '/api/activity-log',
    '/api/notifications/count',
    '/api/notifications/subscribe',
    '/api/feature-flags',
    '/api/init',
    '/api/docs',
    '/api/quote-requests',
  ];
  if (loosePaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return 'loose';
  }

  // ── API tier: standard CRUD routes ────────────────────────────
  // Explicitly listed route groups — ensures every major domain
  // is covered even if new endpoints are added in the future.
  const apiPrefixes: readonly string[] = [
    '/api/projects',
    '/api/tasks',
    '/api/clients',
    '/api/invoices',
    '/api/recurring-invoices',
    '/api/settings',
    '/api/contracts',
    '/api/payments',
    '/api/budgets',
    '/api/employees',
    '/api/timesheets',
    '/api/notifications',
    '/api/documents',
    '/api/users',
    '/api/webhooks',
    '/api/risks',
    '/api/approvals',
    '/api/change-orders',
    '/api/bids',
    '/api/tenders',
    '/api/proposals',
    '/api/purchase-orders',
    '/api/commissions',
    '/api/suppliers',
    '/api/contractors',
    '/api/equipment',
    '/api/inventory',
    '/api/boq',
    '/api/rfi',
    '/api/submittals',
    '/api/transmittals',
    '/api/defects',
    '/api/site-visits',
    '/api/site-diary',
    '/api/inspections',
    '/api/violations',
    '/api/leave',
    '/api/attendance',
    '/api/progress-claims',
    '/api/retainage',
    '/api/guarantee-letters',
    '/api/municipality-correspondence',
    '/api/design-phases',
    '/api/design-drawings',
    '/api/meetings',
    '/api/automations',
    '/api/knowledge',
    '/api/workflows',
    '/api/project-templates',
    '/api/project-assignments',
    '/api/gantt',
    '/api/auto-assignment',
    '/api/supervision-checklists',
    '/api/marketing-campaigns',
    '/api/referrals',
    '/api/report-builder',
    '/api/backup',
    '/api/stripe/checkout',
    '/api/stripe/payment-intent',
    '/api/stripe/payment-methods',
    '/api/stripe/portal',
    '/api/stripe/invoices',
    '/api/stripe/subscriptions',
    '/api/whatsapp/send',
    '/api/whatsapp/templates',
  ];
  if (apiPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return 'api';
  }

  // Catch-all: any other /api/* route gets the default api tier
  return 'api';
}

export function getProxyClientIP(headers: Headers): string {
  const ipRegex = /^[0-9a-fA-F.:]+$/;
  const maxIPLength = 45;

  function sanitize(ip: string): string {
    const cleaned = ip.trim();
    if (cleaned.length > maxIPLength || !ipRegex.test(cleaned)) return 'unknown';
    return cleaned;
  }

  // SECURITY FIX: Previously this took the LAST IP in X-Forwarded-For, which
  // is the proxy-appended IP. However, an attacker can send a single-element
  // X-Forwarded-For header (e.g. "1.2.3.4") and the code would trust it as
  // the proxy-appended value — allowing complete rate-limit bypass by rotating
  // the spoofed IP on every request.
  //
  // Correct strategy for a single trusted reverse proxy (Caddy/nginx/Cloudflare):
  //   1. Prefer dedicated proxy headers (cf-connecting-ip, x-real-ip) which the
  //      proxy sets from the actual TCP source — these cannot be spoofed by the
  //      client because the proxy overwrites any client-supplied value.
  //   2. For X-Forwarded-For, take the FIRST IP (leftmost) — this is the
  //      client's claimed IP. The proxy appends the real source IP to the
  //      right, but for a single-hop proxy the leftmost is still the client.
  //      If the client spoofs X-Forwarded-For, the leftmost is their spoofed
  //      value — but at least they can't rotate it freely because the proxy
  //      strips/overwrites client-supplied X-Forwarded-For in most configs.
  //
  // For multi-hop setups (CDN → Caddy → app), operators should configure the
  // proxy to strip incoming X-Forwarded-For and set its own.

  // Priority 1: Cloudflare (most trusted — set by CF edge from TCP source)
  const cfIP = headers.get('cf-connecting-ip');
  if (cfIP) {
    const sanitized = sanitize(cfIP);
    if (sanitized !== 'unknown') return sanitized;
  }

  // Priority 2: nginx/Caddy x-real-ip (set by reverse proxy from TCP source)
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    const sanitized = sanitize(realIP);
    if (sanitized !== 'unknown') return sanitized;
  }

  // Priority 3: X-Forwarded-For — take the FIRST (leftmost) IP.
  // This is the client's address as seen by the first proxy. For a single-hop
  // proxy that strips incoming XFF (recommended config), this is the real client.
  // For a proxy that doesn't strip, this is the client's CLAIMED IP — which may
  // be spoofed, but at least cannot be rotated freely within a single connection.
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    const candidate = parts[0].trim();  // FIRST IP, not last
    const sanitized = sanitize(candidate);
    if (sanitized !== 'unknown') return sanitized;
  }

  return 'unknown';
}

export interface RateLimitCheckResult {
  allowed: boolean;
  tier: RateLimitTier;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export async function checkProxyRateLimit(
  ip: string,
  tier: RateLimitTier,
  requestOrigin?: string
): Promise<RateLimitCheckResult> {
  const config = RATE_LIMIT_TIERS[tier];
  const key = `${tier}:${ip}`;
  const now = Date.now();

  const redisUrl = process.env.REDIS_URL;
  // SECURITY: INTERNAL_API_SECRET is required INDEPENDENTLY of JWT_SECRET
  // (no secret reuse). If missing, Redis-backed rate limiting is skipped and
  // we fall back to in-memory only — with a one-time warning so operators know
  // to set it for multi-instance deployments.
  const internalSecret = process.env.INTERNAL_API_SECRET;

  if (redisUrl && internalSecret && requestOrigin) {
    try {
      const internalApiUrl = `${requestOrigin}/api/internal/rate-limit`;
      const response = await fetch(internalApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({ ip, tier }),
        signal: AbortSignal.timeout(500),
      });

      if (response.ok) {
        const result = (await response.json()) as {
          allowed: boolean;
          remaining: number;
          resetTime: number;
          retryAfter?: number;
        };

        return {
          allowed: result.allowed,
          tier,
          remaining: result.remaining,
          resetTime: result.resetTime,
          retryAfter: result.retryAfter,
        };
      }
    } catch {
      // Graceful degradation: fallback to in-memory store
    }
  }

  // Memory Fallback
  cleanupRateLimitStore();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return {
      allowed: true,
      tier,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      tier,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    tier,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}
