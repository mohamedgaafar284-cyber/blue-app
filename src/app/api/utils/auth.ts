import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { getJwtSecretBytes as _getJwtSecretBytes } from '@/lib/auth/jwt-secret';
import { unauthorizedResponse, forbiddenResponse } from './response';
import { log } from '@/lib/logger';
import { db } from '@/lib/db';

// Re-export response helpers for convenience in route handlers
export { unauthorizedResponse, forbiddenResponse };

// ============================================
// Security Configuration
// ============================================

// JWT secret is now managed centrally in @/lib/auth/jwt-secret

// Export JWT_SECRET as a function that returns Uint8Array
// This allows lazy evaluation and prevents build-time errors
export function getJWTSecret(): Uint8Array {
  return _getJwtSecretBytes();
}

// JWT verification constants — must match proxy.ts and auth-service.ts
const JWT_ISSUER = 'blueprint-saas';
const JWT_AUDIENCE = 'blueprint-users';

// ============================================
// Auth Context — Defense-in-Depth
// ============================================

/**
 * Auth context extracted from middleware-set headers.
 * The middleware verifies the JWT and forwards user identity via headers.
 * This function provides a second layer of verification in route handlers.
 */
export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  name: string;
  organizationId: string | null;
}

/**
 * INTERNAL: Extract auth context from middleware-set headers.
 * 
 * ⚠️ DO NOT use this function directly in API route handlers — it only reads
 * headers and does NOT verify the JWT, making it vulnerable to header forgery.
 * Use requireVerifiedAuth() or requireVerifiedPermission() instead.
 *
 * Exported ONLY for testing (unit tests need to verify header parsing logic
 * without a full JWT). Production code must use requireVerifiedAuth().
 */
export function extractAuthContext(request: NextRequest): AuthContext | null {
  const userId = request.headers.get('x-user-id');
  const email = request.headers.get('x-user-email');
  const role = request.headers.get('x-user-role');
  const name = request.headers.get('x-user-name');
  const organizationId = request.headers.get('x-organization-id');

  if (!userId || !email || !role) {
    return null;
  }

  return {
    userId,
    email,
    role,
    name: name ? decodeURIComponent(name) : '',
    organizationId: organizationId || null,
  };
}

/**
 * Build a Prisma where clause that filters by organizationId.
 * For single-tenant setups (no organizationId), returns empty filter.
 * For multi-tenant setups, adds organizationId filter.
 * 
 * USAGE:
 *   const where = { ...userFilters, ...orgFilter(ctx) };
 *   const data = await db.project.findMany({ where });
 */
export function orgFilter(ctx: AuthContext): Record<string, unknown> {
  // SECURITY FIX: Multi-tenancy is now the default (was env-gated, which left SaaS
  // deployments silently single-tenant). The old behavior allowed any authenticated
  // user to read data across all organizations when MULTI_TENANT env var was unset.
  // Reference: critical security audit finding P0-1.
  //
  // Behavior:
  //   - If the user has an organizationId → filter by it (normal case).
  //   - If the user has NO organizationId → return a sentinel that matches no records.
  //     This prevents unscoped users from seeing any org-scoped data.
  //   - Explicit single-tenant mode (MULTI_TENANT='false') is still supported for
  //     self-hosted single-org deployments, but must be opted INTO deliberately.
  const isExplicitSingleTenant = process.env.MULTI_TENANT === 'false';

  if (ctx.organizationId) {
    return { organizationId: ctx.organizationId };
  }

  if (isExplicitSingleTenant) {
    // Single-tenant mode: explicitly opted in. No org filtering applied.
    return {};
  }

  // Default (multi-tenant): users without an organizationId must NOT see cross-tenant data.
  // Using a sentinel value that matches no records prevents data leakage.
  return { organizationId: '__DENIED__' };
}

/**
 * Get the organizationId for creating new records.
 * In multi-tenant mode, REQUIRES organizationId — returns __DENIED__ sentinel
 * if missing, which will cause a DB constraint error, preventing unscoped records.
 * In single-tenant mode, returns empty (no org scoping).
 *
 * USAGE:
 *   const data = await db.project.create({
 *     data: { ...body, ...orgCreate(ctx), createdById: ctx.userId }
 *   });
 */
