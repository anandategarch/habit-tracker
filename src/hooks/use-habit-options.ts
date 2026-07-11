'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

export interface HabitOption {
  id: string;
  type: 'category' | 'priority' | 'difficulty';
  name: string;
  color: string;
  xp: number;
  order: number;
}

const EMPTY: HabitOption[] = [];

// ── Shared in-memory cache (module-level, shared across hook instances) ──
let cachedOptions: HabitOption[] = EMPTY;
let cachedLoading = true;
let cachedError = false;
const listeners = new Set<() => void>();
let fetchInProgress: Promise<void> | null = null;

function notifyAll() {
  listeners.forEach(l => l());
}

function fetchAndSet(): Promise<void> {
  // Deduplicate concurrent fetches
  if (fetchInProgress) return fetchInProgress;

  cachedLoading = true;
  cachedError = false;
  notifyAll();

  fetchInProgress = fetch('/api/habit-options')
    .then((res) => {
      if (res.ok) {
        return res.json().then((data: HabitOption[]) => {
          cachedOptions = data;
          cachedError = false;
        });
      }
      cachedError = true;
    })
    .catch(() => {
      cachedError = true;
    })
    .finally(() => {
      cachedLoading = false;
      fetchInProgress = null;
      notifyAll();
    });

  return fetchInProgress;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useHabitOptions() {
  // A tick counter forces re-render when the external store notifies
  const [, setTick] = useState(0);
  const subscribedRef = useRef(false);

  // Subscribe to external store changes on mount
  useEffect(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const sub = () => setTick(t => t + 1);
    listeners.add(sub);

    // Trigger initial fetch if needed
    if (cachedLoading || cachedError || cachedOptions === EMPTY) {
      fetchAndSet();
    }

    return () => {
      listeners.delete(sub);
      subscribedRef.current = false;
    };
  }, []);

  // Re-fetch when tab becomes visible again (e.g., switching back to app)
  useEffect(() => {
    const onVisible = () => {
      if (cachedError) fetchAndSet();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const options = cachedOptions;
  const loading = cachedLoading;
  const error = cachedError;

  const refetch = useCallback(() => {
    fetchInProgress = null;
    return fetchAndSet();
  }, []);

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