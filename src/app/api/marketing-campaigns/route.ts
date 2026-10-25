import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter } from '@/app/api/utils/auth';
import { log } from '@/lib/logger';
import { Permission } from '@/lib/auth/types';
import { validateRequest, marketingCampaignCreateSchema } from '@/lib/api-validation';
import { parsePaginationParams, buildPaginationMeta, calculateSkip } from '@/app/api/utils/pagination';

export async function GET(request: NextRequest) {
  try {
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { ...orgFilter(ctx) };
    if (status) where.status = status;

    const { page, limit } = parsePaginationParams(searchParams);
    const skip = calculateSkip(page, limit);

    const [campaigns, total] = await Promise.all([
      db.marketingCampaign.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      db.marketingCampaign.count({
        where: Object.keys(where).length > 0 ? where : undefined,
      }),
    ]);

    return NextResponse.json({
      data: campaigns,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
    log.error("Error fetching marketing campaigns:", error);
    return NextResponse.json({ error: "Failed to fetch marketing campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rbac = await requireVerifiedPermission(request, Permission.CLIENT_CREATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const rawBody = await request.json();

    // Zod validation for marketing campaign create fields
    const validation = validateRequest(marketingCampaignCreateSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, errors: validation.errors }, { status: 400 });
    }
    const validatedData = validation.data;
    const { name, type, budget, leads, conversions, startDate, endDate, notes } = validatedData;

    const campaign = await db.marketingCampaign.create({
      data: {
        name,
        type: type || "",
        budget: parseFloat(String(budget)) || 0,
        spent: 0,
        leads: parseInt(String(leads)) || 0,
        conversions: parseInt(String(conversions)) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes || "",
        organizationId: ctx.organizationId || (await db.organization.findFirst())?.id || "",
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    log.error("Error creating marketing campaign:", error);
    return NextResponse.json({ error: "Failed to create marketing campaign" }, { status: 500 });
  }
}
