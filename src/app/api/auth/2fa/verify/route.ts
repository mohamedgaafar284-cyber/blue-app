/**
 * 2FA Verification API Route
 * مسار التحقق من رمز المصادقة الثنائية
 * 
 * POST /api/auth/2fa/verify - Verify 2FA code during login
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { authService } from '@/lib/auth/auth-service';
import { errorResponse } from '../../../utils/response'
import { log } from '@/lib/logger';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { getJwtSecretBytes } from '@/lib/auth/jwt-secret';
import { validateRequest, twoFactorVerifySchema } from '@/lib/api-validation';
import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  generateAuthToken,
  generateDbRefreshToken,
  getAuthCookieOptions,
  isCookieSecure,
  normalizeRoleForClient,
} from '@/lib/auth/token-utils';
import { getRedis } from '@/lib/cache/redis';

// SECURITY: Redis-based rate limiter for failed 2FA attempts (per-user lockout)
// This is SEPARATE from the Redis-based auth rate limiter above.
// The auth limiter limits total requests per IP; this one tracks consecutive
// failed verification attempts per user to prevent brute-force of 2FA codes.
// Previously used an in-memory Map which doesn't work in multi-instance deployments.

const MAX_2FA_ATTEMPTS = 5;
const TWO_FA_WINDOW_SECONDS = 900; // 15 minutes

async function check2FARateLimit(userId: string): Promise<{ allowed: boolean; attemptsLeft: number }> {
  const redis = await getRedis();
  if (!redis) {
    // SECURITY: Fail-closed when Redis is unavailable.
    // 2FA brute-force protection should NOT be disabled when Redis is down.
    // A 6-digit TOTP has only 1M possibilities; without rate limiting,
    // an attacker could try thousands of codes.
    return { allowed: false, attemptsLeft: 0 };
  }

  try {
    const key = `2fa_attempts:${userId}`;
    const attempts = parseInt(await redis.get(key) || '0', 10);

    if (attempts >= MAX_2FA_ATTEMPTS) {
      return { allowed: false, attemptsLeft: 0 };
    }

    return { allowed: true, attemptsLeft: MAX_2FA_ATTEMPTS - attempts };
  } catch {
    // Fail-closed on Redis error
    return { allowed: false, attemptsLeft: 0 };
  }
}

async function record2FAAttempt(userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    // SECURITY FIX: Use atomic INCR to prevent race condition.
    // Previously, GET + SET/INCR was non-atomic — two concurrent requests
    // could both read attempts === 0 and both call SETEX, losing one count.
    const key = `2fa_attempts:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      // First attempt — set the expiry (15 min lockout window)
      await redis.expire(key, TWO_FA_WINDOW_SECONDS);
    }
  } catch {
    // Graceful degradation — don't block on Redis error
  }
}

async function reset2FAAttempts(userId: string): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;

  try {
    await redis.del(`2fa_attempts:${userId}`);
  } catch {
    // Graceful degradation
  }
}

/**
 * POST - Verify 2FA code
 * Body: { code: string }
 *
 * SECURITY: The userId is derived from the signed `blue_2fa_temp` JWT cookie,
 * NOT from the request body. This prevents an attacker from supplying an
 * arbitrary userId to verify 2FA on behalf of a different user.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting — auth limiter (10 req/min per IP)
    const { result: rlResult } = await withRateLimit(request, 'auth');
    const rlBlocked = rateLimitResponse(rlResult);
    if (rlBlocked) return rlBlocked;

    const body = await request.json();

    // Zod validation for 2FA verify code
    const validation = validateRequest(twoFactorVerifySchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }
    const { code } = validation.data;

    // SECURITY: Validate 2FA temp token from httpOnly cookie and extract userId.
    // The temp token is a signed JWT created during login that embeds the userId.
    // We MUST derive the userId from this token — NEVER from the request body —
    // to prevent an attacker from verifying 2FA for a different user.
    const tempToken = request.cookies.get('blue_2fa_temp')?.value;
    if (!tempToken) {
      return errorResponse(
        'انتهت صلاحية جلسة التحقق الثنائي. يرجى تسجيل الدخول مرة أخرى',
        'TEMP_TOKEN_EXPIRED',
        401
      );
    }

    // Verify the signed JWT to extract the userId
    let userId: string;
    try {
      const { payload } = await jwtVerify(tempToken, getJwtSecretBytes(), {
        issuer: 'blueprint-saas',
        audience: 'blueprint-2fa',
      });
      if (payload.type !== '2fa-pending' || typeof payload.userId !== 'string') {
        return errorResponse(
          'رمز التحقق المؤقت غير صالح. يرجى تسجيل الدخول مرة أخرى',
          'INVALID_TEMP_TOKEN',
          401
        );
      }
      userId = payload.userId;
    } catch {
      return errorResponse(
        'انتهت صلاحية جلسة التحقق الثنائي. يرجى تسجيل الدخول مرة أخرى',
        'TEMP_TOKEN_EXPIRED',
        401
      );
    }

    // SECURITY: Check per-user 2FA failed attempt lockout (Redis-based)
    const rateLimitCheck = await check2FARateLimit(userId);
    if (!rateLimitCheck.allowed) {
      return errorResponse(
        'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد 15 دقيقة',
        'RATE_LIMIT_EXCEEDED',
        429
      );
    }

    // Code format already validated by Zod schema (6 digits TOTP or 8 digits backup)

    const isValid = await authService.verifyTwoFactorCode(userId, code);

    if (!isValid) {
      await record2FAAttempt(userId);
      return errorResponse(
        'رمز التحقق غير صحيح أو منتهي الصلاحية',
        'INVALID_CODE',
        401
      );
    }

    // Generate tokens after successful 2FA verification
    await reset2FAAttempts(userId);
    const user = await authService.getUserById(userId);
    if (!user) {
      return errorResponse('المستخدم غير موجود', 'USER_NOT_FOUND', 404);
    }

    // Generate auth cookie JWT using centralized utility (same as login flow)
    const cookieToken = await generateAuthToken({
      userId: user.id,
      email: user.email,
      name: user.name ?? "",
      role: user.role as string,
      twoFactorEnabled: true,
      organizationId: user.organizationId || undefined,
      passwordChangedAt: (user as { passwordChangedAt?: Date | null }).passwordChangedAt
        ? Math.floor(new Date((user as { passwordChangedAt?: Date | null }).passwordChangedAt!).getTime() / 1000)
        : 0,
    });

    // Generate refresh token using centralized utility (same as login flow)
    const refreshToken = await generateDbRefreshToken(user.id);

    const response = NextResponse.json({
      success: true,
      data: {
        message: 'تم التحقق بنجاح',
        token: cookieToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.name ?? "",
          fullName: user.name ?? "",
          role: normalizeRoleForClient(user.role as string),
          avatar: user.avatar,
          organizationId: user.organizationId,
        },
      },
    });

    // Set access token cookie (15 min)
    response.cookies.set(AUTH_COOKIE_NAME, cookieToken, getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE));

    // Set refresh token cookie (7 days) — consistent with login flow
    response.cookies.set(REFRESH_COOKIE_NAME, refreshToken, getAuthCookieOptions(REFRESH_TOKEN_MAX_AGE));

    // Clear the 2FA temp token cookie (one-time use)
    response.cookies.set('blue_2fa_temp', '', {
      path: '/',
      maxAge: 0, // Delete the cookie
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    log.error('2FA verify error:', error);
    return errorResponse('حدث خطأ غير متوقع', 'INTERNAL_ERROR', 500);
  }
}
