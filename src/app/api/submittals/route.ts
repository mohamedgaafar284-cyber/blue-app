import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgCreate , orgFilterNested} from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { z } from 'zod';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { parsePaginationParams, buildPaginationMeta, calculateSkip, isPaginationRequested } from '../utils/pagination';
import { cachedQuery, invalidateCache, CACHE_TTL } from '@/lib/cache/query-cache';

// Zod schema for submittal creation
const submittalCreateSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required').max(100),
  number: z.string().max(50).optional().default(''),
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional().default(''),
  type: z.string().max(100).optional().default(''),
  revision: z.string().max(50).optional().default(''),
  revisionNumber: z.coerce.number().min(0).max(999).optional().default(1),
  contractorId: z.string().max(100).optional().default(''),
  contractor: z.string().max(200).optional().default(''),
  status: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'PENDING']).default('UNDER_REVIEW'),
});

export async function GET(request: NextRequest) {
  const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  try {
    const result = await requireVerifiedPermission(request, Permission.SUBMITTAL_READ);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    // Submittal doesn't have organizationId directly; filter through project relationship
    const orgWhere = orgFilterNested(ctx, 'project');
    const where: Record<string, unknown> = { deletedAt: null, ...orgWhere };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const usePagination = isPaginationRequested(searchParams);
    const { page, limit } = parsePaginationParams(searchParams);
    const cacheKey = `submittals:${ctx.organizationId || 'none'}:${projectId || 'all'}:${status || 'all'}:${page}:${limit}`;

    if (usePagination) {
      const [submittals, total] = await cachedQuery(cacheKey, () => Promise.all([
        db.submittal.findMany({
          where,
          include: {
            project: {
              select: { id: true, name: true, nameEn: true, number: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: calculateSkip(page, limit),
          take: limit,
        }),
        db.submittal.count({ where }),
      ]), CACHE_TTL.DEFAULT);

      return NextResponse.json({ data: submittals, pagination: buildPaginationMeta(page, limit, total) });
    }

    const submittals = await cachedQuery(cacheKey, () =>
      db.submittal.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, nameEn: true, number: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    CACHE_TTL.DEFAULT);

    return NextResponse.json(submittals);
  } catch (error) {
    log.error("Error fetching submittals:", error);
    return NextResponse.json({ error: "Failed to fetch submittals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const result = await requireVerifiedPermission(request, Permission.SUBMITTAL_CREATE);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const rawBody = await request.json();

    // Zod validation for submittal fields
    const validation = submittalCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    const { projectId, number, title, type, contractor, revisionNumber, status } = validation.data;

    const submittal = await db.submittal.create({
      data: {
        ...orgCreate(ctx),
        projectId,
        number: number || "",
        title,
        type: type || "",
        contractor: contractor || "",
        revisionNumber: revisionNumber || 1,
        status: (status || "UNDER_REVIEW"),
      },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
      },
    });

    await invalidateCache('submittals');
    return NextResponse.json(submittal, { status: 201 });
  } catch (error) {
    log.error("Error creating submittal:", error);
    return NextResponse.json({ error: "Failed to create submittal" }, { status: 500 });
  }
}
