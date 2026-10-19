import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgCheck } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { errorResponse } from "@/app/api/utils/response";
import { sanitizeObject } from "@/lib/security/sanitize";
import { log } from "@/lib/logger";
import { z } from "zod";

const createRevisionSchema = z.object({
  version: z.number().int().min(1).optional(),
  filePath: z.string().min(1, "File path is required"),
  changeNotes: z.string().optional().default(""),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * @openapi
 * /api/design-drawings/{id}/revisions:
 *   get:
 *     tags: [Design Management]
 *     summary: List revisions of a design drawing
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.DOCUMENT_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const drawingId = idResult.id;

    const drawing = await db.designDrawing.findUnique({
      where: { id: drawingId },
      select: {
        id: true,
        deletedAt: true,
        designPhase: {
          select: {
            project: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!drawing || drawing.deletedAt) {
      return errorResponse("Drawing not found", "NOT_FOUND", 404);
    }

    const orgError = orgCheck(user, { organizationId: drawing.designPhase?.project?.organizationId });
    if (orgError) return orgError;

    const revisions = await db.designRevision.findMany({
      where: { drawingId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({ data: revisions });
  } catch (error) {
    log.error("Error fetching drawing revisions:", error);
    return errorResponse("Failed to fetch drawing revisions", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/design-drawings/{id}/revisions:
 *   post:
 *     tags: [Design Management]
 *     summary: Add a new revision to a design drawing
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.DOCUMENT_CREATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const drawingId = idResult.id;

    const drawing = await db.designDrawing.findUnique({
      where: { id: drawingId },
      include: {
        designPhase: {
          select: {
            project: { select: { organizationId: true } },
          },
        },
        revisions: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!drawing || drawing.deletedAt) {
      return errorResponse("Drawing not found", "NOT_FOUND", 404);
    }

    const orgError = orgCheck(user, { organizationId: drawing.designPhase?.project?.organizationId });
    if (orgError) return orgError;

    const rawBody = await request.json();
    const validation = createRevisionSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);
    const latestVersion = drawing.revisions[0]?.version || drawing.version || 1;
    const nextVersion = data.version || latestVersion + 1;

    // Create revision and update current drawing version atomically
    const { revision, updatedDrawing } = await db.$transaction(async (tx) => {
      const rev = await tx.designRevision.create({
        data: {
          drawingId,
          version: nextVersion,
          filePath: data.filePath,
          changeNotes: data.changeNotes,
          uploadedById: user.userId,
        },
      });

      const updated = await tx.designDrawing.update({
        where: { id: drawingId },
        data: {
          version: nextVersion,
          filePath: data.filePath,
          status: "draft", // new revision resets status for review
        },
        include: { revisions: { orderBy: { createdAt: "desc" } } },
      });

      return { revision: rev, updatedDrawing: updated };
    });

    return NextResponse.json({ data: { revision, drawing: updatedDrawing } }, { status: 201 });
  } catch (error) {
    log.error("Error creating drawing revision:", error);
    return errorResponse("Failed to create drawing revision", "SERVER_ERROR", 500);
  }
}
