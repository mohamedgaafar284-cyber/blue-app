"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchCurrencySettings } from "@/hooks/use-currency";

/**
 * React Query Provider — wraps the app with QueryClientProvider.
 * Placed in the root layout so ALL pages have access to React Query.
 */

// Reference to the provider's QueryClient — set on mount
let _queryClientInstance: QueryClient | null = null;

const DEFAULT_OPTIONS = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
};

/**
 * Get the shared QueryClient instance.
 * Safe for use in non-React code (e.g., zustand stores).
 */
export function getQueryClient(): QueryClient {
  if (!_queryClientInstance) {
    if (typeof window === 'undefined') {
      return new QueryClient(DEFAULT_OPTIONS);
    }
    _queryClientInstance = new QueryClient(DEFAULT_OPTIONS);
  }
  return _queryClientInstance;
}

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = _queryClientInstance ?? new QueryClient(DEFAULT_OPTIONS);
    _queryClientInstance = client;
    return client;
  });

  useEffect(() => {
    fetchCurrencySettings().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
