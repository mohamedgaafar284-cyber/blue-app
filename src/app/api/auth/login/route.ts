import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { SignJWT } from 'jose';
import { validateRequest, loginSchema } from '@/lib/api-validation';
import { log } from '@/lib/logger';
import { DEMO_CREDENTIALS, isDemoMode, validateDemoMode } from '@/lib/demo-credentials';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { getClientIP } from '@/lib/rate-limiter';
import { getJwtSecretBytes } from '@/lib/auth/jwt-secret';
import {
  AUTH_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  normalizeRoleForClient,
  generateAuthToken,
  generateDbRefreshToken,
  getAuthCookieOptions,
  isCookieSecure,
} from '@/lib/auth/token-utils';

/** Number of failed login attempts before account lockout */
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** Duration of account lockout in minutes */
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate a user with email and password. Sets HTTP-only cookies for access and refresh tokens. Supports account lockout after 5 failed attempts (15 min lockout). Supports 2FA flow.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: admin@blueprint.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: "SecureP@ss1"
 *     responses:
 *       200:
 *         description: Login successful. Returns user data and sets authentication cookies.
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: Standard login response
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: User ID
 *                     email:
 *                       type: string
 *                       format: email
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [admin, manager, engineer, viewer]
 *                     department:
 *                       type: string
 *                     position:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                       nullable: true
 *                     isActive:
 *                       type: boolean
 *                     twoFactorEnabled:
 *                       type: boolean
 *                 - type: object
 *                   description: 2FA required response
 *                   properties:
 *                     requires2FA:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *         headers:
 *           Set-Cookie:
 *             description: "Sets blue_token (access token, 15 min) and blue_refresh_token (refresh token, 7 days)"
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request body or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials or inactive account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       423:
 *         description: Account locked due to too many failed login attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(request: Request) {
  try {
    validateDemoMode();
    // Rate limiting check — use Redis-based rate limiter
    const { result: rateLimitResult } = await withRateLimit(request, 'auth');
    const rlBlocked = rateLimitResponse(rateLimitResult);
    if (rlBlocked) return rlBlocked;

    const body = await request.json();
    const validation = validateRequest(loginSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    const { email, password, organizationSlug, organizationId } = validation.data;

    // Extract client IP for security logging
    const clientIp = getClientIP(request.headers);

    const users = await db.user.findMany({
      where: { 
        email: email.toLowerCase() 
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        isActive: true,
        department: true,
        position: true,
        avatar: true,
        twoFactorEnabled: true,
        organizationId: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        passwordChangedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      },
    });

    if (users.length === 0) {
      log.security('Failed login attempt — user not found', { email, clientIp });
      // Timing attack mitigation: always perform bcrypt compare even when user not found
      // This ensures similar response times whether the email exists or not
      await bcrypt.compare(password, '$2a$10$CwTycUXWue0Thq9StjUM0uXJQR3K16B9K121gB3e5G0B.a0Q1e5Q.');
      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة" },
        { status: 401 }
      );
    }

    let user = users[0];

    if (users.length > 1) {
      if (!organizationSlug && !organizationId) {
        return NextResponse.json({
          requiresOrgChoice: true,
          organizations: users.map(u => u.organization).filter(Boolean),
          message: "هناك أكثر من مؤسسة مرتبطة بهذا البريد الإلكتروني. يرجى تحديد المؤسسة."
        });
      }

      const matched = users.find(u => 
        u.organizationId === organizationId || 
        (u.organization && u.organization.slug === organizationSlug)
      );

      if (!matched) {
        log.security('Failed login attempt — invalid organization choice', { email, organizationSlug, organizationId, clientIp });
        return NextResponse.json(
          { error: "المؤسسة المحددة غير صحيحة" },
          { status: 400 }
        );
      }

      user = matched;
    }

    // Account lockout check
    if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        log.security('Login attempt on locked account', { email, clientIp, lockedUntil: user.lockedUntil });
        return NextResponse.json(
          { error: "الحساب مقفل بسبب محاولات دخول فاشلة متعددة. يرجى المحاولة لاحقاً" },
          { status: 423 }
        );
      }
      // Lockout period has expired — reset counter
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (!user.isActive) {
      // SECURITY: Return same error message as invalid credentials to prevent user enumeration
      log.security('Login attempt on inactive account', { email, clientIp });
      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة" },
        { status: 401 }
      );
    }

    // Password verification
    let isValid = false;

    // DEMO MODE CHECK: In demo mode, demo users should have bcrypt hashes in the DB
    // (synced by /api/init). We do NOT do plaintext comparison — authentication
    // ALWAYS goes through bcrypt. Demo mode only controls feature availability.
    if (isDemoMode()) {
      const demoCred = DEMO_CREDENTIALS.find(c => c.email === email);
      if (demoCred) {
        // Demo user exists — let normal bcrypt check handle authentication
        // The /api/init endpoint ensures demo users have correct bcrypt hashes in DB
        log.warn('Demo mode active — not for production', { email });
        // Don't do plaintext comparison — let normal bcrypt check handle it
      }
    }

    // Standard bcrypt check: password must be a bcrypt hash starting with "$2"
    if (user.password && user.password.startsWith("$2")) {
      isValid = await bcrypt.compare(password, user.password);
    }

    if (!isValid) {
      log.security('Failed login attempt', { email, clientIp });

      // Increment failed login attempts atomically in the database (CWE-362 fix)
      const lockUpdate = await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: {
            increment: 1,
          },
        },
        select: {
          failedLoginAttempts: true,
        },
      });

      const newAttemptCount = lockUpdate.failedLoginAttempts;
      if (newAttemptCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
        log.security('Account locked due to too many failed login attempts', {
          email,
          clientIp,
          attempts: newAttemptCount,
          lockedUntil,
        });
        await db.user.update({
          where: { id: user.id },
          data: { lockedUntil },
        });
      }

      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور" },
        { status: 401 }
      );
    }

    // Successful login — reset failed login attempts and update lastLogin in a single transaction
    // This prevents race conditions where concurrent login requests could cause inconsistent state
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastLogin: new Date() },
      }),
    ]);

    // Normalize role for client-side
    const clientRole = normalizeRoleForClient(user.role);

    // Check if 2FA is enabled for this user
    if (user.twoFactorEnabled) {
      // SECURITY: Generate a signed JWT as the 2FA temp token, embedding the userId.
      // The verify endpoint extracts userId from this token (not from the request body),
      // preventing an attacker from supplying an arbitrary userId to verify 2FA for
      // a different user.
      const tempToken = await new SignJWT({ userId: user.id, type: '2fa-pending' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('blueprint-saas')
        .setAudience('blueprint-2fa')
        .setExpirationTime('5m')
        .setIssuedAt()
        .sign(getJwtSecretBytes());

      const response = NextResponse.json({
        requires2FA: true,
        // SECURITY: userId is NOT exposed in the response body — it's already embedded
        // in the signed blue_2fa_temp JWT cookie. Exposing it here aids user ID enumeration.
        message: "يتطلب التحقق الثنائي. يرجى إدخال رمز التحقق من تطبيق المصادقة الخاص بك."
      }, { status: 200 });

      response.cookies.set('blue_2fa_temp', tempToken, {
        path: '/',
        maxAge: 5 * 60,
        httpOnly: true,
        secure: isCookieSecure(),
        sameSite: 'lax',
      });

      return response;
    }

    // Generate JWT access token using centralized utility
    // (lastLogin already updated in the transaction above)
    const token = await generateAuthToken({
      userId: user.id,
      email: user.email,
      name: user.name ?? "",
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      organizationId: user.organizationId,
      passwordChangedAt: user.passwordChangedAt ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000) : 0,
    });

    // Generate refresh token using centralized utility
    const rawRefreshToken = await generateDbRefreshToken(user.id);

    // Build the response — role is normalized to lowercase for client
    const response = NextResponse.json({
      token, // Expose JWT token for native mobile apps and Bearer API clients
      id: user.id,
      email: user.email,
      name: user.name ?? "",
      role: clientRole,
      department: user.department,
      position: user.position,
      avatar: user.avatar,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled || false,
    });

    // Set access token cookie (short-lived: 15 minutes)
    response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions(ACCESS_TOKEN_MAX_AGE));

    // Set refresh token cookie (long-lived: 7 days)
    response.cookies.set(REFRESH_COOKIE_NAME, rawRefreshToken, getAuthCookieOptions(REFRESH_TOKEN_MAX_AGE));

    log.info('User logged in', { userId: user.id, email: user.email, role: clientRole });

    return response;
  } catch (error) {
    log.error("Login error:", error);
    return NextResponse.json(
      { error: "حدث خطأ في الخادم. يرجى المحاولة لاحقاً" },
        { status: 500 }
    );
  }
}
