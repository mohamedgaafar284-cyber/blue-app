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

const signDocumentSchema = z.object({
  signatureDataUrl: z.string().min(10, "Signature image is required").max(700_000, "Signature payload too large (max 500KB)"),
  signerName: z.string().min(1, "Signer name is required").max(100),
  signerRole: z.string().optional().default(""),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * @openapi
 * /api/documents/{id}/sign:
 *   get:
 *     tags: [Documents]
 *     summary: List signatures on a document
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

    const signatures = await db.documentSignature.findMany({
      where: { documentId },
      orderBy: { signedAt: "desc" },
    });

    return NextResponse.json({ data: signatures });
  } catch (error) {
    log.error("Error fetching document signatures:", error);
    return errorResponse("Failed to fetch document signatures", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/documents/{id}/sign:
 *   post:
 *     tags: [Documents]
 *     summary: Sign a document with signature pad image
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.DOCUMENT_UPDATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const documentId = idResult.id;

    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, organizationId: true, deletedAt: true },
    });

    if (!document || document.deletedAt) {
      return errorResponse("Document not found", "NOT_FOUND", 404);
    }

    const orgError = orgCheck(user, document);
    if (orgError) return orgError;

    const rawBody = await request.json();
    const validation = signDocumentSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;

    const signature = await db.documentSignature.create({
      data: {
        documentId,
        signerName: data.signerName,
        signerRole: data.signerRole || "",
        signatureImage: data.signatureDataUrl,
        signedById: user.userId,
        ipAddress: ipAddress ? ipAddress.split(",")[0].trim() : null,
      },
    });

    return NextResponse.json({ success: true, data: signature }, { status: 201 });
  } catch (error) {
    log.error("Error saving document signature:", error);
    return errorResponse("Failed to save document signature", "SERVER_ERROR", 500);
  }
}
