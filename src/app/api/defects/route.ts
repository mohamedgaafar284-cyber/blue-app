import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter, orgCreate } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { sanitizeObject } from '@/lib/security/sanitize';
import { z } from 'zod';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { parsePaginationParams, buildPaginationMeta, calculateSkip, isPaginationRequested } from '../utils/pagination';
import { cachedQuery, invalidateCache } from '@/lib/cache/query-cache';
import { CACHE_TTL } from '@/lib/cache/query-cache';

// Zod schema for defect creation
const defectCreateSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(5000).optional().default(''),
  severity: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).default('NORMAL'),
  status: z.string().max(50).default('OPEN'),
  assigneeId: z.string().max(100).optional().default(''),
  location: z.string().max(300).optional().default(''),
  photos: z.string().optional().default(''),
  notes: z.string().max(5000).optional().default(''),
});

export async function GET(request: NextRequest) {
  const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  try {
    const result = await requireVerifiedPermission(request, Permission.DEFECT_READ);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const assigneeId = searchParams.get("assigneeId");

    const where: Record<string, unknown> = { deletedAt: null, ...orgFilter(ctx) };
    if (projectId) where.projectId = projectId;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;

    const usePagination = isPaginationRequested(searchParams);
    const { page, limit } = parsePaginationParams(searchParams);
    const cacheKey = `defects:${ctx.organizationId || 'none'}:${projectId || 'all'}:${severity || 'all'}:${status || 'all'}:${page}:${limit}`;

    if (usePagination) {
      const [defects, total] = await cachedQuery(cacheKey, () => Promise.all([
        db.defect.findMany({
          where,
          include: {
            project: {
              select: { id: true, name: true, nameEn: true, number: true },
            },
            assignee: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: calculateSkip(page, limit),
          take: limit,
        }),
        db.defect.count({ where }),
      ]), CACHE_TTL.DEFECTS);

      return NextResponse.json({ data: defects, pagination: buildPaginationMeta(page, limit, total) });
    }

    // Backward-compatible: no pagination params → return raw array (with caching)
    const defects = await cachedQuery(cacheKey, () =>
      db.defect.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, nameEn: true, number: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    CACHE_TTL.DEFECTS);

    return NextResponse.json(defects);
  } catch (error) {
    log.error("Error fetching defects:", error);
    return NextResponse.json({ error: "Failed to fetch defects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const result = await requireVerifiedPermission(request, Permission.DEFECT_CREATE);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const rawBody = await request.json();
    const validation = defectCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }
    const _body = sanitizeObject(validation.data);
    const validatedData = sanitizeObject(validation.data);

    const { projectId, title, description, severity, status, assigneeId, location, photos, notes } = validatedData;

    // Combine description and notes into resolutionNotes so site explanations are fully preserved
    const combinedNotesParts: string[] = [];
    if (description) combinedNotesParts.push(`[الوصف والمعالجة]: ${description}`);
    if (notes) combinedNotesParts.push(notes);
    const resolvedNotes = combinedNotesParts.join('\n\n');

    const defect = await db.defect.create({
      data: {
        projectId,
        title,
        severity: (severity || "normal").toLowerCase(),
        location: location || "",
        assigneeId: assigneeId || null,
        photos: photos || "",
        resolutionNotes: resolvedNotes,
        status: (status || "open").toLowerCase(),
        ...orgCreate(ctx),
        createdById: ctx.userId,
      },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    await invalidateCache('defects');
    return NextResponse.json(defect, { status: 201 });
  } catch (error) {
    log.error("Error creating defect:", error);
    return NextResponse.json({ error: "Failed to create defect" }, { status: 500 });
  }
}
