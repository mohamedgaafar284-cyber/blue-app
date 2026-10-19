import { NextRequest, NextResponse } from "next/server";
import { executeReport, formatAsCSV, formatAsPDF, ReportDefinition } from "@/lib/services/report-builder.service";
import { requireVerifiedPermission } from "../../utils/auth";
import { errorResponse } from "../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

/**
 * @openapi
 * /api/report-builder/execute:
 *   post:
 *     tags: [Report Builder]
 *     summary: Execute a report definition and return JSON, CSV or PDF
 */
export async function POST(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.REPORTS_READ);
    if ("error" in rbac) return rbac.error;
    const user = rbac.user;

    const rawBody = await request.json();
    const definition = rawBody.definition as ReportDefinition;

    if (!definition || !definition.dataSource || !definition.fields) {
      return errorResponse("Invalid report definition", "VALIDATION_ERROR", 400);
    }

    const reportResult = await executeReport(definition, user.organizationId || "");
    const format = (definition.format || "json").toLowerCase();

    if (format === "csv") {
      const csv = formatAsCSV(reportResult);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(definition.name || "report")}.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const title = definition.name || "Custom Report";
      const buffer = await formatAsPDF(reportResult, title, "ar", "AED", user.organizationId);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(definition.name || "report")}.pdf"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        result: reportResult,
      },
    });
  } catch (error) {
    log.error("Error executing report:", error);
    return errorResponse("Failed to execute report", "SERVER_ERROR", 500);
  }
}
