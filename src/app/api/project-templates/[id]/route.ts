import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, requireVerifiedPermission } from "../../utils/auth";
import { errorResponse } from "../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const updateProjectTemplateSchema = z.object({
  name: z.string().optional(),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  defaultBudget: z.number().nullable().optional(),
  defaultDurationDays: z.number().nullable().optional(),
  currency: z.string().optional(),
  stages: z.union([z.string(), z.array(z.any())]).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const template = await db.projectTemplate.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!template) {
      return errorResponse("Project template not found", "NOT_FOUND", 404);
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    log.error("Error fetching project template:", error);
    return errorResponse("Failed to fetch project template", "SERVER_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_UPDATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.projectTemplate.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Project template not found", "NOT_FOUND", 404);
    }

    const rawBody = await request.json();
    const validation = updateProjectTemplateSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    let stagesStr: string | undefined = undefined;
    if (data.stages !== undefined) {
      stagesStr = typeof data.stages === "string" ? data.stages : JSON.stringify(data.stages);
    }

    const updated = await db.projectTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.descriptionAr !== undefined && { descriptionAr: data.descriptionAr }),
        ...(data.category !== undefined && { category: data.category.toUpperCase() }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.defaultBudget !== undefined && { defaultBudget: data.defaultBudget }),
        ...(data.defaultDurationDays !== undefined && { defaultDurationDays: data.defaultDurationDays }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(stagesStr !== undefined && { stages: stagesStr }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error("Error updating project template:", error);
    return errorResponse("Failed to update project template", "SERVER_ERROR", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_DELETE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.projectTemplate.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Project template not found", "NOT_FOUND", 404);
    }

    await db.projectTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Project template deleted successfully" });
  } catch (error) {
    log.error("Error deleting project template:", error);
    return errorResponse("Failed to delete project template", "SERVER_ERROR", 500);
  }
}
