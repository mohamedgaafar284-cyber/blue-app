import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgCreate , orgFilterNested} from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { log } from '@/lib/logger';
import { z } from 'zod';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { getCompanyCurrency } from '@/lib/currency-server';

// Zod schema for commission creation
const commissionCreateSchema = z.object({
  projectId: z.string().max(100).optional().default(''),
  userId: z.string().min(1, 'User is required').max(100),
  type: z.string().max(50).default('project_referral'),
  amount: z.coerce.number().min(0).max(999999999).optional().default(0),
  percentage: z.coerce.number().min(0).max(100).optional().default(0),
  baseAmount: z.coerce.number().min(0).max(999999999).optional().default(0),
  description: z.string().max(2000).optional().default(''),
  periodStart: z.string().optional().default(''),
  periodEnd: z.string().optional().default(''),
});

export async function GET(request: NextRequest) {
  try {
    const result = await requireVerifiedPermission(request, Permission.COMMISSION_READ);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");

    // Commission doesn't have organizationId directly; filter through project relationship
    const orgWhere = orgFilterNested(ctx, 'project');
    const where: Record<string, unknown> = { ...orgWhere };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const commissions = await db.commission.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, nameEn: true, number: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(commissions);
  } catch (error) {
    log.error("Error fetching commissions:", error);
    return NextResponse.json({ error: "Failed to fetch commissions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { allowed: _allowed, result: _rlResult } = await withRateLimit(request, 'api');
  const blocked = rateLimitResponse(_rlResult);
  if (blocked) return blocked;

  try {
    const result = await requireVerifiedPermission(request, Permission.COMMISSION_CREATE);
    if ('error' in result) return result.error;
    const ctx = result.user;

    const rawBody = await request.json();

    // Zod validation for commission fields
    const validation = commissionCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    const { userId, projectId, type, amount, percentage, baseAmount, description, periodStart, periodEnd } = validation.data;

    const commission = await db.commission.create({
      data: {
        ...orgCreate(ctx),
        userId,
        projectId: projectId || null,
        type: type || "project_referral",
        amount: parseFloat(String(amount)) || 0,
        currency: await getCompanyCurrency(ctx.organizationId),
        percentage: parseFloat(String(percentage)) || 0,
        baseAmount: parseFloat(String(baseAmount)) || 0,
        description: description || "",
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true, nameEn: true, number: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(commission, { status: 201 });
  } catch (error) {
    log.error("Error creating commission:", error);
    return NextResponse.json({ error: "Failed to create commission" }, { status: 500 });
  }
}
