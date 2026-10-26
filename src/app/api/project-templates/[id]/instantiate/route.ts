import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, orgCreate, requireVerifiedPermission } from "../../../utils/auth";
import { errorResponse } from "../../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const instantiateSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  nameAr: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  customizations: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * @openapi
 * /api/project-templates/{id}/instantiate:
 *   post:
 *     tags: [Project Templates]
 *     summary: Instantiate a project from template
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_CREATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const template = await db.projectTemplate.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!template) {
      return errorResponse("Project template not found", "NOT_FOUND", 404);
    }

    const rawBody = await request.json();
    const validation = instantiateSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    let stages: Array<{
      name: string;
      nameAr?: string;
      order: number;
      tasks?: Array<{
        title: string;
        titleAr?: string;
        description?: string;
        estimatedHours?: number;
        priority?: string;
      }>;
    }> = [];

    try {
      stages = JSON.parse(template.stages);
    } catch {
      stages = [];
    }

    const newProjectNumber = `PRJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await db.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          number: newProjectNumber,
          name: data.name,
          nameEn: data.name,
          clientId: data.clientId,
          budget: template.defaultBudget || 0,
          status: "active",
          createdById: user.userId,
          ...orgCreate(user),
        },
      });

      let tasksCount = 0;
      let stagesCount = 0;

      for (const stage of stages) {
        stagesCount++;
        await tx.projectStage.create({
          data: {
            // Arabic-first stage name (office primary language), English fallback
            stageName: stage.nameAr || stage.name,
            department: "ARCHITECTURAL",
            stageOrder: stage.order || stagesCount,
            projectId: createdProject.id,
            status: "NOT_STARTED",
            notes: "",
            ...orgCreate(user),
          },
        });

        if (stage.tasks && stage.tasks.length > 0) {
          for (const task of stage.tasks) {
            tasksCount++;
            await tx.task.create({
              data: {
                title: task.title,
                titleAr: task.titleAr || task.title,
                description: task.description || "",
                projectId: createdProject.id,
                priority: (task.priority || "normal").toLowerCase(),
                status: "todo",
                estimatedHours: task.estimatedHours || 0,
                ...orgCreate(user),
              },
            });
          }
        }
      }

      return { project: createdProject, stagesCreated: stagesCount, tasksCreated: tasksCount };
    });

    return NextResponse.json({
      data: {
        project: result.project,
        stagesCreated: result.stagesCreated,
        tasksCreated: result.tasksCreated,
      },
    }, { status: 201 });
  } catch (error) {
    log.error("Error instantiating project template:", error);
    return errorResponse("Failed to instantiate project from template", "SERVER_ERROR", 500);
  }
}
