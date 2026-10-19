import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, orgCreate, requireVerifiedPermission } from "../utils/auth";
import { errorResponse } from "../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const createProjectTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  category: z.string().default("RESIDENTIAL"),
  icon: z.string().default("📋"),
  defaultBudget: z.number().nullable().optional(),
  defaultDurationDays: z.number().nullable().optional(),
  currency: z.string().default("AED"),
  stages: z.union([z.string(), z.array(z.any())]).optional(),
});

/**
 * @openapi
 * /api/project-templates:
 *   get:
 *     tags: [Project Templates]
 *     summary: List project templates
 */
export async function GET(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...orgFilter(user),
    };

    if (category && category !== "all") {
      where.category = category.toUpperCase();
    }

    const templates = await db.projectTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const formatted = templates.map((t) => {
      let parsedStages = [];
      try {
        parsedStages = JSON.parse(t.stages);
      } catch {
        parsedStages = [];
      }
      return {
        id: t.id,
        name: t.name,
        nameAr: t.nameAr,
        description: t.description,
        descriptionAr: t.descriptionAr,
        category: t.category,
        icon: t.icon,
        defaultBudget: t.defaultBudget ? Number(t.defaultBudget) : null,
        defaultDurationDays: t.defaultDurationDays,
        currency: t.currency,
        stages: t.stages,
        stagesCount: parsedStages.length,
        tasksCount: parsedStages.reduce((acc: number, s: any) => acc + (s.tasks?.length || 0), 0),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (error) {
    log.error("Error fetching project templates:", error);
    return errorResponse("Failed to fetch project templates", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/project-templates:
 *   post:
 *     tags: [Project Templates]
 *     summary: Create project template
 */
export async function POST(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_CREATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const rawBody = await request.json();
    const validation = createProjectTemplateSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    let stagesStr = "[]";
    if (data.stages !== undefined) {
      stagesStr = typeof data.stages === "string" ? data.stages : JSON.stringify(data.stages);
    }

    const template = await db.projectTemplate.create({
      data: {
        name: data.name,
        nameAr: data.nameAr || null,
        description: data.description || null,
        descriptionAr: data.descriptionAr || null,
        category: (data.category || "RESIDENTIAL").toUpperCase(),
        icon: data.icon || "📋",
        defaultBudget: data.defaultBudget,
        defaultDurationDays: data.defaultDurationDays,
        currency: data.currency || "AED",
        stages: stagesStr,
        createdById: user.userId,
        ...orgCreate(user),
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    log.error("Error creating project template:", error);
    return errorResponse("Failed to create project template", "SERVER_ERROR", 500);
  }
}
