// components/habit-tracker/use-habit-completions.ts — sinkronisasi log habit
// per bulan (cache ±2 bulan) + peta completion/amount hari berjalan.
//
// Task 38 (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// perilaku (guard race RACE-1, invalidasi cache BUG-16, gabungan prev+current
// M4, filter habit lulus Task 36) dan urutan efek identik dengan versi lama.

import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Habit, HabitLog } from './daily-tracker-types';
import {
  toDateString,
  formatJakartaTime,
  prevMonthKey,
  groupBatchLogs,
} from './daily-tracker-helpers';

export interface HabitCompletionsState {
  loading: boolean;
  completionMap: Record<string, boolean>;
  setCompletionMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  completedAtMap: Record<string, string>;
  setCompletedAtMap: Dispatch<SetStateAction<Record<string, string>>>;
  amountValueMap: Record<string, number>;
  setAmountValueMap: Dispatch<SetStateAction<Record<string, number>>>;
  /** Cache log per bulan: month 'yyyy-MM' → habitId → gabungan log prev+current. */
  monthLogsCacheRef: MutableRefObject<Record<string, Record<string, HabitLog[]>>>;
  /** Mirror completionMap (PERF-REACT-1) — dibaca handler toggle tanpa deps. */
  completionMapRef: MutableRefObject<Record<string, boolean>>;
  /** Mirror amountValueMap (PERF-REACT-1, pola sama). */
  amountValueMapRef: MutableRefObject<Record<string, number>>;
  fetchCompletions: (
    habitList: Habit[],
    date: string,
    isCancelled?: () => boolean,
  ) => Promise<void>;
}

