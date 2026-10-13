/**
 * Next.js Proxy (previously middleware) — Security Headers + JWT Auth Proxy + Rate Limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { getJwtSecretBytes } from '@/lib/auth/jwt-secret';
import { 
  RateLimitTier, 
  classifyRateLimitTier, 
  getProxyClientIP, 
  checkProxyRateLimit, 
  RATE_LIMIT_TIERS 
} from '@/lib/middleware/rate-limit';
import { 
  addSecurityHeaders, 
  timingSafeCompare, 
  getAllowedOrigin,
  buildCsp
} from '@/lib/middleware/security';
import { isRouteAllowedForRole } from '@/lib/permissions';

const COOKIE_NAME = 'blue_token';

const PUBLIC_API_ROUTES = [
  '/api/auth/login', '/api/auth/register',
  '/api/auth/demo-credentials',
  '/api/auth/session', '/api/auth/forgot-password', '/api/auth/reset-password',
  '/api/auth/verify-email', '/api/auth/resend-verification',
  '/api/auth/2fa/verify', // Only the verify endpoint is public (uses blue_2fa_temp cookie)
  '/api/auth/ws-token', '/api/auth/refresh',
  '/api/auth/logout', '/api/auth/2fa', '/api/auth/me', '/api/auth/verify-turnstile',
  // First-run setup wizard (no JWT exists yet — endpoint is fail-closed:
  // it refuses to create anything once any user exists, see setup-admin/route.ts)
  '/api/auth/setup-status', '/api/auth/setup-admin',
  '/api/auth/google', '/api/auth/google/callback', // Google OAuth social login
  '/api/auth/microsoft', '/api/auth/microsoft/callback', // Microsoft OAuth social login
  '/api/auth/setup-complete', // One-time setup token verification (no JWT yet)
  '/api/quote-requests', '/api/health',
  '/api/stripe/webhook', '/api/public',
  '/api/stripe/plans', '/api/portal',
  '/api/cron/cleanup', '/api/public/stats',
  '/api/whatsapp/webhook',
];

const CSRF_EXEMPT_PATHS = [
  '/api/stripe/webhook', '/api/health', '/api/auth/login',
  '/api/auth/register', '/api/auth/forgot-password',
  '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/resend-verification',
  '/api/auth/2fa/verify', '/api/auth/verify-turnstile',
  '/api/auth/refresh', '/api/auth/ws-token',
  // First-run setup: the POST fires before any session/CSRF cookie exists
  '/api/auth/setup-admin',
  '/api/quote-requests', '/api/cron/cleanup', '/api/public/stats',
  '/api/auth/google', '/api/auth/google/callback', // Google OAuth social login
  '/api/auth/microsoft', '/api/auth/microsoft/callback', // Microsoft OAuth social login
  '/api/auth/setup-complete', // One-time setup token verification
  '/api/whatsapp/webhook',
];

const PUBLIC_PAGE_ROUTES = [
  '/', '/services', '/calculator', '/quote', '/portal', '/about',
  '/forgot-password', '/reset-password', '/verify-email', '/2fa-setup',
  '/login', '/setup-complete',
  // First-run setup wizard (auto-redirects to /login once setup is done)
  '/setup',
  // /demo-showcase is the public features showcase page — must be
  // reachable without authentication so it can be used in presentations
  // to non-logged-in viewers.
  '/demo-showcase',
  // SECURITY: /dashboard is intentionally public so the dashboard layout can
  // render the login form inline for unauthenticated users (original design
  // intent — see src/app/dashboard/layout.tsx). Sub-routes (/dashboard/admin,
  // /dashboard/projects, etc.) are NOT public — they redirect to /login, which
  // is now a real route. The inline login form in the dashboard layout calls
  // /api/auth/login on submit; once the JWT cookie is set, the user is
  // redirected into the authenticated dashboard.
  '/dashboard',
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isPublicPageRoute(pathname: string): boolean {
  return PUBLIC_PAGE_ROUTES.some((route) => pathname === route);
}

function isStaticFile(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/workbox-*.js' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.endsWith('.webmanifest') ||
    // NOTE: media extensions (mp4, webm, mov, m4v, mp3, wav, ogg, m4a, aac, flac)
    // MUST be in this list. Without them, requests for media files in /public
    // (e.g. /hero.mp4 on the landing page) fall through to the auth check and
    // get redirected to /login for unauthenticated visitors — which returns an
    // HTML page instead of the binary asset, so <video> can't decode it and
    // silently shows its <img> fallback. This was the root cause of the
    // "hero video not playing" regression after Task 7 (the file was correctly
    // bundled at public/hero.mp4, but the middleware blocked anonymous
    // browsers from fetching it).
    /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json|webmanifest|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac|flac|avi|mkv)$/i.test(pathname)
  );
}

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some(p => pathname === p);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = crypto.randomUUID().replace(/-/g, '');

  if (isStaticFile(pathname)) {
    return NextResponse.next();
  }

  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    const allowedOrigin = getAllowedOrigin(request);
    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRF-Token, Cache-Control');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return addSecurityHeaders(response, nonce);
  }

  const rateLimitTier = classifyRateLimitTier(pathname);
  let rlInfo: { tier: RateLimitTier; remaining: number; resetTime: number; limit: number } | undefined;

  if (rateLimitTier) {
    const clientIp = getProxyClientIP(request.headers);
    const rlResult = await checkProxyRateLimit(clientIp, rateLimitTier, request.nextUrl.origin);

    if (!rlResult.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': rlResult.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': RATE_LIMIT_TIERS[rateLimitTier].maxRequests.toString(),
            'X-RateLimit-Remaining': rlResult.remaining.toString(),
            'X-RateLimit-Reset': rlResult.resetTime.toString(),
            'X-RateLimit-Tier': rateLimitTier,
          },
        }
      );
      return addSecurityHeaders(response, nonce, rlInfo);
    }

    rlInfo = {
      tier: rlResult.tier,
      remaining: rlResult.remaining,
      resetTime: rlResult.resetTime,
      limit: RATE_LIMIT_TIERS[rateLimitTier].maxRequests,
    };
  }

  const isBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');
  if (
    pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
    !isCsrfExempt(pathname) &&
    !isBearerAuth
  ) {
    const csrfToken = request.headers.get('X-CSRF-Token');
    const cookieCsrf = request.cookies.get('csrf_token')?.value;
    if (!csrfToken || !cookieCsrf || !(await timingSafeCompare(csrfToken, cookieCsrf))) {
      const response = NextResponse.json(
        { error: 'CSRF token validation failed' },
        { status: 403 }
      );
      return addSecurityHeaders(response, nonce, rlInfo);
    }
  }

  if (isPublicApiRoute(pathname) || isPublicPageRoute(pathname)) {
    const pubToken = request.cookies.get(COOKIE_NAME)?.value ||
      (request.headers.get('authorization')?.startsWith('Bearer ')
        ? request.headers.get('authorization')!.substring(7)
        : null);

    if (pubToken && pubToken !== 'httpOnly') {
      try {
        const { payload } = await jose.jwtVerify(pubToken, getJwtSecretBytes(), {
          issuer: 'blueprint-saas',
          audience: 'blueprint-users',
        });

        // SECURITY: Reject non-access token types (e.g. '2fa-pending', 'password-reset')
        // Password-reset tokens share the same issuer/audience but should NEVER
        // be accepted as authentication — they only contain userId and type.
        const tokenType = payload.type as string | undefined;
        if (tokenType && tokenType !== 'access') {
          // Silently skip for public routes — don't set auth headers
          const response = NextResponse.next();
          return addSecurityHeaders(response, nonce, rlInfo);
        }

        const pubIat = payload.iat as number | undefined;
        const pubPasswordChangedAt = payload.passwordChangedAt as number | undefined;
        if (pubIat && pubPasswordChangedAt && pubPasswordChangedAt > pubIat) {
          const response = NextResponse.next();
          return addSecurityHeaders(response, nonce, rlInfo);
        }

        const requestHeaders = new Headers(request.headers);
        for (const key of requestHeaders.keys()) {
          if (key.toLowerCase().startsWith('x-user-')) {
            requestHeaders.delete(key);
          }
        }
        requestHeaders.set('x-user-id', payload.userId as string);
        requestHeaders.set('x-user-email', payload.email as string);
        requestHeaders.set('x-user-role', payload.role as string);
        requestHeaders.set('x-user-name', encodeURIComponent((payload.name as string) || ''));
        if (payload.organizationId) {
          requestHeaders.set('x-organization-id', payload.organizationId as string);
        }
        requestHeaders.set('x-user-email-verified', String(payload.emailVerified ?? true));
        // SECURITY: Forward the per-request CSP nonce so server components can
        // embed it in <script nonce="..."> tags. The nonce is also used to build
        // the CSP header in addSecurityHeaders(); without this, inline scripts
        // in server components would be blocked by the browser's CSP enforcement.
        requestHeaders.set('x-nonce', nonce);
        requestHeaders.set('Content-Security-Policy', buildCsp(nonce));
        const response = NextResponse.next({ request: { headers: requestHeaders } });
        return addSecurityHeaders(response, nonce, rlInfo);
      } catch {
        // Ignored for public routes
      }
    }
    const response = NextResponse.next();
    return addSecurityHeaders(response, nonce, rlInfo);
  }

  const token = request.cookies.get(COOKIE_NAME)?.value ||
    (request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.substring(7)
      : null);

  if (!token || token === 'httpOnly') {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json(
        { error: 'يرجى تسجيل الدخول' },
        { status: 401 }
      );
      return addSecurityHeaders(response, nonce, rlInfo);
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecretBytes(), {
      issuer: 'blueprint-saas',
      audience: 'blueprint-users',
    });

    // SECURITY: Reject non-access token types (e.g. '2fa-pending', 'password-reset')
    // Password-reset tokens share the same issuer/audience but should NEVER
    // be accepted as authentication. Without this check, a password-reset token
    // would pass verification and set x-user-* headers with undefined values.
    const tokenType = payload.type as string | undefined;
    if (tokenType && tokenType !== 'access') {
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'Invalid token type' },
          { status: 401 }
        );
        response.cookies.set('blue_token', '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' });
        response.cookies.set('blue_refresh_token', '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' });
        return addSecurityHeaders(response, nonce, rlInfo);
      }
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const iat = payload.iat as number | undefined;
    const passwordChangedAt = payload.passwordChangedAt as number | undefined;
    if (iat && passwordChangedAt && passwordChangedAt > iat) {
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'يرجى تسجيل الدخول' },
          { status: 401 }
        );
        response.cookies.set('blue_token', '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' });
        response.cookies.set('blue_refresh_token', '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' });
        return addSecurityHeaders(response, nonce, rlInfo);
      }
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    const userId = payload.userId as string;
    const email = payload.email as string;
    const role = payload.role as string;
    const name = payload.name as string;
    const organizationId = payload.organizationId as string | undefined;

    // ROLE-BASED ROUTE GUARD: Enforce prefix/page/API access limits from permissions ROUTE_ROLE_MATRIX
    const guardPath = pathname.startsWith('/api/')
      ? pathname.replace('/api/', '/dashboard/')
      : pathname;


    if (
      (pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) &&
      !isRouteAllowedForRole(guardPath, role)
    ) {
      console.warn(`[SECURITY WARNING] Blocked unauthorized access: User ${userId} (role: ${role}) tried to access ${pathname}`);
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'Unauthorized route access' },
          { status: 403 }
        );
        return addSecurityHeaders(response, nonce, rlInfo);
      }
      const unauthorizedUrl = new URL('/unauthorized', request.url);
      return NextResponse.redirect(unauthorizedUrl);
    }

    const requestHeaders = new Headers(request.headers);
    for (const key of requestHeaders.keys()) {
      if (key.toLowerCase().startsWith('x-user-')) {
        requestHeaders.delete(key);
      }
    }
    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-email', email);
    requestHeaders.set('x-user-role', role);
    requestHeaders.set('x-user-name', encodeURIComponent(name || ''));
    if (organizationId) {
      requestHeaders.set('x-organization-id', organizationId);
    }
    requestHeaders.set('x-user-email-verified', String(payload.emailVerified ?? true));
    // SECURITY: Forward the per-request CSP nonce so server components can
    // embed it in <script nonce="..."> tags. The nonce is also used to build
    // the CSP header in addSecurityHeaders(); without this, inline scripts
    // in server components would be blocked by the browser's CSP enforcement.
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', buildCsp(nonce));

    // SECURITY: Restrict unverified users to email verification flows only
    // If emailVerified is explicitly false, only allow access to verification-related routes
    const emailVerified = payload.emailVerified as boolean | undefined;
    if (emailVerified === false) {
      const allowedPathsForUnverified = [
        '/verify-email',
        '/api/auth/verify-email',
        '/api/auth/resend-verification',
        '/api/auth/logout',
        '/api/auth/me',
        '/api/auth/refresh',
      ];
      const isAllowed = allowedPathsForUnverified.some(
        (p) => pathname === p || pathname.startsWith(p + '/')
      );
      // Also allow static assets and public pages needed for the UI
      const isStaticOrAsset = pathname.startsWith('/_next') ||
        pathname.startsWith('/images') || pathname.startsWith('/fonts') ||
        /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json|webmanifest)$/i.test(pathname);

      if (!isAllowed && !isStaticOrAsset) {
        if (pathname.startsWith('/api/')) {
          const resp = NextResponse.json(
            { error: 'يرجى تأكيد بريدك الإلكتروني أولاً' },
            { status: 403 }
          );
          return addSecurityHeaders(resp, nonce, rlInfo);
        }
        // Redirect page requests to verify-email
        const verifyUrl = new URL('/verify-email', request.url);
        return NextResponse.redirect(verifyUrl);
      }
    }

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    if (!request.cookies.get('csrf_token')?.value) {
      const csrfToken = crypto.randomUUID().replace(/-/g, '');
      response.cookies.set('csrf_token', csrfToken, {
        path: '/',
        httpOnly: false,
        secure: process.env.COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production',
        // SECURITY: SameSite=Strict prevents the CSRF cookie from being sent on
        // cross-site requests (including top-level navigations from external sites).
        // This is safe for the CSRF token because:
        //   1. It is only read by same-origin JS to embed in X-CSRF-Token header
        //   2. State-changing requests (POST/PUT/PATCH/DELETE) only come from the app itself
        //   3. External top-level navigations are GETs, which are CSRF-exempt
        // The auth cookies (blue_token / blue_refresh_token) remain SameSite=Lax
        // to support OAuth callback flows (Google / Microsoft login).
        sameSite: 'strict',
        maxAge: 60 * 60 * 24,
      });
    }

    return addSecurityHeaders(response, nonce, rlInfo);
  } catch {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json(
        { error: 'يرجى تسجيل الدخول' },
        { status: 401 }
      );
      return addSecurityHeaders(response, nonce, rlInfo);
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}
