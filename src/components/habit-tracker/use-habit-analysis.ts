'use client';

// components/habit-tracker/use-habit-analysis.ts — dialog Analisis Waktu +
// konsumsi fokus habit global (ONE-CLICK-1).
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// state analysisHabitId, efek reset saat viewMode berganti, efek konsumsi
// focusHabitId (BUGHUNT-47 47-d #2 — menunggu data habit siap), dan cleanup
// unmount (VERIFY-48 48-b). Urutan efek relatif identik.

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useAppStore } from '@/store/app-store';
import type { Habit } from './daily-tracker-types';
import type { TrackerViewMode } from '@/store/app-store';

export interface HabitAnalysisApi {
  analysisHabitId: string | null;
  setAnalysisHabitId: Dispatch<SetStateAction<string | null>>;
  /** Callback stabil (deps kosong) — dipakai grid sebagai onOpenAnalysis. */
  handleOpenAnalysis: (habitId: string) => void;
}

export function useHabitAnalysis(opts: {
  habits: Habit[];
  habitsLoading: boolean;
  viewMode: TrackerViewMode;
}): HabitAnalysisApi {
  const { habits, habitsLoading, viewMode } = opts;

  // ---- time analysis dialog ----
  const [analysisHabitId, setAnalysisHabitId] = useState<string | null>(null);

  // ONE-CLICK-1: consume the global habit focus (set by openHabitFocus anywhere
  // in the app — dashboard rows, calendar, weekly review, …). Opens the
  // TimeAnalysisDialog for the focused habit immediately after the tracker
  // tab mounts, then clears the ephemeral focus (same consume-and-clear
  // pattern as quickAddAction; latest-ref indirection like use-finance-mutations).
  const focusHabitId = useAppStore((s) => s.focusHabitId);
  const clearHabitFocus = useAppStore((s) => s.clearHabitFocus);
  // ONE-CLICK-1: openAnalysis is a stable useCallback (empty deps), so the
  // effect can depend on it directly — no render-phase ref write needed
  // (react-hooks/refs compliant; migrated from the old latest-ref pattern
  // per worklog note when this block was touched).
  const openAnalysis = useCallback((id: string) => setAnalysisHabitId(id), []);
  // CONNECTED-APP: ganti mode tampilan (Hari Ini ↔ Riwayat) menutup dialog
  // analisis yang masih terbuka — dulu analysisHabitId bertahan sehingga
  // kembali ke "Hari Ini" memunculkan ulang dialog secara tak terduga.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset disengaja saat mode tampil berganti (CONNECTED-APP, perilaku asli).
    setAnalysisHabitId(null);
  }, [viewMode]);

  // ONE-CLICK-1: consume the global habit focus (set by openHabitFocus anywhere
  // in the app — dashboard rows, calendar, weekly review, …). Opens the
  // TimeAnalysisDialog for the focused habit immediately after the tracker
  // tab mounts, then clears the ephemeral focus.
  // BUGHUNT-47 (47-d #2): efek ini MENUNGGU data habit siap. Dulunya efek
  // jalan saat mount dengan habits=[] (cache ['habits'] dingin — Beranda
  // tidak pernah mem-fetch-nya) → habit terfokus tidak ketemu → scroll
  // no-op & clearHabitFocus membakar fokus SEBELUM data tiba → klik habit
  // dari Beranda di sesi segar tidak melakukan apa-apa.
  useEffect(() => {
    if (!focusHabitId) return;
    // Data belum siap (pertama kali buka Tracker di sesi segar) — JANGAN
    // konsumsi fokus; efek ini akan jalan ulang saat habits terisi.
    if (habits.length === 0 && habitsLoading) return;
    // CONNECTED-APP: fokus habit dibuka SESUAI KAPABILITAS — habit trackTime
    // → dialog Analisis Waktu; habit lain → gulir ke kartunya di grid
    // (dialog analisis cuma buntu "tidak mencatat waktu" untuk mereka;
    // kartu grid memuat riwayat 7-hari + stepper + tombol analisis).
    const focused = habits.find((h) => h.id === focusHabitId);
    if (focused?.trackTime) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- efek konsumsi fokus memang membuka dialog (setState) dari store eksternal.
      openAnalysis(focusHabitId);
    } else {
      requestAnimationFrame(() => {
        document
          .getElementById(focusHabitId)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    clearHabitFocus();
    // `habits` masuk deps AGAR fokus tertunda sampai data siap — setelah
    // data tiba, fokus dikonsumsi tepat sekali lalu ter-clear.
  }, [focusHabitId, clearHabitFocus, openAnalysis, habits, habitsLoading]);
  // VERIFY-48 (48-b): fokus habit yang masih menunggu (data belum siap)
  // saat user meninggalkan Tracker tidak boleh menunggu di store —
  // kunjungan Tracker berikutnya akan men-scroll/membuka dialog + me-reset
  // selectedDate ke hari ini secara tak terduga. Effect terpisah: cleanup
  // hanya jalan saat unmount; jika fokus sudah terkonsumsi (store null),
  // clear no-op.
  useEffect(
    () => () => {
      if (useAppStore.getState().focusHabitId) clearHabitFocus();
    },
    [clearHabitFocus],
  );

  // ---- handlers ----
  const handleOpenAnalysis = useCallback((habitId: string) => {
    setAnalysisHabitId(habitId);
  }, []);

  return { analysisHabitId, setAnalysisHabitId, handleOpenAnalysis };
}
