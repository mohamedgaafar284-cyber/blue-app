import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, requireVerifiedPermission } from "../../utils/auth";
import { errorResponse } from "../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const updateInventoryItemSchema = z.object({
  name: z.string().optional(),
  projectId: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseFloat(v) || 0 : v)).optional(),
  unit: z.string().optional(),
  price: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseFloat(v) || 0 : v)).optional(),
  location: z.string().optional(),
  minimumLevel: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseFloat(v) || 0 : v)).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVENTORY_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const item = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
      include: {
        project: { select: { id: true, name: true, nameEn: true, number: true } },
      },
    });

    if (!item) {
      return errorResponse("Inventory item not found", "NOT_FOUND", 404);
    }

    const qty = Number(item.quantity);
    const prc = Number(item.price);
    const minLvl = Number(item.minimumLevel);

    return NextResponse.json({
      data: {
        id: item.id,
        name: item.name,
        projectId: item.projectId,
        projectName: item.project?.name || "",
        quantity: qty,
        unit: item.unit,
        price: prc,
        location: item.location,
        minimumLevel: minLvl,
        isLowStock: qty <= minLvl,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    log.error("Error fetching inventory item:", error);
    return errorResponse("Failed to fetch inventory item", "SERVER_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVENTORY_UPDATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Inventory item not found", "NOT_FOUND", 404);
    }

    const rawBody = await request.json();
    const validation = updateInventoryItemSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    const updated = await db.inventoryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.minimumLevel !== undefined && { minimumLevel: data.minimumLevel }),
      },
      include: {
        project: { select: { id: true, name: true, number: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error("Error updating inventory item:", error);
    return errorResponse("Failed to update inventory item", "SERVER_ERROR", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVENTORY_DELETE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.inventoryItem.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Inventory item not found", "NOT_FOUND", 404);
    }

    await db.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Inventory item deleted successfully" });
  } catch (error) {
    log.error("Error deleting inventory item:", error);
    return errorResponse("Failed to delete inventory item", "SERVER_ERROR", 500);
  }
}
