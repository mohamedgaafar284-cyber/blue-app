import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedPermission, orgFilter, orgCreate } from "@/app/api/utils/auth";
import { Permission } from "@/lib/auth/types";
import { validateIdParam } from "@/lib/api-validation";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";
import { DEFAULT_RATIO_ITEMS, MAX_RATIO_ITEMS, isValidPct } from "@/lib/ratio-sheet-defaults";

// ============================================
// Official Ratios Sheet (جدول النسب الرسمية)
// One sheet per project: financing-program metadata +
// per-work-item approved percentages (editable).
// ============================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET /api/projects/[id]/ratio-sheet
 * Returns the sheet + items; auto-provisions a default 16-item sheet on first access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    // RBAC CHECK
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null, ...orgFilter(ctx) },
      select: {
        id: true,
        number: true,
        name: true,
        nameEn: true,
        budget: true,
        contractor: { select: { companyName: true, name: true } },
        client: { select: { name: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Auto-provision the sheet with default items on first access
    let sheet = await db.ratioSheet.findFirst({
      where: { projectId, deletedAt: null, ...orgFilter(ctx) },
    });
    if (!sheet) {
      sheet = await db.ratioSheet.create({
        data: {
          projectId,
          ...orgCreate(ctx),
          contractValue: num(project.budget),
          createdById: ctx.userId,
        },
      });
      await db.projectRatio.createMany({
        data: DEFAULT_RATIO_ITEMS.map((item, idx) => ({
          projectId,
          ...orgCreate(ctx),
          order: idx + 1,
          itemName: item.itemName,
          itemNameEn: item.itemNameEn,
          officialPct: item.officialPct,
        })),
      });
    }

    const items = await db.projectRatio.findMany({
      where: { projectId, deletedAt: null, ...orgFilter(ctx) },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      sheet: {
        id: sheet.id,
        programName: sheet.programName,
        fileNumber: sheet.fileNumber,
        bankName: sheet.bankName,
        contractValue: num(sheet.contractValue) || num(project.budget),
        maintenancePct: num(sheet.maintenancePct, 10),
        notes: sheet.notes,
      },
      project: {
        number: project.number,
        name: project.name,
        nameEn: project.nameEn,
        clientName: project.client?.name || "",
        contractorName: project.contractor?.companyName || project.contractor?.name || "",
      },
      items: items.map((it) => ({
        id: it.id,
        order: it.order,
        itemName: it.itemName,
        itemNameEn: it.itemNameEn,
        officialPct: num(it.officialPct),
        executedPct: num(it.executedPct),
        notes: it.notes,
      })),
    });
  } catch (error) {
    log.error("Error fetching ratio sheet:", error);
    return NextResponse.json({ error: "Failed to fetch ratio sheet" }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]/ratio-sheet
 * Save-all: sheet settings + the full item list (spreadsheet-style editing).
 * Body: { programName?, fileNumber?, bankName?, contractValue?, maintenancePct?, notes?,
 *         items: [{ id?, order, itemName, itemNameEn, officialPct, executedPct, notes }] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'api');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    // RBAC CHECK — sheet is engineering progress data (ADMIN/MANAGER/PROJECT_MANAGER)
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_UPDATE);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null, ...orgFilter(ctx) },
      select: { id: true, budget: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (body.items.length > MAX_RATIO_ITEMS) {
      return NextResponse.json({ error: `Maximum ${MAX_RATIO_ITEMS} items allowed` }, { status: 400 });
    }

    // Validate items
    for (const it of body.items) {
      if (!isValidPct(it.officialPct) || !isValidPct(it.executedPct)) {
        return NextResponse.json(
          { error: "Percentages must be numbers between 0 and 100" },
          { status: 400 }
        );
      }
      if (num(it.executedPct) > num(it.officialPct) + 0.001) {
        return NextResponse.json(
          { error: "Executed percentage cannot exceed the official percentage" },
          { status: 400 }
        );
      }
    }

    // Sheet upsert
    const sheet = await db.ratioSheet.upsert({
      where: { projectId },
      create: {
        projectId,
        ...orgCreate(ctx),
        programName: String(body.programName || "").trim(),
        fileNumber: String(body.fileNumber || "").trim(),
        bankName: String(body.bankName || "").trim(),
        contractValue: num(body.contractValue) || num(project.budget),
        maintenancePct: Math.min(100, Math.max(0, num(body.maintenancePct, 10))),
        notes: String(body.notes || "").trim(),
        createdById: ctx.userId,
      },
      update: {
        programName: String(body.programName || "").trim(),
        fileNumber: String(body.fileNumber || "").trim(),
        bankName: String(body.bankName || "").trim(),
        contractValue: num(body.contractValue) || num(project.budget),
        maintenancePct: Math.min(100, Math.max(0, num(body.maintenancePct, 10))),
        notes: String(body.notes || "").trim(),
      },
    });

    // Save-all items inside a transaction
    const incomingIds: string[] = [];
    await db.$transaction(async (tx) => {
      let order = 0;
      for (const it of body.items) {
        order += 1;
        const rowData = {
          order: Number(it.order) || order,
          itemName: String(it.itemName || "").trim(),
          itemNameEn: String(it.itemNameEn || "").trim(),
          officialPct: round2(num(it.officialPct)),
          executedPct: round2(num(it.executedPct)),
          notes: String(it.notes || "").trim(),
        };
        if (it.id) {
          const existing = await tx.projectRatio.findFirst({
            where: { id: String(it.id), projectId, deletedAt: null, ...orgFilter(ctx) },
            select: { id: true },
          });
          if (existing) {
            await tx.projectRatio.update({ where: { id: existing.id }, data: rowData });
            incomingIds.push(existing.id);
            continue;
          }
        }
        const created = await tx.projectRatio.create({
          data: { projectId, ...orgCreate(ctx), ...rowData },
        });
        incomingIds.push(created.id);
      }

      // Soft-delete rows removed from the sheet
      const keep = new Set(incomingIds);
      const current = await tx.projectRatio.findMany({
        where: { projectId, deletedAt: null, ...orgFilter(ctx) },
        select: { id: true },
      });
      const toRemove = current.filter((r) => !keep.has(r.id)).map((r) => r.id);
      if (toRemove.length > 0) {
        await tx.projectRatio.updateMany({
          where: { id: { in: toRemove } },
          data: { deletedAt: new Date() },
        });
      }
    });

    const items = await db.projectRatio.findMany({
      where: { projectId, deletedAt: null, ...orgFilter(ctx) },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      sheet: {
        id: sheet.id,
        programName: sheet.programName,
        fileNumber: sheet.fileNumber,
        bankName: sheet.bankName,
        contractValue: num(sheet.contractValue),
        maintenancePct: num(sheet.maintenancePct, 10),
        notes: sheet.notes,
      },
      items: items.map((it) => ({
        id: it.id,
        order: it.order,
        itemName: it.itemName,
        itemNameEn: it.itemNameEn,
        officialPct: num(it.officialPct),
        executedPct: num(it.executedPct),
        notes: it.notes,
      })),
    });
  } catch (error) {
    log.error("Error saving ratio sheet:", error);
    return NextResponse.json({ error: "Failed to save ratio sheet" }, { status: 500 });
  }
}
