import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { validateRequest, siteVisitCreateSchema } from '@/lib/api-validation';
import { requireVerifiedPermission, orgFilter, orgCreate } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { parsePaginationParams, buildPaginationMeta, calculateSkip, isPaginationRequested } from '../utils/pagination';
import { cachedQuery, invalidateCache, CACHE_TTL } from '@/lib/cache/query-cache';

export async function GET(request: NextRequest) {
  const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  try {
    // RBAC CHECK - requires SITE_DIARY_READ permission
    const rbac = await requireVerifiedPermission(request, Permission.SITE_DIARY_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const municipality = searchParams.get("municipality");

    const where: Record<string, unknown> = { deletedAt: null, ...orgFilter(ctx) };
    if (projectId) where.projectId = projectId;
    if (status) {
      where.status = { in: [status.toUpperCase(), status.toLowerCase()] };
    }
    if (municipality) where.municipality = municipality;

    const usePagination = isPaginationRequested(searchParams);
    const { page, limit } = parsePaginationParams(searchParams);
    const cacheKey = `site-visits:${ctx.organizationId || 'none'}:${projectId || 'all'}:${page}:${limit}`;

    if (usePagination) {
      const [siteVisits, total] = await cachedQuery(cacheKey, () => Promise.all([
        db.siteVisit.findMany({
          where,
          include: {
            project: {
              select: {
                id: true,
                name: true,
                nameEn: true,
                number: true,
                latitude: true,
                longitude: true,
                client: { select: { id: true, name: true, company: true } },
              },
            },
          },
          orderBy: { date: "desc" },
          skip: calculateSkip(page, limit),
          take: limit,
        }),
        db.siteVisit.count({ where }),
      ]), CACHE_TTL.SITE_REPORTS);

      return NextResponse.json({ data: siteVisits, pagination: buildPaginationMeta(page, limit, total) });
    }

    const siteVisits = await cachedQuery(cacheKey, () =>
      db.siteVisit.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              number: true,
              latitude: true,
              longitude: true,
              client: { select: { id: true, name: true, company: true } },
            },
          },
        },
        orderBy: { date: "desc" },
      }),
    CACHE_TTL.SITE_REPORTS);

    return NextResponse.json(siteVisits);
  } catch (error) {
    log.error("Error fetching site visits:", error);
    return NextResponse.json({ error: "Failed to fetch site visits" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    // RBAC CHECK - requires SITE_DIARY_CREATE permission
    const rbac = await requireVerifiedPermission(request, Permission.SITE_DIARY_CREATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const body = await request.json();

    const validation = validateRequest(siteVisitCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }

    const { projectId, date, plotNumber, municipality, gateDescription, neighborDesc, buildingDesc, status, photos, notes, purpose, findings, visitors } = validation.data;

    // Compose rich notes if purpose or findings are provided (e.g. from Field Portal & AI)
    const richNotesParts: string[] = [];
    if (purpose) richNotesParts.push(`[موضوع الزيارة]: ${purpose}`);
    if (findings) richNotesParts.push(`[نتائج المعاينة]:\n${findings}`);
    if (notes) richNotesParts.push(notes);
    const combinedNotes = richNotesParts.join('\n\n');

    const siteVisit = await db.siteVisit.create({
      data: {
        projectId,
        date: new Date(date),
        plotNumber: plotNumber || "",
        municipality: (municipality || ""),
        gateDescription: gateDescription || (visitors ? `الزوار: ${visitors}` : ""),
        neighborDesc: neighborDesc || "",
        buildingDesc: buildingDesc || (purpose ? `الغرض: ${purpose}` : ""),
        status: (status || "DRAFT").toUpperCase(),
        photos: photos || "",
        notes: combinedNotes,
        ...orgCreate(ctx),
        createdById: ctx.userId,
      },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true, client: { select: { id: true, name: true, company: true } } },
        },
      },
    });

    await invalidateCache('site-visits');
    return NextResponse.json(siteVisit, { status: 201 });
  } catch (error) {
    log.error("Error creating site visit:", error);
    return NextResponse.json({ error: "Failed to create site visit" }, { status: 500 });
  }
}
