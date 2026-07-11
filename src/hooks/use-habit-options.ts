'use client';

import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';

export interface HabitOption {
  id: string;
  type: 'category' | 'priority' | 'difficulty';
  name: string;
  color: string;
  xp: number;
  order: number;
}

const EMPTY: HabitOption[] = [];

// Simple in-memory cache shared across all hook instances
let cachedOptions: HabitOption[] = EMPTY;
let cachedLoading = true;
const listeners = new Set<() => void>();

function notifyAll() {
  listeners.forEach(l => l());
}

async function fetchAndSet() {
  cachedLoading = true;
  notifyAll();
  try {
    const res = await fetch('/api/habit-options');
    if (res.ok) {
      cachedOptions = await res.json();
    }
  } catch { /* ignore */ }
  cachedLoading = false;
  notifyAll();
}

// Kick off initial fetch once
if (typeof window !== 'undefined' && cachedLoading) {
  fetchAndSet();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): HabitOption[] { return cachedOptions; }
function getLoadingSnapshot(): boolean { return cachedLoading; }

export function useHabitOptions() {
  const options = useSyncExternalStore(subscribe, getSnapshot);
  const loading = useSyncExternalStore(subscribe, getLoadingSnapshot);

  const refetch = useCallback(() => { fetchAndSet(); }, []);

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