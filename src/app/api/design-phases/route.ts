import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilterNested, orgCheck } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { validateRequest, designPhaseCreateSchema } from '@/lib/api-validation';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { parsePaginationParams, buildPaginationMeta, calculateSkip } from '@/app/api/utils/pagination';

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

    // Secure nested organization filter with default-deny
    const where: Record<string, unknown> = {
      ...orgFilterNested(ctx, 'project'),
    };
    if (projectId) where.projectId = projectId;

    const { page, limit } = parsePaginationParams(searchParams);
    const skip = calculateSkip(page, limit);

    const [phases, total] = await Promise.all([
      db.designPhase.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, nameEn: true, number: true },
          },
          drawings: {
            select: { id: true, status: true, clashDetected: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip,
      }),
      db.designPhase.count({ where }),
    ]);

    return NextResponse.json({
      data: phases,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
    log.error("Error fetching design phases:", error);
    return NextResponse.json({ error: "Failed to fetch design phases" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const result = await requireVerifiedPermission(request, Permission.PROJECT_CREATE);
    if ('error' in result) return result.error;
    const user = result.user;

    const rawBody = await request.json();

    // Zod validation for design phase create fields
    const validation = validateRequest(designPhaseCreateSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }
    const validatedData = validation.data;
    const { projectId, phase, phaseNameAr, phaseNameEn, status, designerId, startDate, dueDate, notes } = validatedData;

    // SECURITY: Verify the target project belongs to the caller's organization
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const orgError = orgCheck(user, project);
    if (orgError) return orgError;

    const designPhase = await db.designPhase.create({
      data: {
        projectId,
        phase: (phase || "CONCEPT"),
        phaseNameAr: phaseNameAr || "",
        phaseNameEn: phaseNameEn || "",
        status: (status || "NOT_STARTED"),
        designerId: designerId || null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || "",
        organizationId: user.organizationId || project.organizationId,
      },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
      },
    });

    return NextResponse.json(designPhase, { status: 201 });
  } catch (error) {
    log.error("Error creating design phase:", error);
    return NextResponse.json({ error: "Failed to create design phase" }, { status: 500 });
  }
}
