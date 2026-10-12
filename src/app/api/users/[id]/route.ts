import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { validateRequest, userUpdateSchema, validateIdParam } from '@/lib/api-validation';
import { orgFilter, requireVerifiedPermission } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { getRoleLevel } from '@/lib/auth/modules/authorization';
import { handleApiErrorWithLogging as handleApiError } from '@/lib/api-error';
import { requireStepUp2FA } from '@/lib/auth/step-up-2fa';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { hash } from 'bcryptjs';
import { generateTempPassword } from '@/lib/auth/temp-password';
import { log } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rbac = await requireVerifiedPermission(request, Permission.USER_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;
    const user = await db.user.findFirst({
      where: { id, ...orgFilter(ctx) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        department: true,
        position: true,
        avatar: true,
        isActive: true,
        emailVerified: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        lastLogin: true,
        twoFactorEnabled: true,
        employee: true,
        projects: {
          include: { project: { select: { id: true, name: true, number: true } } },
        },
        _count: {
          select: {
            tasks: true,
            activities: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: unknown) {
    return handleApiError(error, 'User GET');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC: requires USER_UPDATE permission (JWT-verified for user management)
    const rbac = await requireVerifiedPermission(request, Permission.USER_UPDATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    // ── Step-up 2FA: required for user updates (admin privilege operation) ──
    const stepUpResult = await requireStepUp2FA(request, ctx);
    if ('error' in stepUpResult) return stepUpResult.error;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;

    // Verify user belongs to same org
    const existingUser = await db.user.findFirst({
      where: { id, ...orgFilter(ctx) },
    });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    const validation = validateRequest(userUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }

    const validatedData = validation.data;

    const updateData: Record<string, unknown> = {
      ...(validatedData.name !== undefined && { name: validatedData.name }),
      ...(validatedData.email !== undefined && { email: validatedData.email }),
      ...(validatedData.phone !== undefined && { phone: validatedData.phone }),
      ...(validatedData.department !== undefined && { department: validatedData.department }),
      ...(validatedData.position !== undefined && { position: validatedData.position }),
      ...(validatedData.avatar !== undefined && { avatar: validatedData.avatar }),
      // NOTE: role is excluded from userUpdateSchema for security (privilege escalation prevention).
      // Role changes must go through a dedicated admin-only endpoint.
      ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
    };

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        department: true,
        position: true,
        avatar: true,
        isActive: true,
        emailVerified: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        twoFactorEnabled: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    return handleApiError(error, 'User PUT');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'strict');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    // RBAC: requires USER_DELETE permission (JWT-verified for user management)
    const rbac = await requireVerifiedPermission(request, Permission.USER_DELETE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    // Cannot delete yourself
    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;
    if (ctx.userId === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Verify user belongs to same org
    const existingUser = await db.user.findFirst({
      where: { id, ...orgFilter(ctx) },
    });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete instead of hard delete
    await db.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error, 'User DELETE');
  }
}

/**
 * POST — Admin actions on a user
 *
 * action: 'reset-password'
 *   Generates a readable temporary password, hashes it into the user's
 *   record, clears any lockout state, and returns the plaintext ONCE to the
 *   requesting admin. UX rationale: production deployments have no guaranteed
 *   SMTP, so "forgot password" email flow cannot be relied upon — without
 *   this action an employee who loses their password was locked out forever
 *   (no admin-side reset existed).
 *
 * SECURITY:
 * - Requires USER_UPDATE permission (same as profile edits)
 * - Step-up 2FA enforced (same policy as PUT)
 * - Cannot reset your OWN password here (use /api/profile/password which
 *   verifies the current password — prevents session hijackers from silently
 *   taking over the account they are already inside)
 * - Cannot reset a user at a HIGHER role level (privilege escalation guard)
 * - Strict rate limiting
 * - Temp password is returned once, never stored in plaintext
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'strict');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.USER_UPDATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    // Step-up 2FA: same admin-privilege policy as user PUT
    const stepUpResult = await requireStepUp2FA(request, ctx);
    if ('error' in stepUpResult) return stepUpResult.error;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;

    let body: { action?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body?.action !== 'reset-password') {
      return NextResponse.json(
        { error: 'Unsupported action. Supported: reset-password' },
        { status: 400 }
      );
    }

    // Cannot reset your own password through this endpoint
    if (ctx.userId === id) {
      return NextResponse.json(
        { error: 'Cannot reset your own password here. Use Profile → Change Password (it verifies your current password).' },
        { status: 400 }
      );
    }

    const targetUser = await db.user.findFirst({
      where: { id, ...orgFilter(ctx) },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Privilege-escalation guard: cannot reset a user above your own level
    const actorLevel = getRoleLevel(ctx.role);
    const targetLevel = getRoleLevel(targetUser.role);
    if (targetLevel > actorLevel) {
      return NextResponse.json(
        { error: 'Cannot reset the password of a user with a higher role than yours.' },
        { status: 403 }
      );
    }

    const temporaryPassword = generateTempPassword();
    const hashedPassword = await hash(temporaryPassword, 12);

    await db.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        // Unlock the account: a locked-out employee is exactly the scenario
        // this action exists for
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      },
    });

    log.security('Admin reset a user password — temp password issued', {
      actorId: ctx.userId,
      targetUserId: id,
      targetEmail: targetUser.email,
    });

    return NextResponse.json({
      success: true,
      temporaryPassword,
      passwordNotice: 'تم توليد كلمة مرور مؤقتة — انسخها الآن، لن تظهر مرة أخرى. سلّمها للموظف واطلب منه تغييرها من الملف الشخصي.',
      passwordNoticeEn: 'A temporary password was generated — copy it now, it will NOT be shown again. Hand it to the employee and ask them to change it from their profile.',
    });
  } catch (error: unknown) {
    return handleApiError(error, 'User POST (reset-password)');
  }
}