export function useHabitCompletions(
  habits: Habit[],
  selectedDate: string,
  refreshKey: number,
): HabitCompletionsState {
  const [loading, setLoading] = useState(true);
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [completedAtMap, setCompletedAtMap] = useState<Record<string, string>>({});
  const [amountValueMap, setAmountValueMap] = useState<Record<string, number>>({});

  // ---- refs ----
  const monthLogsCacheRef = useRef<Record<string, Record<string, HabitLog[]>>>({});
  const cachedMonthRef = useRef('');
  // BUG-16 fix: track the refreshKey that was used to populate the cache.
  // When refreshKey changes (e.g. user hit "refresh" or created a new habit),
  // the cache short-circuit must be bypassed so the new data is fetched.
  const cachedRefreshKeyRef = useRef(0);

  // PERF-REACT-1 fix: mirror `completionMap` into a ref so toggleHabit and
  // handleHabitCheck can read the latest value WITHOUT having `completionMap`
  // in their useCallback deps. Without this, every toggle (which updates
  // completionMap) would create new handler identities, which would defeat
  // React.memo on HabitCard and re-render every card in the grid — even
  // untouched ones. With the ref, handlers stay stable across toggles, so
  // only the actually-toggled card re-renders.
  const completionMapRef = useRef(completionMap);
  useEffect(() => {
    completionMapRef.current = completionMap;
  }, [completionMap]);

  // PERF-REACT-1 (pola sama): mirror amountValueMap agar handleAmountDelta
  // membaca nilai terbaru tanpa memasukkannya ke deps useCallback.
  const amountValueMapRef = useRef(amountValueMap);
  useEffect(() => {
    amountValueMapRef.current = amountValueMap;
  }, [amountValueMap]);

  // ---- fetch completions (month-cached) ----
  // BUGHUNT-ROUND2 RACE-1: `isCancelled` guard (passed by the loading
  // effect) prevents a SLOWER stale fetch (e.g. for the previous date/
  // month after rapid navigation) from overwriting the state of the
  // NEWER fetch that already resolved. Previously only `setLoading` was
  // guarded — the completion maps could be painted with the wrong day's
  // data.
  const fetchCompletions = async (
    habitList: Habit[],
    date: string,
    isCancelled?: () => boolean,
  ) => {
    const month = date.slice(0, 7);

    // BUG-16 fix: include refreshKey in the cache hit check. Without this,
    // changing refreshKey (e.g. after creating a habit) would still hit the
    // stale cache and never re-fetch.
    if (
      cachedMonthRef.current === month &&
      monthLogsCacheRef.current[month] &&
      cachedRefreshKeyRef.current === refreshKey
    ) {
      const cache = monthLogsCacheRef.current[month];
      const map: Record<string, boolean> = {};
      const atMap: Record<string, string> = {};
      const valueMap: Record<string, number> = {};
      habitList
        // Task 36: habit lulus tidak diambil/tidak masuk peta completion.
        .filter((h) => h.isActive && !h.isArchived && !h.graduatedAt)
        .forEach((h) => {
          const logs = cache[h.id] || [];
          const dayLog = logs.find((l) => toDateString(l.date) === date);
          map[h.id] = dayLog?.completed ?? false;
          valueMap[h.id] = dayLog?.value ?? 0;
          if (dayLog?.completedAt) {
            atMap[h.id] = formatJakartaTime(dayLog.completedAt);
          }
        });
      setCompletionMap(map);
      setCompletedAtMap(atMap);
      setAmountValueMap(valueMap);
      return;
    }

    // Task 36: habit lulus keluar dari batch fetch log (tidak dipakai UI).
    const active = habitList.filter((h) => h.isActive && !h.isArchived && !h.graduatedAt);
    const ids = active.map((h) => h.id);

    // M4-fix (streak & flip-card terpotong batas bulan): cache hanya bulan
    // tampil membuat streak putus di hari 1 bulan + flip 7 hari menandai log
    // bulan lalu sebagai miss. Solusi: log bulan SEBELUMNYA ikut diambil
    // (query paralel; keduanya sekali per bulan karena berbasis cache) lalu
    // cache bulan berjalan MENYIMPAN GABUNGAN prev+current — seluruh
    // konsumen (computeStreak, bestStreak, flip 7 hari) membaca cache seperti
    // biasa tanpa perubahan. Catatan batas: streak > ±2 bulan tetap terpotong
    // (hanya 2 bulan yang diambil) — kompromi yang disengaja demi hemat query.
    const prevMonth = prevMonthKey(month);
    let groupedLogs: Record<string, HabitLog[]> = {};
    let groupedPrevLogs: Record<string, HabitLog[]> = {};
    try {
      const [res, prevRes] = await Promise.all([
        fetch(`/api/habits/batch-logs?month=${month}&ids=${ids.join(',')}`),
        fetch(`/api/habits/batch-logs?month=${prevMonth}&ids=${ids.join(',')}`),
      ]);
      if (res.ok) {
        // Normalisasi bentuk payload ({ logs } flat / grouped lama) ada di
        // helper groupBatchLogs (daily-tracker-helpers).
        groupedLogs = groupBatchLogs(await res.json());
      }
      if (prevRes.ok) {
        groupedPrevLogs = groupBatchLogs(await prevRes.json());
      }
    } catch {
      // fall through to empty defaults
    }

    // RACE-1: a newer fetch may have resolved while this one was in flight.
    // Bailing here avoids: (a) painting stale completion maps over the
    // current date's state, (b) flipping cachedMonthRef back to the stale
    // month (which would only cost a redundant re-fetch later, but still).
    if (isCancelled?.()) return;

    const monthCache: Record<string, HabitLog[]> = {};
    const map: Record<string, boolean> = {};
    const atMap: Record<string, string> = {};
    const valueMap: Record<string, number> = {};

    active.forEach((habit) => {
      const logs = groupedLogs[habit.id] || [];
      // M4: gabungan prev+current — prev dulu supaya terurut kronologis.
      monthCache[habit.id] = [...(groupedPrevLogs[habit.id] ?? []), ...logs];
      const dayLog = logs.find((l) => toDateString(l.date) === date);
      map[habit.id] = dayLog?.completed ?? false;
      valueMap[habit.id] = dayLog?.value ?? 0;
      if (dayLog?.completedAt) {
        atMap[habit.id] = formatJakartaTime(dayLog.completedAt);
      }
    });

    monthLogsCacheRef.current[month] = monthCache;
    cachedMonthRef.current = month;
    // BUG-16 fix: record the refreshKey that populated this cache so a future
    // refreshKey change invalidates the cache.
    cachedRefreshKeyRef.current = refreshKey;
    setCompletionMap(map);
    setCompletedAtMap(atMap);
    setAmountValueMap(valueMap);
  };

  // ---- loading effect (verbatim) ----
  useEffect(() => {
    if (habits.length === 0) {
      setLoading(false); // prevent stuck skeleton for users with no habits
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        await fetchCompletions(habits, selectedDate, () => cancelled);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [habits, selectedDate, refreshKey]);

  return {
    loading,
    completionMap,
    setCompletionMap,
    completedAtMap,
    setCompletedAtMap,
    amountValueMap,
    setAmountValueMap,
    monthLogsCacheRef,
    completionMapRef,
    amountValueMapRef,
    fetchCompletions,
  };
}