export function orgCreate(ctx: AuthContext): { organizationId: string } {
  // SECURITY FIX: mirrors orgFilter() — multi-tenant is now the default.
  const isExplicitSingleTenant = process.env.MULTI_TENANT === 'false';

  if (ctx.organizationId) {
    return { organizationId: ctx.organizationId };
  }

  if (isExplicitSingleTenant) {
    // Single-tenant mode: explicitly opted in. Use 'default' org id.
    return { organizationId: 'default' };
  }

  // Default (multi-tenant): records MUST have an organizationId.
  // Without this, created records are invisible to orgFilter() and leak across tenants.
  // The __DENIED__ sentinel will cause a DB constraint error, preventing unscoped records.
  return { organizationId: '__DENIED__' };
}

/**
 * Build a Prisma where clause for nested org filtering (e.g., through a parent relation).
 * Used when the model itself doesn't have organizationId but its parent does.
 *
 * USAGE:
 *   const where = { ...filters, ...orgFilterNested(ctx, 'project') };
 *   const data = await db.taskComment.findMany({ where });
 */
export function orgFilterNested(ctx: AuthContext, parentRelation: string): Record<string, unknown> {
  // SECURITY FIX: mirrors orgFilter() — multi-tenant is now the default.
  const isExplicitSingleTenant = process.env.MULTI_TENANT === 'false';

  if (ctx.organizationId) {
    return { [parentRelation]: { organizationId: ctx.organizationId } };
  }

  if (isExplicitSingleTenant) {
    return {};
  }

  // Default (multi-tenant): deny cross-tenant access.
  return { [parentRelation]: { organizationId: '__DENIED__' } };
}

/**
 * Verify that a fetched resource belongs to the user's organization.
 * Returns a 403 response if the resource crosses org boundaries.
 * Use this for single-record lookups where orgFilter wasn't applied in the query.
 *
 * USAGE:
 *   const record = await db.invoice.findUnique({ where: { id } });
 *   const orgError = orgCheck(ctx, record);
 *   if (orgError) return orgError;
 */
export function orgCheck(ctx: AuthContext, record: { organizationId?: string | null } | null): NextResponse | null {
  // SECURITY FIX: Multi-tenant is now the default. The old implementation returned early
  // (no check) whenever MULTI_TENANT !== 'true', leaving SaaS deployments unprotected.
  // It also allowed access to legacy records with organizationId=null from ANY user,
  // creating a backdoor for cross-tenant data leakage.
  if (!record) return null; // Record not found — let the caller handle 404

  const isExplicitSingleTenant = process.env.MULTI_TENANT === 'false';
  if (isExplicitSingleTenant) return null; // Single-tenant: explicitly opted in, no org check

  // Default (multi-tenant): enforce strict org isolation.

  // If user has no org, they cannot access any org-scoped record.
  if (!ctx.organizationId) {
    if (!record.organizationId) {
      // SECURITY FIX: legacy records (organizationId=null) are no longer accessible
      // to unscoped users. This was a backdoor. They must be migrated to an org first.
      return forbiddenResponse('Resource is not associated with any organization (legacy data). Please contact an administrator.');
    }
    return forbiddenResponse('No organization assigned');
  }

  // User has an org — record must match it.
  // SECURITY FIX: records with organizationId=null are NOT accessible to scoped users either.
  // This forces legacy data to be migrated before it becomes accessible.
  if (!record.organizationId) {
    return forbiddenResponse('Resource is not associated with any organization (legacy data). Please contact an administrator.');
  }

  if (record.organizationId !== ctx.organizationId) {
    return forbiddenResponse('Resource does not belong to your organization');
  }
  return null; // OK — same org
}

/**
 * Validate CSRF token using Double Submit Cookie pattern.
 * Reads X-CSRF-Token header and compares with csrf_token cookie.
 * Returns true if both exist and match, false otherwise.
 */
