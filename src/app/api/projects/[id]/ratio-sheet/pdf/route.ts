import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRatioSheetPDFBuffer } from '@/lib/pdf/ratio-sheet-pdf';
import { log } from '@/lib/logger';
import { handleApiErrorWithLogging as handleApiError } from '@/lib/api-error';
import { requireVerifiedPermission, orgFilter } from '@/app/api/utils/auth';
import { Permission } from '@/lib/auth/types';
import { validateIdParam } from '@/lib/api-validation';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';

// ============================================
// Official Ratios Sheet PDF export
// GET /api/projects/[id]/ratio-sheet/pdf?lang=ar
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowed: _allowed, result } = await withRateLimit(request, 'export');
    const blocked = rateLimitResponse(result);
    if (blocked) return blocked;

    // AUTH CHECK — financial/progress document
    const rbac = await requireVerifiedPermission(request, Permission.PROJECT_READ);
    if ('error' in rbac) return rbac.error;
    const ctx = rbac.user;

    const { id: rawId } = await params;
    const idResult = validateIdParam(rawId);
    if (!idResult.success) return idResult.response;
    const projectId = idResult.id;

    // SECURITY: project must belong to the caller's organization
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null, ...orgFilter(ctx) },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const lang = (searchParams.get('lang') as 'ar' | 'en') || 'ar';

    const pdfBuffer = await generateRatioSheetPDFBuffer(projectId, lang);

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ratio-sheet-${projectId}.pdf"`,
        // Authenticated tenant document — never proxy/CDN cached.
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: unknown) {
    log.error('Error generating ratio sheet PDF:', error);
    return handleApiError(error, 'RatioSheetPDF');
  }
}
