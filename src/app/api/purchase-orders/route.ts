import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, orgCreate, requireVerifiedPermission } from "../utils/auth";
import { errorResponse } from "../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const poItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  total: z.number().min(0, "Total must be positive"),
});

const createPurchaseOrderSchema = z.object({
  number: z.string().optional(),
  supplierId: z.string().min(1, "Supplier is required"),
  projectId: z.string().nullable().optional(),
  amount: z.union([z.string(), z.number()]).transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val)),
  items: z.array(poItemSchema).default([]),
});

/**
 * @openapi
 * /api/purchase-orders:
 *   get:
 *     tags: [Purchase Orders]
 *     summary: List purchase orders
 */
export async function GET(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PURCHASE_ORDER_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...orgFilter(user),
    };

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const [orders, allOrders] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true, email: true, phone: true },
          },
          project: {
            select: { id: true, name: true, nameEn: true, number: true },
          },
          items: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.purchaseOrder.findMany({
        where: { deletedAt: null, ...orgFilter(user) },
        select: { amount: true, status: true },
      }),
    ]);

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      number: o.number,
      supplierId: o.supplierId,
      supplierName: o.supplier?.name || "",
      projectId: o.projectId,
      projectName: o.project?.name || "",
      amount: Number(o.amount),
      status: o.status,
      items: o.items.map((item) => ({
        id: item.id,
        purchaseOrderId: item.purchaseOrderId,
        itemName: item.itemName,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));

    const totalOrders = allOrders.length;
    const totalAmount = allOrders.reduce((sum, o) => sum + Number(o.amount), 0);
    const pendingApproval = allOrders.filter((o) => o.status === "SUBMITTED" || o.status === "DRAFT").length;

    return NextResponse.json({
      orders: formattedOrders,
      summary: {
        totalOrders,
        totalAmount,
        pendingApproval,
      },
    });
  } catch (error) {
    log.error("Error fetching purchase orders:", error);
    return errorResponse("Failed to fetch purchase orders", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/purchase-orders:
 *   post:
 *     tags: [Purchase Orders]
 *     summary: Create purchase order
 */
export async function POST(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PURCHASE_ORDER_CREATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const rawBody = await request.json();
    const validation = createPurchaseOrderSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    // Auto-generate PO number if not provided
    const poNumber =
      data.number && data.number.trim().length > 0
        ? data.number
        : `PO-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    // Calculate sum of item totals if items provided
    let calculatedTotal = data.amount;
    if (data.items.length > 0) {
      calculatedTotal = data.items.reduce((sum, item) => sum + item.total, 0);
    }

    const order = await db.purchaseOrder.create({
      data: {
        number: poNumber,
        supplierId: data.supplierId,
        projectId: data.projectId || null,
        amount: calculatedTotal,
        status: "DRAFT",
        createdById: user.userId,
        ...orgCreate(user),
        ...(data.items.length > 0 && {
          items: {
            create: data.items.map((item) => ({
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, number: true } },
        items: true,
      },
    });

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    log.error("Error creating purchase order:", error);
    return errorResponse("Failed to create purchase order", "SERVER_ERROR", 500);
  }
}
