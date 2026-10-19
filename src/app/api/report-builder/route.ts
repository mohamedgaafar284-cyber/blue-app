import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { createReportTemplateSchema } from "@/lib/validations/report-builder.schema";
import { orgFilter, orgCreate, requireVerifiedPermission } from "../utils/auth";
import { errorResponse } from "../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

/**
 * @openapi
 * /api/report-builder:
 *   get:
 *     tags: [Report Builder]
 *     summary: List saved report templates
 */
export async function GET(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.REPORTS_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const templates = await db.reportTemplate.findMany({
      where: {
        deletedAt: null,
        ...orgFilter(user),
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = templates.map((t) => {
      let fields = [];
      let filters = [];
      try {
        fields = JSON.parse(t.fields);
      } catch {
        fields = [];
      }
      try {
        filters = JSON.parse(t.filters);
      } catch {
        filters = [];
      }

      return {
        id: t.id,
        name: t.name,
        nameAr: t.nameAr,
        description: t.description,
        dataSource: t.dataSource,
        fields,
        filters,
        groupBy: t.groupBy,
        sortBy: t.sortBy,
        sortOrder: t.sortOrder,
        chartType: t.chartType,
        isPublic: t.isPublic,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (error) {
    log.error("Error fetching report templates:", error);
    return errorResponse("Failed to fetch report templates", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/report-builder:
 *   post:
 *     tags: [Report Builder]
 *     summary: Save report template
 */
export async function POST(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.REPORTS_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const rawBody = await request.json();
    const validation = createReportTemplateSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    const template = await db.reportTemplate.create({
      data: {
        name: data.name,
        nameAr: data.nameAr || null,
        description: data.description || null,
        dataSource: data.dataSource,
        fields: JSON.stringify(data.fields),
        filters: JSON.stringify(data.filters || []),
        groupBy: data.groupBy || null,
        sortBy: data.sortBy || null,
        sortOrder: data.sortOrder || "desc",
        chartType: data.chartType || "table",
        isPublic: data.isPublic || false,
        createdById: user.userId,
        ...orgCreate(user),
      },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    log.error("Error creating report template:", error);
    return errorResponse("Failed to create report template", "SERVER_ERROR", 500);
  }
}
