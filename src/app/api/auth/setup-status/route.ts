/**
 * API Route: Setup Status — first-run detection
 * مسار حالة الإعداد الأول
 *
 * GET /api/auth/setup-status
 *   returns: { setupNeeded: boolean }
 *
 * SECURITY:
 * - Public (no JWT) — needed by the login page BEFORE any account exists.
 * - Only reveals a boolean "does any user exist" — no user data, no emails.
 * - Once the first account is created, setupNeeded becomes false forever
 *   (until the database is manually wiped), closing the setup surface.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const userCount = await db.user.count({
      where: { deletedAt: null },
    });

    return NextResponse.json({
      setupNeeded: userCount === 0,
    });
  } catch {
    // If the database is unreachable we must NOT claim setup is needed
    // (that would redirect every visitor to /setup on a DB outage).
    return NextResponse.json({ setupNeeded: false });
  }
}
