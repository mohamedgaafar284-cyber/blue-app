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

const createDocumentVersionSchema = z.object({
  filePath: z.string().min(1, "File path is required"),
  fileSize: z.number().nonnegative().optional().default(0),
  changeNotes: z.string().optional().default(""),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * @openapi
 * /api/documents/{id}/versions:
 *   get:
 *     tags: [Documents]
 *     summary: List all historical versions of a document
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
    const documentId = idResult.id;

    // Verify document belongs to caller's org
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, organizationId: true, deletedAt: true },
    });

    if (!document || document.deletedAt) {
      return errorResponse("Document not found", "NOT_FOUND", 404);
    }

    const orgError = orgCheck(user, document);
    if (orgError) return orgError;

    const versions = await db.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({ data: versions });
  } catch (error) {
    log.error("Error fetching document versions:", error);
    return errorResponse("Failed to fetch document versions", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/documents/{id}/versions:
 *   post:
 *     tags: [Documents]
 *     summary: Create a new version of a document
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
    const documentId = idResult.id;

    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (!document || document.deletedAt) {
      return errorResponse("Document not found", "NOT_FOUND", 404);
    }

    const orgError = orgCheck(user, document);
    if (orgError) return orgError;

    const rawBody = await request.json();
    const validation = createDocumentVersionSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);
    const latestVersion = document.versions[0]?.version || document.version || 1;
    const nextVersion = latestVersion + 1;

    const { versionRecord, updatedDocument } = await db.$transaction(async (tx) => {
      const vRec = await tx.documentVersion.create({
        data: {
          documentId,
          version: nextVersion,
          filePath: data.filePath,
          fileSize: data.fileSize || 0,
          changeNotes: data.changeNotes,
          uploadedById: user.userId,
        },
      });

      const updated = await tx.document.update({
        where: { id: documentId },
        data: {
          version: nextVersion,
          filePath: data.filePath,
          fileSize: data.fileSize || document.fileSize,
        },
      });

      return { versionRecord: vRec, updatedDocument: updated };
    });

    return NextResponse.json({ data: { version: versionRecord, document: updatedDocument } }, { status: 201 });
  } catch (error) {
    log.error("Error creating document version:", error);
    return errorResponse("Failed to create document version", "SERVER_ERROR", 500);
  }
}
