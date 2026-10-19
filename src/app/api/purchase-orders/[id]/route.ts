import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, requireVerifiedPermission } from "../../utils/auth";
import { errorResponse } from "../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const poItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  total: z.number().min(0, "Total must be positive"),
});

const updatePurchaseOrderSchema = z.object({
  number: z.string().optional(),
  supplierId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  amount: z.union([z.string(), z.number()]).transform((val) => (typeof val === "string" ? parseFloat(val) || 0 : val)).optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "RECEIVED", "CANCELLED"]).optional(),
  items: z.array(poItemSchema).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PURCHASE_ORDER_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const order = await db.purchaseOrder.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
      include: {
        supplier: { select: { id: true, name: true, email: true, phone: true } },
        project: { select: { id: true, name: true, nameEn: true, number: true } },
        items: true,
      },
    });

    if (!order) {
      return errorResponse("Purchase order not found", "NOT_FOUND", 404);
    }

    return NextResponse.json({
      data: {
        id: order.id,
        number: order.number,
        supplierId: order.supplierId,
        supplierName: order.supplier?.name || "",
        projectId: order.projectId,
        projectName: order.project?.name || "",
        amount: Number(order.amount),
        status: order.status,
        items: order.items.map((i) => ({
          id: i.id,
          itemName: i.itemName,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    log.error("Error fetching purchase order:", error);
    return errorResponse("Failed to fetch purchase order", "SERVER_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PURCHASE_ORDER_UPDATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.purchaseOrder.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
      include: { items: true },
    });

    if (!existing) {
      return errorResponse("Purchase order not found", "NOT_FOUND", 404);
    }

    const rawBody = await request.json();
    const validation = updatePurchaseOrderSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    const updated = await db.$transaction(async (tx) => {
      let newAmount = data.amount;

      if (data.items !== undefined) {
        // Recreate line items
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        if (data.items.length > 0) {
          await tx.purchaseOrderItem.createMany({
            data: data.items.map((item) => ({
              purchaseOrderId: id,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          });
          newAmount = data.items.reduce((sum, item) => sum + item.total, 0);
        }
      }

      return await tx.purchaseOrder.update({
        where: { id },
        data: {
          ...(data.number !== undefined && { number: data.number }),
          ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
          ...(data.projectId !== undefined && { projectId: data.projectId }),
          ...(data.status !== undefined && { status: data.status }),
          ...(newAmount !== undefined && { amount: newAmount }),
        },
        include: {
          supplier: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, number: true } },
          items: true,
        },
      });
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error("Error updating purchase order:", error);
    return errorResponse("Failed to update purchase order", "SERVER_ERROR", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.PURCHASE_ORDER_DELETE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.purchaseOrder.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Purchase order not found", "NOT_FOUND", 404);
    }

    await db.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Purchase order deleted successfully" });
  } catch (error) {
    log.error("Error deleting purchase order:", error);
    return errorResponse("Failed to delete purchase order", "SERVER_ERROR", 500);
  }
}
