import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgCreate , orgFilterNested} from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { z } from 'zod';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { parsePaginationParams, buildPaginationMeta, calculateSkip } from '../utils/pagination';
import { insensitiveContains } from '../utils/db';
import { cachedQuery, invalidateCache, CACHE_TTL, buildCacheKey } from '@/lib/cache/query-cache';

// Zod schema for RFI creation
const rfiCreateSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required').max(100),
  number: z.string().max(50).optional().default(''),
  subject: z.string().min(1, 'Subject is required').max(300),
  description: z.string().max(5000).optional().default(''),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  fromId: z.string().min(1, 'From user is required').max(100),
  fromUserId: z.string().max(100).optional().default(''),
  toId: z.string().min(1, 'To user is required').max(100),
  toUserId: z.string().max(100).optional().default(''),
  dueDate: z.string().optional().default(''),
});

export async function GET(request: NextRequest) {
  const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  try {
    const result = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const { page, limit, search } = parsePaginationParams(searchParams);

    // RFI doesn't have organizationId directly; filter through project relationship
    const orgWhere = orgFilterNested(ctx, 'project');
    const where: Record<string, unknown> = { deletedAt: null, ...orgWhere };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { subject: insensitiveContains(search) },
        { description: insensitiveContains(search) },
        { number: insensitiveContains(search) },
      ];
    }

    const cacheKey = buildCacheKey('rfi', 'list', ctx.organizationId || 'global', projectId || '', status || '', priority || '', `p${page}`, `l${limit}`, search || '');

    const { rfis, total } = await cachedQuery(cacheKey, async () => {
      const [rfis, total] = await Promise.all([
        db.rFI.findMany({
          where,
          include: {
            project: {
              select: { id: true, name: true, nameEn: true, number: true },
            },
            from: {
              select: { id: true, name: true, email: true, avatar: true },
            },
            to: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: calculateSkip(page, limit),
          take: limit,
        }),
        db.rFI.count({ where }),
      ]);
      return { rfis, total };
    }, CACHE_TTL.RFI);

    return NextResponse.json({ data: rfis, pagination: buildPaginationMeta(page, limit, total) });
  } catch (error) {
    log.error("Error fetching RFIs:", error);
    return NextResponse.json({ error: "Failed to fetch RFIs" }, { status: 500 });
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

    // Zod validation for RFI fields
    const validation = rfiCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    const { projectId, number, subject, description, fromId, toId, priority, dueDate } = validation.data;

    const rfi = await db.rFI.create({
      data: {
        ...orgCreate(ctx),
        projectId,
        number: number || "",
        subject,
        description: description || "",
        fromId,
        toId,
        priority: (priority || "NORMAL"),
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
        from: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        to: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    // Invalidate RFI caches after creation
    await invalidateCache('rfi');

    return NextResponse.json(rfi, { status: 201 });
  } catch (error) {
    log.error("Error creating RFI:", error);
    return NextResponse.json({ error: "Failed to create RFI" }, { status: 500 });
  }
}
