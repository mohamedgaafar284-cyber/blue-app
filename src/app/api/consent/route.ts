import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedAuth } from '@/app/api/utils/auth';
import { successResponse } from '@/app/api/utils/response';
import { log } from '@/lib/logger';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { isCookieSecure } from '@/lib/auth/token-utils';
import { z } from 'zod';

// Zod schema for consent request
const consentSchema = z.object({
  consent: z.boolean(),
}).strict(); // Reject unknown fields

export async function POST(request: NextRequest) {
  try {
    const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'public');
    const blocked = rateLimitResponse(rlResult);
    if (blocked) return blocked;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'جسم الطلب غير صالح' },
        { status: 400 }
      );
    }

    const validation = consentSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'بيانات غير صالحة' },
        { status: 400 }
      );
    }

    const consentGiven = validation.data.consent;

    // Set cookie
    const response = successResponse({ consent: consentGiven });
    response.cookies.set('gdpr_consent', consentGiven ? 'true' : 'false', {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
    });

    // Optionally save to database if user is logged in (JWT-verified)
    try {
      const authResult = await requireVerifiedAuth(request);
      if (!('error' in authResult) && authResult.user?.userId) {
        log.info(`User ${authResult.user.userId} set GDPR consent to ${consentGiven}`);
      }
    } catch {
      // Not authenticated — consent cookie still set, just no user logging
    }

    return response;
  } catch (error) {
    log.error('Error saving GDPR consent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
