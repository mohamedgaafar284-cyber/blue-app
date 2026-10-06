import { NextRequest, NextResponse } from 'next/server';
import { RateLimitTier } from './rate-limit';

export const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self)',
};

export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;

  // SECURITY NOTE on style-src:
  // - 'unsafe-inline' is kept for styles (NOT for scripts) because:
  //   1. Next.js App Router injects inline <style> tags for CSS-in-JS optimizations
  //   2. Tailwind CSS uses inline <style> for critical CSS extraction
  //   3. Radix UI components rely on inline styles for animations/positioning
  //   4. next-themes injects inline styles for theme color transitions
  //
  // - Per CSP Level 3 spec: when 'nonce-xxx' is present alongside 'unsafe-inline',
  //   modern browsers IGNORE 'unsafe-inline' and only allow nonce-tagged styles.
  //   So including both is SAFE — the nonce takes precedence.
  //
  // - Style-based XSS is much rarer than script-based XSS (no DOM access from CSS),
  //   so the risk of keeping 'unsafe-inline' for styles is acceptable.
  //
  // - Scripts are FULLY protected by nonce — no 'unsafe-inline' for script-src.
  //
  // Reference: https://www.w3.org/TR/CSP3/#match-element-to-source-list
  const styleSrc = `style-src 'self' 'unsafe-inline' 'nonce-${nonce}' https://fonts.googleapis.com`;

  const connectSrc = isDev
    ? "connect-src 'self' https://*.stripe.com ws: wss:"
    : "connect-src 'self' https://*.stripe.com wss:";

  return [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "img-src 'self' data: blob: https://*.stripe.com https://*.gravatar.com https://*.googleusercontent.com https://images.unsplash.com https://*.openstreetmap.org",
    "font-src 'self' https://fonts.gstatic.com",
    connectSrc,
    "media-src 'self' blob:",
    "frame-src 'self' https://*.stripe.com https://*.openstreetmap.org",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function addSecurityHeaders(
  response: NextResponse,
  nonce: string,
  rateLimitInfo?: { tier: RateLimitTier; remaining: number; resetTime: number; limit: number }
): NextResponse {
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  // SECURITY: Do NOT expose the nonce in a response header.
  // The nonce is only embedded server-side in <script nonce="..."> tags.
  // Exposing it via x-nonce header would let XSS payloads read it and bypass CSP.

  if (rateLimitInfo) {
    response.headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toString());
    response.headers.set('X-RateLimit-Tier', rateLimitInfo.tier);
  }

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

export async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  
  // Hash both inputs first to normalize their lengths to 32 bytes (SHA-256)
  // This completely eliminates length-based timing leaks before comparison.
  const aHash = await crypto.subtle.digest('SHA-256', encoder.encode(a));
  const bHash = await crypto.subtle.digest('SHA-256', encoder.encode(b));
  
  const aArr = new Uint8Array(aHash);
  const bArr = new Uint8Array(bHash);
  
  let result = 0;
  for (let i = 0; i < aArr.length; i++) {
    result |= aArr[i] ^ bArr[i];
  }
  return result === 0;
}

export function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
  
  if (allowedOrigins.length === 0) {
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const dynamicBase = process.env.NEXT_PUBLIC_APP_URL || (host ? `${protocol}://${host}` : '');
    
    if (dynamicBase && origin === dynamicBase) {
      return origin;
    }
    const fallback = process.env.NEXTAUTH_URL || process.env.APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null);
    return fallback;
  }
  
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
  
  return null;
}
