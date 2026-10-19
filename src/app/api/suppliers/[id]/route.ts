import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject, sanitizeEmail } from "@/lib/security/sanitize";
import { supplierSchema } from "@/lib/validations";
import { orgFilter, requireVerifiedPermission } from "../../utils/auth";
import { errorResponse } from "../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.SUPPLIER_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const supplier = await db.supplier.findFirst({
      where: {
        id,
        deletedAt: null,
        ...orgFilter(user),
      },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
        purchaseOrders: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!supplier) {
      return errorResponse("Supplier not found", "NOT_FOUND", 404);
    }

    return NextResponse.json({ data: supplier });
  } catch (error) {
    log.error("Error fetching supplier:", error);
    return errorResponse("Failed to fetch supplier", "SERVER_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.SUPPLIER_UPDATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.supplier.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Supplier not found", "NOT_FOUND", 404);
    }

    const rawBody = await request.json();
    const validation = supplierSchema.partial().safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const validatedData = sanitizeObject(validation.data);
    const sanitizedEmail = validatedData.email !== undefined ? sanitizeEmail(validatedData.email) : undefined;

    const updated = await db.supplier.update({
      where: { id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.category !== undefined && { category: validatedData.category.toUpperCase() }),
        ...(sanitizedEmail !== undefined && { email: sanitizedEmail }),
        ...(validatedData.phone !== undefined && { phone: validatedData.phone }),
        ...(validatedData.address !== undefined && { address: validatedData.address || "" }),
        ...(validatedData.rating !== undefined && { rating: parseInt(validatedData.rating, 10) }),
        ...(validatedData.creditLimit !== undefined && { creditLimit: parseFloat(validatedData.creditLimit) }),
      },
      include: {
        _count: {
          select: { purchaseOrders: true },
        },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error("Error updating supplier:", error);
    return errorResponse("Failed to update supplier", "SERVER_ERROR", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.SUPPLIER_DELETE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.supplier.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Supplier not found", "NOT_FOUND", 404);
    }

    await db.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Supplier deleted successfully" });
  } catch (error) {
    log.error("Error deleting supplier:", error);
    return errorResponse("Failed to delete supplier", "SERVER_ERROR", 500);
  }
}
