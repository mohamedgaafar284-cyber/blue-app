import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgCreate , orgFilterNested} from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { z } from 'zod';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { parsePaginationParams, buildPaginationMeta, calculateSkip, isPaginationRequested } from '../utils/pagination';

// Zod schema for transmittal item
const transmittalItemSchema = z.object({
  documentNumber: z.string().max(100).optional().default(''),
  title: z.string().max(300).optional().default(''),
  revision: z.string().max(50).optional().default(''),
  copies: z.coerce.number().min(0).max(9999).optional().default(1),
  purpose: z.string().max(100).optional().default('review'),
});

// Zod schema for transmittal creation
const transmittalCreateSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required').max(100),
  subject: z.string().min(1, 'Subject is required').max(300),
  fromId: z.string().min(1, 'From ID is required').max(100),
  from: z.string().max(200).optional().default(''),
  to: z.string().max(200).optional().default(''),
  toName: z.string().max(200).optional().default(''),
  toEmail: z.string().max(200).optional().default(''),
  toCompany: z.string().max(200).optional().default(''),
  toPhone: z.string().max(50).optional().default(''),
  deliveryMethod: z.enum(['EMAIL', 'HAND', 'COURIER', 'FAX']).default('EMAIL'),
  status: z.string().max(50).default('SENT'),
  items: z.array(transmittalItemSchema).optional().default([]),
});

export async function GET(request: NextRequest) {
  const { allowed: _allowed, result: rlResult } = await withRateLimit(request, 'api');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  try {
    // RBAC CHECK - requires DOCUMENT_READ permission
    const rbac = await requireVerifiedPermission(request, Permission.DOCUMENT_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    // Transmittal doesn't have organizationId directly; filter through project relationship
    const orgWhere = orgFilterNested(ctx, 'project');
    const where: Record<string, unknown> = { deletedAt: null, ...orgWhere };
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const usePagination = isPaginationRequested(searchParams);
    const { page, limit } = parsePaginationParams(searchParams);

    if (usePagination) {
      const [transmittals, total] = await Promise.all([
        db.transmittal.findMany({
          where,
          include: {
            project: {
              select: { id: true, name: true, nameEn: true, number: true },
            },
            from: {
              select: { id: true, name: true, email: true },
            },
            items: true,
          },
          orderBy: { createdAt: "desc" },
          skip: calculateSkip(page, limit),
          take: limit,
        }),
        db.transmittal.count({ where }),
      ]);

      return NextResponse.json({ data: transmittals, pagination: buildPaginationMeta(page, limit, total) });
    }

    const transmittals = await db.transmittal.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
        from: {
          select: { id: true, name: true, email: true },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transmittals);
  } catch (error) {
    log.error("Error fetching transmittals:", error);
    return NextResponse.json({ error: "Failed to fetch transmittals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    // RBAC CHECK - requires DOCUMENT_CREATE permission
    const rbac = await requireVerifiedPermission(request, Permission.DOCUMENT_CREATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const rawBody = await request.json();

    // Zod validation for transmittal fields
    const validation = transmittalCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }
    const {
      projectId,
      subject,
      fromId,
      toName,
      toEmail,
      toCompany,
      toPhone,
      deliveryMethod,
      status,
      items: validatedItems,
    } = validation.data;

    // Generate transmittal number
    const count = await db.transmittal.count();
    const number = `TR-${String(count + 1).padStart(4, "0")}`;

    // Prepare items for creation
    const itemsData = (validatedItems || []).map(
      (item) => ({
        documentNumber: item.documentNumber || "",
        title: item.title || "",
        revision: item.revision || "",
        copies: item.copies || 1,
        purpose: item.purpose || "REVIEW",
      })
    );

    const transmittal = await db.transmittal.create({
      data: {
        number,
        projectId,
        subject: subject || "",
        fromId,
        toName: toName || "",
        toEmail: toEmail || "",
        toCompany: toCompany || "",
        toPhone: toPhone || "",
        deliveryMethod: (deliveryMethod || "EMAIL"),
        status: status || "SENT",
        ...orgCreate(ctx),
        items: {
          create: itemsData,
        },
      },
      include: {
        project: {
          select: { id: true, name: true, nameEn: true, number: true },
        },
        from: {
          select: { id: true, name: true, email: true },
        },
        items: true,
      },
    });

    return NextResponse.json(transmittal, { status: 201 });
  } catch (error) {
    log.error("Error creating transmittal:", error);
    return NextResponse.json({ error: "Failed to create transmittal" }, { status: 500 });
  }
}
