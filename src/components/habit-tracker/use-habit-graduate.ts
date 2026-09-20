'use client';

// components/habit-tracker/use-habit-graduate.ts — wisudakan habit
// (Task 36 "Target Lulus"): optimistik cache ['habits'] + PUT + confetti
// rainbow + rollback.
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// urutan invalidasi (habits → dashboard → dashboard/all → triggerRefresh)
// dan rollback identik.

import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jakartaNowIso } from '@/lib/timezone';
import { burstFromElement } from '@/lib/confetti';
import type { Habit } from './daily-tracker-types';

export function useHabitGraduate(
  queryClient: QueryClient,
  triggerRefresh: () => void,
): { handleGraduate: (habit: Habit, el: HTMLElement | null) => Promise<void> } {
  // ── Task 36: wisudakan habit (Target Lulus) ─────────────────────────
  // Dipanggil kartu habit saat completedLogCount >= targetDays. Optimistik:
  // graduatedAt diisi di cache ['habits'] → kartu langsung keluar dari grid
  // (filter activeHabits) tanpa menunggu round-trip. Confetti rainbow besar —
  // momen "menyelesaikan sesuatu" adalah perayaan utama aplikasi ini.
  const handleGraduate = useCallback(
    async (habit: Habit, el: HTMLElement | null) => {
      const iso = jakartaNowIso();
      queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
        prev.map((h) => (h.id === habit.id ? { ...h, graduatedAt: iso } : h)),
      );
      try {
        const res = await fetch(`/api/habits/${habit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graduatedAt: iso }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        burstFromElement(el, { count: 80, spread: 120, rainbow: true });
        toast.success(
          `🎓 ${habit.name} resmi lulus! Target ${habit.targetDays ?? '?'} hari tuntas — kerja bagus!`,
        );
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'all'] });
        triggerRefresh();
      } catch {
        // Rollback optimistik — pulihkan cache lalu refetch jujur.
        queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
          prev.map((h) => (h.id === habit.id ? { ...h, graduatedAt: null } : h)),
        );
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        toast.error('Gagal menyimpan kelulusan — coba lagi');
      }
    },
    [queryClient, triggerRefresh],
  );

  return { handleGraduate };
}
