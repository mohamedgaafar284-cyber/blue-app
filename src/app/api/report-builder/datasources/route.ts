import { NextRequest, NextResponse } from "next/server";
import { getDataSourceMetadata, getFilterOperators } from "@/lib/services/report-builder.service";
import { requireVerifiedPermission } from "../../utils/auth";
import { errorResponse } from "../../utils/response";
import { Permission } from "@/lib/auth/types";
import { withRateLimit, rateLimitResponse } from "@/lib/rate-limit-middleware";
import { log } from "@/lib/logger";

/**
 * @openapi
 * /api/report-builder/datasources:
 *   get:
 *     tags: [Report Builder]
 *     summary: Get available data sources and operators for report builder
 */
export async function GET(request: NextRequest) {
  const { result } = await withRateLimit(request, "api");
  const blocked = rateLimitResponse(result);
  if (blocked) return blocked;

  try {
    const rbac = await requireVerifiedPermission(request, Permission.REPORTS_READ);
    if ("error" in rbac) return rbac.error;

    const dataSources = getDataSourceMetadata();
    const filterOperators = getFilterOperators();

    return NextResponse.json({
      data: {
        dataSources,
        filterOperators,
      },
    });
  } catch (error) {
    log.error("Error fetching report builder datasources:", error);
    return errorResponse("Failed to fetch data sources", "SERVER_ERROR", 500);
  }
}
