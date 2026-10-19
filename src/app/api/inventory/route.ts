import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, orgCreate, requireVerifiedPermission } from "../utils/auth";
import { errorResponse } from "../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const createInventoryItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  projectId: z.string().nullable().optional(),
  quantity: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseFloat(v) || 0 : v)),
  unit: z.string().default("pcs"),
  price: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseFloat(v) || 0 : v)),
  location: z.string().optional().default(""),
  minimumLevel: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseFloat(v) || 0 : v)).default(0),
});

/**
 * @openapi
 * /api/inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: List inventory items and summary
 */
export async function GET(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVENTORY_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...orgFilter(user),
    };

    if (projectId && projectId !== "none" && projectId !== "all") {
      where.projectId = projectId;
    }

    const items = await db.inventoryItem.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedItems = items.map((i) => {
      const qty = Number(i.quantity);
      const prc = Number(i.price);
      const minLvl = Number(i.minimumLevel);
      return {
        id: i.id,
        name: i.name,
        projectId: i.projectId,
        projectName: i.project?.name || "",
        quantity: qty,
        unit: i.unit,
        price: prc,
        location: i.location,
        minimumLevel: minLvl,
        isLowStock: qty <= minLvl,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      };
    });

    const totalItems = formattedItems.length;
    const lowStockCount = formattedItems.filter((i) => i.isLowStock).length;
    const totalValue = formattedItems.reduce((sum, i) => sum + i.quantity * i.price, 0);

    return NextResponse.json({
      items: formattedItems,
      summary: {
        totalItems,
        lowStockCount,
        totalValue,
      },
    });
  } catch (error) {
    log.error("Error fetching inventory items:", error);
    return errorResponse("Failed to fetch inventory items", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/inventory:
 *   post:
 *     tags: [Inventory]
 *     summary: Create inventory item
 */
export async function POST(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVENTORY_CREATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const rawBody = await request.json();
    const validation = createInventoryItemSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    const item = await db.inventoryItem.create({
      data: {
        name: data.name,
        projectId: data.projectId || null,
        quantity: data.quantity,
        unit: data.unit || "pcs",
        price: data.price,
        location: data.location || "",
        minimumLevel: data.minimumLevel,
        ...orgCreate(user),
      },
      include: {
        project: { select: { id: true, name: true, number: true } },
      },
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    log.error("Error creating inventory item:", error);
    return errorResponse("Failed to create inventory item", "SERVER_ERROR", 500);
  }
}
