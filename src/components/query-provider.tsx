'use client';

import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * TanStack Query provider wrapper.
 *
 * Provides a single QueryClient instance per browser session, shared across
 * all client components. This enables:
 * - Automatic request deduplication (multiple components fetching the same
 *   endpoint share one network request)
 * - Background refetching (data stays fresh without manual refresh)
 * - Optimistic updates via useMutation
 * - Smart caching (avoid re-fetching data that was just loaded)
 *
 * PERF-FIX (Tier 1): Tuned for mobile performance:
 * - staleTime 30s → 60s (less aggressive refetch on tab focus)
 * - gcTime 5min → 2min (faster GC, less memory retention on mobile)
 * - keepPreviousData: true (show old data while fetching new — no blank
 *   loading state on tab switch, perceived performance improves)
 * - refetchOnWindowFocus: true (keep data fresh when user returns to app)
 * - retry: 1 (one retry for network blips, don't hammer on failure)
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 60 seconds (was 30s — less
            // aggressive refetch reduces mobile data usage + battery drain).
            staleTime: 60_000,
            // Keep unused data in cache for 2 minutes (was 5 min — faster GC
            // prevents memory bloat on mobile devices with limited RAM).
            gcTime: 2 * 60 * 1000,
            // Show previous data while fetching new data (no blank loading
            // state on tab switch — perceived performance improves dramatically).
            placeholderData: keepPreviousData,
            // Refetch on mount IF data is stale (React Query default).
            refetchOnMount: true,
            // Refetch when window regains focus (user returns to tab).
            refetchOnWindowFocus: true,
            // Retry failed requests once (network blips).
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default QueryProvider;
