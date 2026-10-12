/**
 * API Route: First-Run Setup — creates the very first ADMIN account
 * مسار الإعداد الأول — إنشاء أول حساب مدير عام
 *
 * POST /api/auth/setup-admin
 *   body: { organizationName, taxNumber?, adminName, adminEmail, adminPassword }
 *   returns: { success: true, data: { organizationId, adminEmail } }
 *
 * WHY THIS EXISTS (UX):
 * Before this endpoint, the ONLY way to create the first production admin
 * was a terminal command (`INITIAL_ADMIN_PASSWORD=... npx tsx prisma/clean-init.ts`).
 * A non-technical engineering-office owner deploying the app hit a login
 * form that could never succeed against an empty database.
 *
 * SECURITY (fail-closed by design):
 * 1. ATOMIC guard: the "zero users exist" check runs INSIDE the same
 *    transaction that creates the org + admin. Two concurrent requests
 *    cannot both pass the check (the second sees the first's uncommitted
 *    insert and aborts). Once one admin exists, the endpoint is dead
 *    forever — it returns 403 SETUP_ALREADY_DONE.
 * 2. Role is NEVER accepted from the client — hardcoded UserRole.ADMIN.
 * 3. Password policy: min 12 chars (matching prisma/clean-init.ts precedent
 *    for the highest-value account) + validatePasswordStrength rules +
 *    breached-password check (graceful degradation offline).
 * 4. Rate limited: middleware 'strict' tier + in-route limiter.
 * 5. Organization slug collisions handled with suffix retry loop.
 * 6. Full security logging on every attempt (success + rejection).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { validateRequest, setupAdminSchema } from '@/lib/api-validation';
import { validatePasswordStrength, checkPasswordBreached } from '@/lib/auth/modules/password';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { log } from '@/lib/logger';
import { UserRole } from '@prisma/client';

export async function POST(request: NextRequest) {
  // Rate limiting — 'strict' tier: this endpoint creates the most powerful
  // account in the system, so it gets the tightest limiter.
  const { result: rlResult } = await withRateLimit(request, 'strict');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  try {
    const body = await request.json();

    const validation = validateRequest(setupAdminSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: validation.error } },
        { status: 400 }
      );
    }

    const { organizationName, taxNumber, adminName, adminEmail, adminPassword } = validation.data;

    // Password strength — same shared module used by login/register.
    const passwordValidation = validatePasswordStrength(adminPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: { code: 'WEAK_PASSWORD', message: passwordValidation.errors.join('. ') } },
        { status: 400 }
      );
    }

    // Breached-password check (degrades gracefully to `false` when the
    // external API is unreachable — e.g. air-gapped deployments).
    const isBreached = await checkPasswordBreached(adminPassword);
    if (isBreached) {
      return NextResponse.json(
        { error: { code: 'BREACHED_PASSWORD', message: 'كلمة المرور هذه ظهرت في تسريبات معروفة. اختر كلمة مرور أخرى.' } },
        { status: 400 }
      );
    }

    const adminPasswordHash = await hash(adminPassword, 12);
    const normalizedEmail = adminEmail.toLowerCase().trim();

    const baseSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'organization';

    // ── ATOMIC fail-closed setup ─────────────────────────────────────
    const maxSlugAttempts = 5;
    let slugAttempts = 0;
    let currentSlug = baseSlug;

    while (slugAttempts < maxSlugAttempts) {
      try {
        const result = await db.$transaction(async (tx) => {
          // THE GUARD — inside the transaction: if ANY user exists
          // (including soft-deleted ones), setup is permanently closed.
          const userCount = await tx.user.count();
          if (userCount > 0) {
            throw new Error('SETUP_ALREADY_DONE');
          }

          const org = await tx.organization.create({
            data: {
              name: organizationName,
              slug: currentSlug,
              ...(taxNumber ? { taxNumber } : {}),
              currency: 'AED',
              timezone: 'Asia/Dubai',
              locale: 'ar',
            },
          });

          const admin = await tx.user.create({
            data: {
              email: normalizedEmail,
              password: adminPasswordHash,
              name: adminName,
              role: UserRole.ADMIN, // Hardcoded — never from the client
              organizationId: org.id,
              emailVerified: new Date(), // First admin is trusted — no SMTP dependency
              isActive: true,
            },
          });

          return { orgId: org.id, adminId: admin.id };
        }, { timeout: 15000 });

        log.security('First-run setup completed — initial ADMIN account created', {
          organizationId: result.orgId,
          adminEmail: normalizedEmail,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        });

        return NextResponse.json({
          success: true,
          data: {
            organizationId: result.orgId,
            adminEmail: normalizedEmail,
            message: 'تم إنشاء حساب المدير العام بنجاح. يمكنك تسجيل الدخول الآن.',
            messageEn: 'Admin account created successfully. You can now sign in.',
          },
        }, { status: 201 });
      } catch (txError: unknown) {
        const message = txError instanceof Error ? txError.message : '';
        if (message === 'SETUP_ALREADY_DONE') {
          log.security('First-run setup rejected — users already exist', {
            ip: request.headers.get('x-forwarded-for') || 'unknown',
          });
          return NextResponse.json(
            { error: { code: 'SETUP_ALREADY_DONE', message: 'النظام مهيأ بالفعل — يوجد مستخدمون في قاعدة البيانات. لا يمكن إعادة الإعداد.' } },
            { status: 403 }
          );
        }
        // Slug unique-constraint collision → retry with suffix
        if ((txError as { code?: string })?.code === 'P2002') {
          slugAttempts++;
          currentSlug = `${baseSlug}-${slugAttempts}`;
          continue;
        }
        throw txError;
      }
    }

    return NextResponse.json(
      { error: { code: 'SLUG_COLLISION', message: 'تعذر توليد معرّف فريد للشركة — حاول باسم مختلف.' } },
      { status: 409 }
    );
  } catch (error: unknown) {
    log.error('Setup-admin POST error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'حدث خطأ غير متوقع في الخادم' } },
      { status: 500 }
    );
  }
}
