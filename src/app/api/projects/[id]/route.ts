import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from '@/lib/security/sanitize';
import { requireVerifiedPermission, orgCheck } from '../../utils/auth';
import { errorResponse, notFoundResponse } from '../../utils/response';
import { validateRequest, projectUpdateSchema, validateIdParam } from '@/lib/api-validation';
import { log } from '@/lib/logger';
import { Permission } from '@/lib/auth/types';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // RBAC CHECK
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ('error' in rbac) return rbac.error;
    const user = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;

    const project = await db.project.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, name: true, company: true, email: true, phone: true },
        },
        contractor: {
          select: { id: true, name: true, nameEn: true, companyName: true, companyEn: true, contactPerson: true, phone: true, email: true, category: true, rating: true, crNumber: true, licenseNumber: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true, avatar: true, department: true, position: true } },
          },
        },
        stages: {
          orderBy: [{ department: "asc" }, { stageOrder: "asc" }],
        },
        govApprovals: true,
        muniRejections: true,
        boqItems: {
          orderBy: { code: "asc" },
        },
        schedulePhases: {
          orderBy: [{ section: "asc" }, { phaseOrder: "asc" }],
        },
        invoices: {
          orderBy: { issueDate: "desc" },
        },
        contracts: true,
        budgets: true,
        siteVisits: {
          orderBy: { date: "desc" },
        },
        defects: {
          orderBy: { createdAt: "desc" },
        },
        siteDiaries: {
          orderBy: { date: "desc" },
        },
        clientInteractions: {
          orderBy: { date: "desc" },
          include: {
            client: { select: { id: true, name: true } },
          },
        },
        tasks: {
          select: { id: true, status: true },
        },
      },
    });

    if (!project) {
      return notFoundResponse("Project not found");
    }

    // Multi-tenancy: check org access
    const orgError = orgCheck(user, project);
    if (orgError) return orgError;

    // Skip soft-deleted projects
    if (project.deletedAt) {
      return notFoundResponse("Project not found");
    }

    const taskStats = {
      total: project.tasks.length,
      TODO: project.tasks.filter((t) => t.status === "TODO" || t.status === "todo").length,
      inProgress: project.tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "in_progress").length,
      REVIEW: project.tasks.filter((t) => t.status === "REVIEW" || t.status === "IN_REVIEW" || t.status === "review").length,
      DONE: project.tasks.filter((t) => t.status === "DONE" || t.status === "done").length,
    };

    const stagesByDepartment: Record<string, typeof project.stages> = {};
    for (const stage of project.stages) {
      if (!stagesByDepartment[stage.department]) {
        stagesByDepartment[stage.department] = [];
      }
      stagesByDepartment[stage.department].push(stage);
    }

    const scheduleBySection: Record<string, typeof project.schedulePhases> = {};
    for (const phase of project.schedulePhases) {
      if (!scheduleBySection[phase.section]) {
        scheduleBySection[phase.section] = [];
      }
      scheduleBySection[phase.section].push(phase);
    }

    return NextResponse.json({
      ...project,
      taskStats,
      stagesByDepartment,
      scheduleBySection,
    });
  } catch (error) {
    log.error("Error fetching project:", error);
    return errorResponse("Failed to fetch project", "SERVER_ERROR", 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    // RBAC CHECK
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_UPDATE);
    if ('error' in rbac) return rbac.error;
    const user = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;
    const rawBody = await request.json();
    const validation = validateRequest(projectUpdateSchema, rawBody);

    // Zod validation for project update fields
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }
    const body = sanitizeObject(validation.data);

    // Check project exists and is not soft-deleted
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return notFoundResponse("Project not found");
    }

    // Multi-tenancy: check org access
    const orgError = orgCheck(user, existing);
    if (orgError) return orgError;

    // SECURITY: Explicit field mapping instead of Object.entries() spread.
    // Prevents mass assignment — only known safe fields can be updated.
    // Never allow overwriting organizationId, createdById, deletedAt, or id.
    const data: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'nameEn', 'clientId', 'contractorId', 'location', 'plotNumber',
      'type', 'budget', 'startDate', 'endDate', 'description', 'status', 'progress',
    ] as const;
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        // Convert date strings to Date objects
        if ((key === 'startDate' || key === 'endDate') && body[key]) {
          data[key] = new Date(body[key] as string);
        } else {
          data[key] = body[key];
        }
      }
    }

    const project = await db.project.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true, company: true } },
        contractor: { select: { id: true, name: true, companyName: true } },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    log.error("Error updating project:", error);
    return errorResponse("Failed to update project", "SERVER_ERROR", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    // RBAC CHECK
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_DELETE);
    if ('error' in rbac) return rbac.error;
    const user = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const id = idResult.id;

    // Check project exists
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return notFoundResponse("Project not found");
    }

    // Multi-tenancy: check org access
    const orgError = orgCheck(user, existing);
    if (orgError) return orgError;

    // SOFT DELETE instead of hard delete
    await db.project.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting project:", error);
    return errorResponse("Failed to delete project", "SERVER_ERROR", 500);
  }
}
