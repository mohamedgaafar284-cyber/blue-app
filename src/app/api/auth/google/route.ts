import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { log } from '@/lib/logger';
import { isCookieSecure } from '@/lib/auth/token-utils';

/**
 * GET /api/auth/google
 *
 * Initiates Google OAuth 2.0 flow.
 * Generates a CSRF state token, stores it in a short-lived cookie,
 * and redirects the user to Google's consent screen.
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      log.warn('Google OAuth attempted without configured credentials');
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent('تسجيل الدخول عبر جوجل غير مفعل')}`
      );
    }

    // Generate CSRF state token
    const state = randomBytes(32).toString('hex');

    // Generate PKCE code verifier and challenge (same pattern as Microsoft OAuth)
    // SECURITY: PKCE prevents authorization code interception attacks
    const code_verifier = randomBytes(32).toString('base64url');
    const code_challenge_buffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(code_verifier)
    );
    const code_challenge = Buffer.from(code_challenge_buffer).toString('base64url');

    // Build redirect URI — must match what's registered in Google Cloud Console
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Construct Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('code_challenge', code_challenge);
    googleAuthUrl.searchParams.set('code_challenge_method', 'S256');

    // Redirect to Google's consent screen
    const response = NextResponse.redirect(googleAuthUrl.toString());

    // Store state in a short-lived cookie for CSRF verification in the callback
    response.cookies.set('google_oauth_state', state, {
      path: '/',
      maxAge: 10 * 60, // 10 minutes
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
    });

    // Store code_verifier for PKCE validation in the callback
    response.cookies.set('google_oauth_verifier', code_verifier, {
      path: '/',
      maxAge: 10 * 60, // 10 minutes
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    log.error('Error initiating Google OAuth:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent('حدث خطأ أثناء تسجيل الدخول عبر جوجل')}`
    );
  }
}
