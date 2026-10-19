import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, requireVerifiedPermission } from "../../utils/auth";
import { errorResponse } from "../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const templateItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  revenueCode: z.string().optional(),
});

const updateRecurringInvoiceSchema = z.object({
  name: z.string().optional(),
  nameAr: z.string().optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  templateItems: z.union([z.string(), z.array(templateItemSchema)]).optional(),
  notes: z.string().optional(),
  notesAr: z.string().optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"]).optional(),
  customDays: z.union([z.string(), z.number()]).transform((v) => (typeof v === "string" ? parseInt(v, 10) || undefined : v)).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVOICE_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const ri = await db.recurringInvoice.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
      include: {
        client: { select: { id: true, name: true, company: true, email: true, phone: true } },
        project: { select: { id: true, name: true, nameEn: true, number: true } },
      },
    });

    if (!ri) {
      return errorResponse("Recurring invoice not found", "NOT_FOUND", 404);
    }

    return NextResponse.json({ data: ri });
  } catch (error) {
    log.error("Error fetching recurring invoice:", error);
    return errorResponse("Failed to fetch recurring invoice", "SERVER_ERROR", 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVOICE_UPDATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.recurringInvoice.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Recurring invoice not found", "NOT_FOUND", 404);
    }

    const rawBody = await request.json();
    const validation = updateRecurringInvoiceSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);

    let templateItemsString: string | undefined = undefined;
    if (data.templateItems !== undefined) {
      templateItemsString =
        typeof data.templateItems === "string"
          ? data.templateItems
          : JSON.stringify(data.templateItems);
    }

    const updated = await db.recurringInvoice.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.projectId !== undefined && { projectId: data.projectId || null }),
        ...(templateItemsString !== undefined && { templateItems: templateItemsString }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.notesAr !== undefined && { notesAr: data.notesAr }),
        ...(data.frequency !== undefined && { frequency: data.frequency }),
        ...(data.customDays !== undefined && { customDays: data.customDays }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, number: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error("Error updating recurring invoice:", error);
    return errorResponse("Failed to update recurring invoice", "SERVER_ERROR", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVOICE_DELETE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { id } = await params;
    const existing = await db.recurringInvoice.findFirst({
      where: { id, deletedAt: null, ...orgFilter(user) },
    });

    if (!existing) {
      return errorResponse("Recurring invoice not found", "NOT_FOUND", 404);
    }

    await db.recurringInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Recurring invoice deleted successfully" });
  } catch (error) {
    log.error("Error deleting recurring invoice:", error);
    return errorResponse("Failed to delete recurring invoice", "SERVER_ERROR", 500);
  }
}
