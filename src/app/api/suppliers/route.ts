import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { sanitizeObject, sanitizeEmail } from "@/lib/security/sanitize";
import { supplierSchema } from "@/lib/validations";
import { orgFilter, orgCreate, requireVerifiedPermission } from "../utils/auth";
import { errorResponse } from "../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

/**
 * @openapi
 * /api/suppliers:
 *   get:
 *     tags: [Suppliers]
 *     summary: List suppliers
 *     description: Retrieve all suppliers scoped to the organization with purchase order counts.
 */
export async function GET(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.SUPPLIER_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...orgFilter(user),
    };

    if (category && category !== "all") {
      where.category = category.toUpperCase();
    }

    const suppliers = await db.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: suppliers });
  } catch (error) {
    log.error("Error fetching suppliers:", error);
    return errorResponse("Failed to fetch suppliers", "SERVER_ERROR", 500);
  }
}

/**
 * @openapi
 * /api/suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Create supplier
 */
export async function POST(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.SUPPLIER_CREATE);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const rawBody = await request.json();
    const validation = supplierSchema.safeParse(rawBody);
    if (!validation.success) {
      return errorResponse(validation.error.issues[0].message, "VALIDATION_ERROR", 400);
    }

    const validatedData = sanitizeObject(validation.data);
    const sanitizedEmail = validatedData.email ? sanitizeEmail(validatedData.email) : "";

    const supplier = await db.supplier.create({
      data: {
        name: validatedData.name,
        category: (validatedData.category || "MATERIALS").toUpperCase(),
        email: sanitizedEmail,
        phone: validatedData.phone || "",
        address: validatedData.address || "",
        rating: validatedData.rating ? parseInt(validatedData.rating, 10) : 0,
        creditLimit: validatedData.creditLimit ? parseFloat(validatedData.creditLimit) : 0,
        ...orgCreate(user),
      },
      include: {
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    return NextResponse.json({ data: supplier }, { status: 201 });
  } catch (error) {
    log.error("Error creating supplier:", error);
    return errorResponse("Failed to create supplier", "SERVER_ERROR", 500);
  }
}
