/**
 * Shared Auth Token Utilities
 * أدوات الرموز المميزة المشتركة
 *
 * Centralized utilities used by login, refresh, session, logout, and 2FA routes.
 * Extracted from duplicated definitions across auth route files.
 */

import { SignJWT } from 'jose';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { getJwtSecretBytes } from '@/lib/auth/jwt-secret';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Cookie name for the access token */
export const AUTH_COOKIE_NAME = 'blue_token';

/** Cookie name for the refresh token */
export const REFRESH_COOKIE_NAME = 'blue_refresh_token';

/** Access token expiry (for auth cookie JWTs) */
export const ACCESS_TOKEN_EXPIRY = '15m';

/** Access token max age in seconds */
export const ACCESS_TOKEN_MAX_AGE = 15 * 60;

/** Refresh token expiry in days */
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/** Refresh token max age in seconds */
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

// ─── Role Normalization ──────────────────────────────────────────────────────

/**
 * Normalize role to lowercase for client-side use.
 * The Prisma schema stores UPPERCASE (ADMIN, ENGINEER) but the
 * client-side permissions.ts uses lowercase (admin, engineer).
 * Both are valid — we normalize for consistent client behavior.
 */
export function normalizeRoleForClient(role: string): string {
  const r = role.toUpperCase();
  switch (r) {
    case 'PROJECT_MANAGER': return 'project_manager';
    default: return r.toLowerCase();
  }
}

// ─── Token Hashing ───────────────────────────────────────────────────────────

/**
 * Hash a token using SHA-256 for secure storage.
 * Used for refresh token lookup in the database.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Symmetric Encryption (AES-256-GCM) ─────────────────────────────────────

/**
 * Get the encryption key for encrypting sensitive data at rest.
 * Uses ENCRYPTION_KEY env var (must be 64 hex chars = 256 bits).
 *
 * SECURITY IMPLICATIONS:
 * ---------------------
 * In production: ENCRYPTION_KEY is MANDATORY. If not set, the application will
 * fail to start/operate. There is NO fallback — deriving from JWT_SECRET using
 * trivial padding creates a false sense of security because:
 *   1. The derivation is predictable and not cryptographically sound
 *   2. If JWT_SECRET leaks, the encryption key is also compromised
 *   3. It masks misconfiguration instead of surfacing it
 *
 * In development: A fallback derivation from JWT_SECRET via SHA-256 is allowed
 * with a prominent warning, but this must NEVER be used in production.
 * Data encrypted with the dev fallback will NOT be decryptable with a proper
 * ENCRYPTION_KEY, so switching environments requires re-encryption.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (key && key.length >= 64) {
    return Buffer.from(key.slice(0, 64), 'hex');
  }

  // PRODUCTION: ENCRYPTION_KEY is MANDATORY — fail loudly
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: ENCRYPTION_KEY environment variable is required in production. ' +
      'It must be 64 hex characters (256 bits). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // DEVELOPMENT: Allow fallback from JWT_SECRET with prominent warning
  // This uses proper cryptographic derivation (SHA-256) instead of the previous
  // trivial padding approach, but is still NOT secure for production use.
  if (process.env.JWT_SECRET) {
    log.warn(
      '\n' + '='.repeat(70) + '\n' +
      '  ⚠️  SECURITY WARNING: ENCRYPTION_KEY is NOT set!\n' +
      '  Encryption is NOT secure in this configuration.\n' +
      '  Deriving encryption key from JWT_SECRET using SHA-256 (dev only).\n' +
      '  This means:\n' +
      '    - If JWT_SECRET is compromised, encrypted data is also exposed\n' +
      '    - Data encrypted now will NOT decrypt with a proper ENCRYPTION_KEY\n' +
      '  Set ENCRYPTION_KEY in your .env file: openssl rand -hex 32\n' +
      '='.repeat(70) + '\n'
    );
    // Derive a proper 32-byte key using SHA-256 (not trivial padding)
    return createHash('sha256').update(process.env.JWT_SECRET).digest();
  }

  // NEITHER key is available — cannot encrypt anything
  throw new Error(
    'FATAL: ENCRYPTION_KEY is not set and no JWT_SECRET available for dev fallback. ' +
    'Set ENCRYPTION_KEY (64 hex chars) in your environment. ' +
    'Generate with: openssl rand -hex 32'
  );
}

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a base64 string containing IV + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: IV (12 bytes) + authTag (16 bytes) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a ciphertext string that was encrypted with encrypt().
 * Expects a base64 string containing IV + authTag + ciphertext.
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

// ─── JWT Generation ──────────────────────────────────────────────────────────

/**
 * Payload for the auth cookie JWT (used by login, refresh, and 2FA verify routes).
 */
export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  twoFactorEnabled?: boolean;
  organizationId?: string | null;
  passwordChangedAt?: number; // Unix timestamp — used to invalidate JWTs after password change
  emailVerified?: boolean; // Whether the user's email has been verified — unverified users have restricted access
}

/**
 * Generate the auth cookie JWT used by login, refresh, and 2FA verify routes.
 *
 * This produces a short-lived (15m) JWT with normalized role, stored in the
 * `blue_token` httpOnly cookie. The payload uses `name` (not `username`) and
 * includes `twoFactorEnabled`.
 *
 * IMPORTANT: This is the canonical JWT generator for the auth cookie.
 * Do NOT duplicate JWT generation logic in route files — import this function.
 */
export async function generateAuthToken(user: AuthTokenPayload): Promise<string> {
  return new SignJWT({
    userId: user.userId,
    email: user.email,
    name: user.name ?? "",
    role: normalizeRoleForClient(user.role),
    twoFactorEnabled: user.twoFactorEnabled || false,
    organizationId: user.organizationId || undefined,
    passwordChangedAt: user.passwordChangedAt || 0,
    emailVerified: user.emailVerified ?? true, // Default to true for existing/OAuth users; explicit false for unverified registrations
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('blueprint-saas')
    .setAudience('blueprint-users')
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(getJwtSecretBytes());
}

// ===== Token Expiry Constants =====
// NOTE: The individual constants above (ACCESS_TOKEN_EXPIRY, etc.) are the canonical
// source. TOKEN_EXPIRY is kept for backward compatibility only. Do NOT add new
// constants here — use the individual exports instead.

/** Token expiry constants for consistent usage across auth modules */
export const TOKEN_EXPIRY = {
  ACCESS_TOKEN: ACCESS_TOKEN_EXPIRY,
  ACCESS_TOKEN_MAX_AGE: ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_DAYS: REFRESH_TOKEN_EXPIRY_DAYS,
  REFRESH_TOKEN_MAX_AGE: REFRESH_TOKEN_MAX_AGE,
} as const;

// ─── Cookie Options ──────────────────────────────────────────────────────────

/**
 * Determine whether auth cookies should require HTTPS (Secure flag).
 * Supports explicit override via COOKIE_SECURE for LAN testing on HTTP IP addresses.
 */
export function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

/**
 * Get common cookie options for auth cookies.
 */
export function getAuthCookieOptions(maxAge: number) {
  return {
    path: '/',
    maxAge,
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: 'lax' as const,
  };
}

// ─── DB-stored Refresh Token ─────────────────────────────────────────────────

/**
 * Generate a cryptographically secure refresh token and store its hash in the database.
 * Returns the raw token (to be sent to the client as an httpOnly cookie).
 *
 * This is the CORRECT refresh token pattern used by all auth routes:
 * - Random UUID-based token (not a JWT)
 * - SHA-256 hash stored in DB for lookup
 * - Supports rotation with reuse detection
 */
export async function generateDbRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}
