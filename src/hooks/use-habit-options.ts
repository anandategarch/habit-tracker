'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface HabitOption {
  id: string;
  type: 'category' | 'priority' | 'difficulty';
  name: string;
  color: string;
  xp: number;
  order: number;
}

// ── Hook (TanStack Query powered) ─────────────────────────────────────────
// Previously used a manual in-memory cache + listener pattern (reimplemented
// TanStack Query by hand). Now delegates to useQuery for automatic dedup,
// background refetch, and cache sharing across components.

export function useHabitOptions() {
  const queryClient = useQueryClient();

  const { data: options = [], isLoading: loading, isError: error } = useQuery<HabitOption[]>({
    queryKey: ['habit-options'],
    queryFn: async () => {
      const res = await fetch('/api/habit-options');
      if (!res.ok) throw new Error('Failed to fetch habit options');
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const refetch = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ['habit-options'] });
  }, [queryClient]);

  const categories = useMemo(() =>
    options.filter(o => o.type === 'category').sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [options]
  );

  const priorities = useMemo(() =>
    options.filter(o => o.type === 'priority').sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [options]
  );

  const difficulties = useMemo(() =>
    options.filter(o => o.type === 'difficulty').sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [options]
  );

  const categoryMap = useMemo(() => {
    const m: Record<string, HabitOption> = {};
    categories.forEach(c => { m[c.name] = c; });
    return m;
  }, [categories]);

  const priorityMap = useMemo(() => {
    const m: Record<string, HabitOption> = {};
    priorities.forEach(p => { m[p.name] = p; });
    return m;
  }, [priorities]);

  const difficultyMap = useMemo(() => {
    const m: Record<string, HabitOption> = {};
    difficulties.forEach(d => { m[d.name] = d; });
    return m;
  }, [difficulties]);

  const xpMap = useMemo(() => {
    const m: Record<string, number> = {};
    difficulties.forEach(d => { m[d.name] = d.xp; });
    return m;
  }, [difficulties]);

  return {
    options,
    loading,
    error,
    categories,
    priorities,
    difficulties,
    categoryMap,
    priorityMap,
    difficultyMap,
    xpMap,
    refetch,
  };
}
