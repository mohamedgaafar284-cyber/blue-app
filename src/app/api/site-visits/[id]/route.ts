import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission , orgFilterNested} from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { validateRequest, validateIdParam, siteVisitUpdateSchema } from '@/lib/api-validation';

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
    const orgWhere = orgFilterNested(ctx, 'project');
    const siteVisit = await db.siteVisit.findFirst({
      where: { id, deletedAt: null, ...orgWhere },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true, client: { select: { id: true, name: true, company: true } } },
        },
      },
    });

    if (!siteVisit) {
      return NextResponse.json({ error: "Site visit not found" }, { status: 404 });
    }

    return NextResponse.json(siteVisit);
  } catch (error) {
    log.error("Error fetching site visit:", error);
    return NextResponse.json({ error: "Failed to fetch site visit" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // RBAC CHECK - requires SITE_DIARY_UPDATE permission
    const rbac = await requireVerifiedPermission(request, Permission.SITE_DIARY_UPDATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;

    // Verify org ownership before update
    const orgWhere = orgFilterNested(ctx, 'project');
    const existing = await db.siteVisit.findFirst({ where: { id, ...orgWhere } });
    if (!existing) {
      return NextResponse.json({ error: "Site visit not found" }, { status: 404 });
    }

    const body = await request.json();
    // Zod validation for update fields
    const validation = validateRequest(siteVisitUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }
    const { date, plotNumber, municipality, gateDescription, neighborDesc, buildingDesc, status, photos, notes } = validation.data;


    const siteVisit = await db.siteVisit.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(plotNumber !== undefined && { plotNumber }),
        ...(municipality !== undefined && { municipality }),
        ...(gateDescription !== undefined && { gateDescription }),
        ...(neighborDesc !== undefined && { neighborDesc }),
        ...(buildingDesc !== undefined && { buildingDesc }),
        ...(status !== undefined && { status }),
        ...(photos !== undefined && { photos }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true, client: { select: { id: true, name: true, company: true } } },
        },
      },
    });

    // Trigger automated WhatsApp notification if status changed to COMPLETED
    if (status === 'COMPLETED' || siteVisit.status === 'COMPLETED') {
      try {
        const { sendSiteVisitCompletionWhatsApp } = await import('@/lib/services/whatsapp-automation.service');
        await sendSiteVisitCompletionWhatsApp(siteVisit.id, ctx.organizationId || '');
      } catch (waErr) {
        log.error('Failed to trigger WhatsApp site visit notification:', waErr);
      }
    }

    return NextResponse.json(siteVisit);
  } catch (error) {
    log.error("Error updating site visit:", error);
    return NextResponse.json({ error: "Failed to update site visit" }, { status: 500 });
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
    const orgWhere = orgFilterNested(ctx, 'project');
    const existing = await db.siteVisit.findFirst({ where: { id, ...orgWhere } });
    if (!existing) {
      return NextResponse.json({ error: "Site visit not found" }, { status: 404 });
    }

    await db.siteVisit.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting site visit:", error);
    return NextResponse.json({ error: "Failed to delete site visit" }, { status: 500 });
  }
}
