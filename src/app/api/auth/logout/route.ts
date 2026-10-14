import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  hashToken,
  getAuthCookieOptions,
  isCookieSecure,
} from '@/lib/auth/token-utils';
import { requireVerifiedAuth } from '@/app/api/utils/auth';
import { authService } from '@/lib/auth/auth-service';
import { db } from '@/lib/db';

/**
 * POST /api/auth/logout
 * Revokes the refresh token on logout and clears both auth cookies.
 */
export async function POST(request: NextRequest) {
  try {
    // Extract refresh token from cookie using safe cookie API
    const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value || null;
    let targetUserId = null;

    if (refreshToken) {
      // Hash the token and revoke it in the database
      try {
        const tokenHash = await hashToken(refreshToken);
        const storedToken = await db.refreshToken.findUnique({
          where: { tokenHash },
        });

        if (storedToken) {
          targetUserId = storedToken.userId;
        }
      } catch {
        // Orphaned token or DB error — continue with logout anyway
      }
    }

    if (!targetUserId) {
      const authResult = await requireVerifiedAuth(request);
      if ('user' in authResult) {
        targetUserId = authResult.user.userId;
      }
    }

    if (targetUserId) {
      // authService.logout revokes all refresh tokens and logs the audit event
      await authService.logout(targetUserId);
      log.info('All refresh tokens revoked on logout', { userId: targetUserId });
    }
  } catch (error) {
    // Log but don't block logout if revocation fails
    log.error('Error revoking refresh token on logout:', error);
  }

  // Always clear all auth cookies regardless of revocation outcome
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.set(AUTH_COOKIE_NAME, '', {
    ...getAuthCookieOptions(0),
  });

  response.cookies.set(REFRESH_COOKIE_NAME, '', {
    ...getAuthCookieOptions(0),
  });

  // Clear 2FA temp token (if present from an abandoned 2FA flow)
  response.cookies.set('blue_2fa_temp', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: 'lax',
  });

  // Clear CSRF token
  response.cookies.set('csrf_token', '', {
    path: '/',
    maxAge: 0,
    httpOnly: false,
    secure: isCookieSecure(),
    sameSite: 'lax',
  });

  return response;
}

/**
 * GET /api/auth/logout
 * SECURITY: Removed GET handler to prevent CSRF-based logout attacks.
 * Logout must be initiated via POST request only.
 */
