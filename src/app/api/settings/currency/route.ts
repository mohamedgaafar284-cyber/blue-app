import { requireVerifiedPermission, orgFilter } from '@/app/api/utils/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Permission } from '@/lib/auth/types';
import { handleApiErrorWithLogging as handleApiError } from '@/lib/api-error';
import { withRateLimit, rateLimitResponse } from '@/lib/rate-limit-middleware';
import { cachedQuery, CACHE_TTL, buildCacheKey } from '@/lib/cache/query-cache';
import { DEFAULT_EXCHANGE_RATES, SUPPORTED_CURRENCIES } from '@/lib/currency';

/**
 * GET /api/settings/currency
 * Returns the organization default currency and current exchange rates.
 */
export async function GET(request: NextRequest) {
  const { result: rlResult } = await withRateLimit(request, 'api');
  const rlBlocked = rateLimitResponse(rlResult);
  if (rlBlocked) return rlBlocked;

  const rbac = await requireVerifiedPermission(request, Permission.SETTINGS_READ);
  if ('error' in rbac) return rbac.error;

  try {
    const orgId = rbac.user.organizationId || 'global';
    const cacheKey = buildCacheKey('settings', 'currency', orgId);

    const result = await cachedQuery(cacheKey, async () => {
      const companySettings = await db.companySettings.findFirst({
        where: { ...orgFilter(rbac.user) },
        select: { currency: true },
      });

      const defaultCurrency = companySettings?.currency || 'AED';

      return {
        defaultCurrency,
        exchangeRates: DEFAULT_EXCHANGE_RATES,
        supportedCurrencies: Object.values(SUPPORTED_CURRENCIES),
      };
    }, CACHE_TTL.SETTINGS);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    return handleApiError(error, 'Settings Currency GET');
  }
}
