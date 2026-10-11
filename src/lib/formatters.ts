// ===== Shared Formatters =====
// Centralized formatting utilities to avoid duplication across 20+ page components.

import { formatCurrency as formatCurrencyMulti } from './currency';
import { formatToHijri } from './hijri-utils';
import { getCachedCurrency } from '@/hooks/use-currency';

/**
 * Format a number with dynamic organization currency (backward-compatible).
 * Uses organization's configured currency by default, with custom currency override.
 */
export function formatCurrency(
  amount: number | string | undefined | null,
  ar: boolean,
  currencyOverride?: string
): string {
  const num = Number(amount) || 0;
  const currencyCode = currencyOverride || getCachedCurrency();
  return formatCurrencyMulti(num, currencyCode, ar ? "ar" : "en");
}

/**
 * Format a number with multi-currency support
 * Uses the currency.ts utility for proper symbol and decimal handling
 */
export function formatCurrencyWithCode(
  amount: number | undefined | null,
  currency: string = 'AED',
  language: 'ar' | 'en' = 'ar'
): string {
  return formatCurrencyMulti(amount, currency, language);
}

/**
 * Compact number formatting (e.g. 1500000 → 1.5M)
 */
export function formatK(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toString();
}

/**
 * Format percentage with sign
 */
export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/**
 * Format a date string for display
 */
/**
 * Format a date string with optional Hijri (Islamic) calendar display.
 * In Arabic mode, shows both Gregorian and Hijri dates.
 * In English mode, shows Gregorian only (with optional Hijri in parentheses).
 *
 * @param dateStr - ISO date string or null
 * @param ar - Arabic mode flag
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @param showHijri - If true, appends Hijri date (default: true in Arabic mode)
 */
export function formatDate(
  dateStr: string | undefined | null,
  ar: boolean,
  options?: Intl.DateTimeFormatOptions,
  showHijri?: boolean
): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    const gregorian = date.toLocaleDateString(
      ar ? "ar-AE" : "en-US",
      options ?? { year: "numeric", month: "short", day: "numeric" }
    );

    // Determine if Hijri should be shown
    const shouldShowHijri = showHijri ?? ar; // Default: show in Arabic mode only

    if (shouldShowHijri) {
      try {
        const hijri = formatToHijri(date, { day: 'numeric', month: 'short', year: 'numeric', locale: ar ? 'ar' : 'en' });
        return ar
          ? `${gregorian} (${hijri} هـ)`
          : `${gregorian} (AH ${hijri})`;
      } catch {
        return gregorian;
      }
    }

    return gregorian;
  } catch {
    return dateStr;
  }
}