export function validateCsrf(request: NextRequest): boolean {
  const csrfHeader = request.headers.get('x-csrf-token');
  const csrfCookie = request.cookies.get('csrf_token')?.value;
  if (!csrfHeader || !csrfCookie) return false;
  return csrfHeader === csrfCookie;
}

/**
 * Extract JWT token from request headers
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Skip the 'httpOnly' placeholder — real JWT is in the cookie
    if (token === 'httpOnly') {
      const tokenCookie = request.cookies.get('blue_token');
      return tokenCookie?.value || null;
    }
    return token;
  }
  // Fall back to httpOnly cookie
  const tokenCookie = request.cookies.get('blue_token');
  return tokenCookie?.value || null;
}

/**
 * Generate a JWT token for a user
 * Uses 15m expiry — consistent with auth-service.ts and token-utils.ts
 */
export async function generateToken(userId: string): Promise<string> {
  return new jose.SignJWT({ userId, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('blueprint-saas')
    .setAudience('blueprint-users')
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(getJWTSecret());
}

/**
 * Check if user has admin role
 * Uses toUpperCase() to handle both 'ADMIN' and 'admin' (proxy normalizes to lowercase)
 */
export function isAdmin(role: string): boolean {
  return role?.toUpperCase() === 'ADMIN';
}

/**
 * Check if user has HR role
 * Uses toUpperCase() to handle both 'HR' and 'hr' (proxy normalizes to lowercase)
 */
export function isHR(role: string): boolean {
  return role?.toUpperCase() === 'HR';
}

/**
 * Check if user has accountant role
 * Uses toUpperCase() to handle both 'ACCOUNTANT' and 'accountant' (proxy normalizes to lowercase)
 */
export function isAccountant(role: string): boolean {
  return role?.toUpperCase() === 'ACCOUNTANT';
}

/**
 * Check if user can approve leaves
 */
export function canApproveLeave(role: string): boolean {
  const r = role?.toUpperCase();
  return r === 'ADMIN' || r === 'HR' || r === 'MANAGER';
}

/**
 * Check if user can approve expenses
 */
export function canApproveExpense(role: string): boolean {
  const r = role?.toUpperCase();
  return r === 'ADMIN' || r === 'ACCOUNTANT' || r === 'MANAGER';
}

// ============================================
// RBAC Permission Check for API Routes
// ============================================

import { hasPermission, canAccessFinancials, isAdmin as isAdminCheck } from '@/lib/auth/modules/authorization';
import { Permission } from '@/lib/auth/types';
import { auditLog } from '@/lib/security/audit-logger';

/**
 * @deprecated REMOVED — Use requireVerifiedPermission() instead.
 * This function previously wrapped extractAuthContext() without JWT re-verification
 * and was vulnerable to header forgery attacks.
 *
 * Migration: Replace requirePermission(request, permission) with
 * await requireVerifiedPermission(request, permission)
 */
export function requirePermission(
  _request: NextRequest,
  _permission: Permission
): { user: AuthContext } | { error: NextResponse } {
  throw new Error(
    'requirePermission() has been removed for security reasons. ' +
    'Use requireVerifiedPermission() instead. ' +
    'Note: requireVerifiedPermission() is async, so add "await".'
  );
}

/**
 * @deprecated REMOVED — Use requireVerifiedAdmin() instead.
 * This function previously wrapped extractAuthContext() without JWT re-verification
 * and was vulnerable to header forgery attacks.
 *
 * Migration: Replace requireAdmin(request) with
 * await requireVerifiedAdmin(request)
 */
export function requireAdmin(
  _request: NextRequest
): { user: AuthContext } | { error: NextResponse } {
  throw new Error(
    'requireAdmin() has been removed for security reasons. ' +
    'Use requireVerifiedAdmin() instead. ' +
    'Note: requireVerifiedAdmin() is async, so add "await".'
  );
}

/**
 * @deprecated REMOVED — Use requireVerifiedFinancialAccess() instead.
 * This function previously wrapped extractAuthContext() without JWT re-verification
 * and was vulnerable to header forgery attacks.
 *
 * Migration: Replace requireFinancialAccess(request) with
 * await requireVerifiedFinancialAccess(request)
 */
export function requireFinancialAccess(
  _request: NextRequest
): { user: AuthContext } | { error: NextResponse } {
  throw new Error(
    'requireFinancialAccess() has been removed for security reasons. ' +
    'Use requireVerifiedFinancialAccess() instead. ' +
    'Note: requireVerifiedFinancialAccess() is async, so add "await".'
  );
}

/**
 * @deprecated REMOVED — Use requireVerifiedAuth() + role check instead.
 * This function previously wrapped extractAuthContext() without JWT re-verification
 * and was vulnerable to header forgery attacks.
 *
 * Migration: Replace requireHRAccess(request) with
 * const result = await requireVerifiedAuth(request);
 * if ('error' in result) return result.error;
 * if (!canAccessHR(result.user.role)) return forbiddenResponse();
 */
export function requireHRAccess(
  _request: NextRequest
): { user: AuthContext } | { error: NextResponse } {
  throw new Error(
    'requireHRAccess() has been removed for security reasons. ' +
    'Use requireVerifiedAuth() + canAccessHR() role check instead. ' +
    'Note: requireVerifiedAuth() is async, so add "await".'
  );
}

// ============================================
// JWT-Re-Verified Auth (Critical Routes)
// ============================================

/**
 * SECURITY FIX: Header Forgery Prevention
 *
 * `extractAuthContext()` reads x-user-id / x-user-email / x-user-role from headers
 * set by the proxy after JWT verification. If the proxy is bypassed (e.g., direct
 * access to the Node.js port), an attacker can forge these headers and assume
 * any identity.
 *
 * `requireVerifiedAuth()` provides defense-in-depth for critical routes by:
 *   1. Reading the header-based auth context (fast path)
 *   2. Re-verifying the JWT from the cookie / Authorization header
 *   3. Cross-checking that JWT claims match the x-user-* headers
 *
 * If the headers were forged (claims don't match the JWT), the request is
 * rejected with 401. This makes header forgery ineffective even if the
 * proxy is bypassed.
 *
 * Use this for ALL authenticated routes. The deprecated extractAuthContext() and
 * requirePermission() functions have been removed — always use requireVerified*
 * variants.
 */
export async function requireVerifiedAuth(
  request: NextRequest
): Promise<{ user: AuthContext } | { error: NextResponse }> {
  // Step 1: Read header-based auth context (internal, not exported)
  const ctx = extractAuthContext(request);
  if (!ctx) {
    return { error: unauthorizedResponse() };
  }

  // DEMO MODE PROTECTION: Protect core data from modification
  if (process.env.DEMO_MODE === 'true') {
    const method = request.method;
    const path = request.nextUrl.pathname;
    
    // Prevent modification or deletion of users in Demo Mode
    if ((method === 'DELETE' || method === 'PUT') && path.startsWith('/api/users')) {
      return { error: forbiddenResponse('Modification of users is disabled in Demo Mode.') };
    }
    // Prevent deletion of projects in Demo Mode
    if (method === 'DELETE' && path.startsWith('/api/projects')) {
      return { error: forbiddenResponse('Deletion of projects is disabled in Demo Mode.') };
    }
  }

  // Step 2: Extract and verify the JWT
  const token = getTokenFromRequest(request);
  if (!token) {
    // Headers claim auth but no JWT present — likely forged headers
    log.security('requireVerifiedAuth: x-user-* headers present but no JWT token found — possible header forgery', {
      path: request.nextUrl.pathname,
      userId: ctx.userId,
    });
    return { error: unauthorizedResponse() };
  }

  try {
    const { payload } = await jose.jwtVerify(token, getJWTSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    // Step 3: Cross-check JWT claims against x-user-* headers
    const jwtUserId = payload.userId as string;
    const jwtEmail = payload.email as string;
    const jwtRole = payload.role as string;
    const jwtOrganizationId = payload.organizationId as string | null | undefined;

    if (
      jwtUserId !== ctx.userId ||
      jwtEmail !== ctx.email ||
      jwtRole !== ctx.role ||
      jwtOrganizationId !== ctx.organizationId
    ) {
      // JWT claims don't match the headers — headers were likely forged
      log.security('requireVerifiedAuth: JWT claims do not match x-user-* headers — header forgery detected', {
        path: request.nextUrl.pathname,
        headerUserId: ctx.userId,
        jwtUserId,
        headerEmail: ctx.email,
        jwtEmail,
        headerRole: ctx.role,
        jwtRole,
        headerOrganizationId: ctx.organizationId,
        jwtOrganizationId: jwtOrganizationId ?? null,
      });
      return { error: unauthorizedResponse() };
    }

    // Step 4: Check password-changed-after-token-issued
    // If the user changed their password after this token was issued,
    // the token should be considered invalid
    // SECURITY: Fetch passwordChangedAt from the DATABASE, not the JWT payload.
    // The JWT carries the OLD passwordChangedAt value which won't reflect recent changes.
    const iat = payload.iat as number | undefined;
    if (iat) {
      const userForPwCheck = await db.user.findUnique({
        where: { id: jwtUserId },
        select: { passwordChangedAt: true },
      });
      if (userForPwCheck?.passwordChangedAt && Math.floor(userForPwCheck.passwordChangedAt.getTime() / 1000) > iat) {
        return { error: unauthorizedResponse() };
      }
    }

    // Step 5: Reject 2FA-pending tokens
    // A user who has completed only the password step but not the 2FA step
    // has a token with type='2fa-pending'. This token must not grant access
    // to protected routes — the user must complete 2FA verification first.
    const tokenType = payload.type as string | undefined;
    if (tokenType && tokenType !== 'access') {
      log.security('requireVerifiedAuth: Rejected non-access token type', {
        path: request.nextUrl.pathname,
        tokenType,
        userId: ctx.userId,
      });
      return { error: unauthorizedResponse() };
    }

    // JWT is valid and claims match — return verified auth context
    return { user: ctx };
  } catch (error) {
    // JWT verification failed (expired, invalid signature, etc.)
    log.security('requireVerifiedAuth: JWT verification failed — possible forged or expired token', {
      path: request.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: unauthorizedResponse() };
  }
}

/**
 * Require a specific permission WITH JWT re-verification for critical routes.
 * Combines `requireVerifiedAuth()` + permission check.
 *
 * Use this instead of `requirePermission()` for routes where identity
 * forgery would be catastrophic (user management, payments, etc.).
 */
export async function requireVerifiedPermission(
  request: NextRequest,
  permission: Permission
): Promise<{ user: AuthContext } | { error: NextResponse }> {
  const result = await requireVerifiedAuth(request);
  if ('error' in result) return result;

  if (!hasPermission(result.user.role, permission)) {
    await auditLog('permission.denied', { permission, userRole: result.user.role }, result.user.userId, {
      path: request.nextUrl.pathname,
      method: request.method,
    });
    return { error: forbiddenResponse() };
  }
  return result;
}

/**
 * Require admin role WITH JWT re-verification for critical routes.
 * Use this instead of `requireAdmin()` for admin-only destructive operations.
 */
export async function requireVerifiedAdmin(
  request: NextRequest
): Promise<{ user: AuthContext } | { error: NextResponse }> {
  const result = await requireVerifiedAuth(request);
  if ('error' in result) return result;

  if (!isAdminCheck(result.user.role)) {
    return { error: forbiddenResponse() };
  }
  return result;
}

/**
 * Require financial access WITH JWT re-verification for critical routes.
 * Use this instead of `requireFinancialAccess()` for payment/financial operations.
 */
export async function requireVerifiedFinancialAccess(
  request: NextRequest
): Promise<{ user: AuthContext } | { error: NextResponse }> {
  const result = await requireVerifiedAuth(request);
  if ('error' in result) return result;

  if (!canAccessFinancials(result.user.role)) {
    return { error: forbiddenResponse() };
  }
  return result;
}
