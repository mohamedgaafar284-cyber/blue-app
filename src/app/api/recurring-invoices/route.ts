import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject } from "@/lib/security/sanitize";
import { z } from "zod";
import { orgFilter, orgCreate, requireVerifiedPermission } from "../utils/auth";
import { errorResponse } from "../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

const templateItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(0.01, "Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be positive"),
  revenueCode: z.string().optional(),
});

const createRecurringInvoiceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  nameAr: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  projectId: z.string().optional(),
  templateItems: z.array(templateItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  notesAr: z.string().optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "CUSTOM"]).default("MONTHLY"),
  customDays: z.number().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

/**
 * @openapi
 * /api/recurring-invoices:
 *   get:
 *     tags: [Recurring Invoices]
 *     summary: List recurring invoices
 */
export async function GET(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVOICE_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const recurringInvoices = await db.recurringInvoice.findMany({
      where: {
        deletedAt: null,
        ...orgFilter(user),
      },
      include: {
        client: {
          select: { id: true, name: true, company: true, email: true, phone: true },
        },
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = recurringInvoices.map((ri) => {
      let items: Array<{ description: string; quantity: number; unitPrice: number }> = [];
      try {
        items = JSON.parse(ri.templateItems);
      } catch {
        items = [];
      }

      const subtotal = items.reduce((s, item) => s + (item.quantity || 0) * (item.unitPrice || 0), 0);
      const tax = subtotal * 0.05; // 5% UAE VAT
      const total = subtotal + tax;

      return {
        id: ri.id,
        name: ri.name,
        nameAr: ri.nameAr,
        clientId: ri.clientId,
        clientName: ri.client?.name || "",
        projectId: ri.projectId,
        projectName: ri.project?.name || "",
        templateItems: ri.templateItems,
        notes: ri.notes,
        notesAr: ri.notesAr,
        frequency: ri.frequency,
        customDays: ri.customDays,
        startDate: ri.startDate.toISOString(),
        endDate: ri.endDate ? ri.endDate.toISOString() : null,
        nextRunDate: ri.nextRunDate ? ri.nextRunDate.toISOString() : null,
        lastRunDate: ri.lastRunDate ? ri.lastRunDate.toISOString() : null,
        isActive: ri.isActive,
        _computed: {
          subtotal,
          tax,
          total,
          itemsCount: items.length,
        },
        createdAt: ri.createdAt.toISOString(),
        updatedAt: ri.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (error) {
    log.error("Error fetching recurring invoices:", error);
    return errorResponse("Failed to fetch recurring invoices", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/recurring-invoices:
 *   post:
 *     tags: [Recurring Invoices]
 *     summary: Create recurring invoice template
 */
export async function POST(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.INVOICE_CREATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const rawBody = await request.json();
    const validation = createRecurringInvoiceSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const data = sanitizeObject(validation.data);
    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;

    const recurringInvoice = await db.recurringInvoice.create({
      data: {
        name: data.name,
        nameAr: data.nameAr || null,
        clientId: data.clientId,
        projectId: data.projectId || null,
        templateItems: JSON.stringify(data.templateItems),
        notes: data.notes || null,
        notesAr: data.notesAr || null,
        frequency: data.frequency,
        customDays: data.customDays || null,
        startDate,
        endDate,
        nextRunDate: startDate,
        isActive: true,
        createdById: user.userId,
        ...orgCreate(user),
      },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, number: true } },
      },
    });

    return NextResponse.json({ data: recurringInvoice }, { status: 201 });
  } catch (error) {
    log.error("Error creating recurring invoice:", error);
    return errorResponse("Failed to create recurring invoice", "SERVER_ERROR", 500);
  }
}
