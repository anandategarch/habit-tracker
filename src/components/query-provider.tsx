'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
 * The QueryClient is created inside useState so it's stable across re-renders
 * but unique per browser tab (avoids sharing cache between SSR requests).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 30 seconds before refetch triggers.
            // After that, background refetch happens on focus/reconnect.
            staleTime: 30_000,
            // Keep unused data in cache for 5 minutes (quick tab switches).
            gcTime: 5 * 60 * 1000,
            // Refetch on mount IF data is stale (React Query default).
            // Previously set to `false` — caused stale data after tab
            // switches (user saw old data for up to 30s before window
            // focus triggered a refetch). Now uses default behavior:
            // refetch on mount only when staleTime has elapsed.
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
