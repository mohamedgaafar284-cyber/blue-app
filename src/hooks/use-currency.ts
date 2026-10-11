"use client";

/**
 * useCurrency Hook
 * خطاف العملة
 * 
 * Client-side hook for currency formatting and conversion.
 * Fetches settings from API on mount and caches in memory.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  formatCurrency as formatCurrencyUtil,
  convertCurrency as convertCurrencyUtil,
  SUPPORTED_CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_EXCHANGE_RATES,
} from '@/lib/currency';

interface CurrencySettings {
  defaultCurrency: string;
  exchangeRates: Record<string, number>;
}

// In-memory cache
let cachedSettings: CurrencySettings | null = null;
let settingsPromise: Promise<CurrencySettings> | null = null;

export function getCachedCurrency(): string {
  return cachedSettings?.defaultCurrency || 'AED';
}

export function setCachedCurrency(currency: string): void {
  if (cachedSettings) {
    cachedSettings.defaultCurrency = currency;
  } else {
    cachedSettings = {
      defaultCurrency: currency,
      exchangeRates: DEFAULT_EXCHANGE_RATES,
    };
  }
}

export async function fetchCurrencySettings(): Promise<CurrencySettings> {
  if (cachedSettings) return cachedSettings;
  if (settingsPromise) return settingsPromise;

  settingsPromise = (async () => {
    try {
      const res = await fetch('/api/settings/currency');
      if (res.ok) {
        const data = await res.json();
        const result: CurrencySettings = {
          defaultCurrency: data.data?.defaultCurrency || 'AED',
          exchangeRates: data.data?.exchangeRates || DEFAULT_EXCHANGE_RATES,
        };
        cachedSettings = result;
        return result;
      }
    } catch { /* fallback to defaults */ }

    const fallback: CurrencySettings = {
      defaultCurrency: 'AED',
      exchangeRates: DEFAULT_EXCHANGE_RATES,
    };
    cachedSettings = fallback;
    return fallback;
  })();

  return settingsPromise;
}

export function useCurrency() {
  const [settings, setSettings] = useState<CurrencySettings>({
    defaultCurrency: cachedSettings?.defaultCurrency || 'AED',
    exchangeRates: cachedSettings?.exchangeRates || DEFAULT_EXCHANGE_RATES,
  });
  const [loaded, setLoaded] = useState(!!cachedSettings);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    
    let cancelled = false;
    
    fetchCurrencySettings().then((s) => {
      if (cancelled || !mountedRef.current) return;
      setSettings(s);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const formatCurrency = useCallback(
    (amount: number | undefined | null, currency?: string, language?: 'ar' | 'en') => {
      return formatCurrencyUtil(amount, currency || settings.defaultCurrency, language || 'ar');
    },
    [settings.defaultCurrency]
  );

  const convertAmount = useCallback(
    (amount: number, from: string, to?: string) => {
      return convertCurrencyUtil(amount, from, to || settings.defaultCurrency, settings.exchangeRates);
    },
    [settings.defaultCurrency, settings.exchangeRates]
  );

  const supportedCurrencies = useMemo(() => {
    return Object.values(SUPPORTED_CURRENCIES);
  }, []);

  return {
    formatCurrency,
    convertCurrency: convertAmount,
    defaultCurrency: settings.defaultCurrency,
    exchangeRates: settings.exchangeRates,
    supportedCurrencies,
    currencyCodes: CURRENCY_CODES,
    loaded,
  };
}
