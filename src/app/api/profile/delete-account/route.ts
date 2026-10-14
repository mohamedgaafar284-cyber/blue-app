import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireVerifiedAuth } from '@/app/api/utils/auth';
import { requireStepUp2FA, clearStepUpSession } from '@/lib/auth/step-up-2fa';
import { compare } from 'bcryptjs';
import { RateLimiter } from '@/lib/rate-limiter';
import { log } from '@/lib/logger';
import { isCookieSecure } from '@/lib/auth/token-utils';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteAccountBody {
  password: string;
  confirmText: string;
}

// Unified rate limiter for delete-account (1 attempt per hour per user)
const deleteAccountLimiter = new RateLimiter({
  maxRequests: 1,
  windowMs: 3600000, // 1 hour
  keyPrefix: 'delete-account',
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile/delete-account
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Verify authentication ──
    const authResult = await requireVerifiedAuth(request);
    if ('error' in authResult) return authResult.error;
    const ctx = authResult.user;

    // ── Step 1.5: Step-up 2FA — required for account deletion ──
    // ده defensive layer: لو حد سرق session، مش هيقدر يحذف الحساب بدون الكود
    const stepUpResult = await requireStepUp2FA(request, ctx);
    if ('error' in stepUpResult) return stepUpResult.error;

    // ── Step 2: Parse and validate request body ──
    let body: DeleteAccountBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'طلب غير صالح' } },
        { status: 400 }
      );
    }

    const { password, confirmText } = body;

    // Validate password is provided
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: { code: 'PASSWORD_REQUIRED', message: 'يرجى إدخال كلمة المرور' } },
        { status: 400 }
      );
    }

    // Validate confirmation text
    if (confirmText !== 'DELETE') {
      return NextResponse.json(
        { error: { code: 'CONFIRM_TEXT_MISMATCH', message: 'يرجى كتابة DELETE للتأكيد' } },
        { status: 400 }
      );
    }

    // ── Step 3: Rate limiting (1 attempt per hour per user) ──
    const rateLimitResult = await deleteAccountLimiter.check(ctx.userId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'تم تجاوز عدد المحاولات المسموحة. يرجى المحاولة مرة أخرى بعد ساعة',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': '3600',
          },
        }
      );
    }

    // ── Step 4: Verify password ──
    const userRecord = await db.user.findUnique({
      where: { id: ctx.userId },
    });

    if (!userRecord) {
      return NextResponse.json(
        { error: { code: 'USER_NOT_FOUND', message: 'المستخدم غير موجود' } },
        { status: 404 }
      );
    }

    // Check if already deleted
    if (userRecord.deletedAt) {
      return NextResponse.json(
        { error: { code: 'ALREADY_DELETED', message: 'هذا الحساب محذوف بالفعل' } },
        { status: 400 }
      );
    }

    // Verify password using bcrypt
    if (!userRecord.password || !userRecord.password.startsWith('$2')) {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: 'كلمة المرور غير صحيحة' } },
        { status: 400 }
      );
    }

    const isPasswordValid = await compare(password, userRecord.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: { code: 'INVALID_PASSWORD', message: 'كلمة المرور غير صحيحة' } },
        { status: 400 }
      );
    }

    // ── Step 5: Check if user is the only admin in their organization ──
    if (userRecord.organizationId) {
      const adminCount = await db.user.count({
        where: {
          organizationId: userRecord.organizationId,
          role: 'ADMIN',
          deletedAt: null,
          isActive: true,
        },
      });

      if (userRecord.role === 'ADMIN' && adminCount <= 1) {
        return NextResponse.json(
          {
            error: {
              code: 'SOLE_ADMIN',
              message: 'أنت المسؤول الوحيد في المؤسسة. يرجى نقل صلاحية الإدارة إلى مستخدم آخر قبل حذف حسابك',
            },
          },
          { status: 400 }
        );
      }
    }

    // ── Step 6: Soft delete — set deletedAt and anonymize PII ──
    await db.user.update({
      where: { id: ctx.userId },
      data: {
        deletedAt: new Date(),
        email: `deleted_${ctx.userId}@redacted`,
        name: 'Deleted User',
        phone: '',
        avatar: '',
        isActive: false,
      },
    });

    // ── Step 7: Invalidate all sessions (delete refresh tokens) ──
    await db.refreshToken.deleteMany({
      where: { userId: ctx.userId },
    });

    // ── Step 8: Log the deletion in ActivityLog ──
    await db.activityLog.create({
      data: {
        userId: ctx.userId,
        action: 'delete',
        entityType: 'User',
        entityId: ctx.userId,
        details: 'Account self-deleted by user',
        metadata: JSON.stringify({
          previousEmail: userRecord.email,
          previousName: userRecord.name,
          organizationId: userRecord.organizationId,
        }),
        organizationId: userRecord.organizationId || 'default',
      },
    });

    log.info('Account self-deleted', {
      userId: ctx.userId,
      email: userRecord.email,
      organizationId: userRecord.organizationId,
    });

    // ── Step 8.5: Clear step-up session (one-shot — can't reuse it) ──
    await clearStepUpSession(ctx.userId);

    // ── Step 9: Return success with cookie-clearing headers ──
    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: 'تم حذف حسابك بنجاح',
          messageEn: 'Your account has been successfully deleted',
        },
      },
      { status: 200 }
    );

    // Clear auth cookies
    response.cookies.set('blue_token', '', {
      httpOnly: true,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    response.cookies.set('csrf_token', '', {
      httpOnly: false,
      secure: isCookieSecure(),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    log.error('Delete account error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'حدث خطأ في الخادم' } },
      { status: 500 }
    );
  }
}
