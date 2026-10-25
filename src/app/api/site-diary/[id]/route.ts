import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission , orgFilter} from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { validateIdParam } from '@/lib/api-validation';
import { invalidateCache } from '@/lib/cache/query-cache';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // RBAC CHECK - requires SITE_DIARY_READ permission
    const rbac = await requireVerifiedPermission(request, Permission.SITE_DIARY_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;

    const orgWhere = orgFilter(ctx);
    const diary = await db.siteDiary.findFirst({
      where: { id, deletedAt: null, ...orgWhere },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
      },
    });

    if (!diary) {
      return NextResponse.json({ error: "Site diary not found" }, { status: 404 });
    }

    return NextResponse.json(diary);
  } catch (error) {
    log.error("Error fetching site diary:", error);
    return NextResponse.json({ error: "Failed to fetch site diary" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // RBAC CHECK - requires SITE_DIARY_DELETE permission
    const rbac = await requireVerifiedPermission(request, Permission.SITE_DIARY_DELETE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;

    // Verify org ownership before delete
    const orgWhere = orgFilter(ctx);
    const existing = await db.siteDiary.findFirst({ where: { id, ...orgWhere } });
    if (!existing) {
      return NextResponse.json({ error: "Site diary not found" }, { status: 404 });
    }

    await db.siteDiary.update({ where: { id }, data: { deletedAt: new Date() } });
    await invalidateCache('site-diaries');
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting site diary:", error);
    return NextResponse.json({ error: "Failed to delete site diary" }, { status: 500 });
  }
}
