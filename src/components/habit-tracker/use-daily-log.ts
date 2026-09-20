'use client';

// components/habit-tracker/use-daily-log.ts — query log harian
// ['daily-logs', date] + nilai check-in + konsumsi fokus jurnal.
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// queryKey/staleTime/queryFn identik; memo checkInValue (GELOMBANG 1 gating
// tanggal + BUGHUNT-47 47-e #3) dan efek konsumsi trackerFocusNotes
// (VERIFY-48 48-c F7) dipindah apa adanya.

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';

/** Bentuk payload GET /api/daily-logs?date= (null bila belum ada row). */
export type DailyLogPayload = {
  notes: string | null;
  date?: string;
  mood?: number;
  energy?: number;
  sleep?: number;
} | null;

export interface DailyLogApi {
  dailyLogData: DailyLogPayload | undefined;
  /** GELOMBANG 1: nilai check-in (mood/energi/tidur) — null bila belum ada. */
  checkInValue: { mood: number; energy: number; sleep: number } | null;
}

export function useDailyLog(selectedDate: string, loading: boolean): DailyLogApi {
  // VERIFY-48 (48-c F7): konsumsi fokus jurnal dari Beranda — "Tulis jurnal"
  // mendarat di KARTU CATATAN (anchor #daily-notes-card), bukan puncak
  // tracker (kartu catatan adalah seksi terakhir — tanpa ini janji link
  // meleset satu layar penuh). Menunggu loading habit DAN data daily-logs
  // (check-in + catatan ada DI ATAS kartu target — kalau termuat setelah
  // scroll, kartu terdorong turun dan anchor meleset); double-rAF memastikan
  // satu pass layout sebelum scroll halus dihitung.
  const trackerFocusNotes = useAppStore((s) => s.trackerFocusNotes);
  const clearTrackerNotesFocus = useAppStore((s) => s.clearTrackerNotesFocus);

  const { data: dailyLogData } = useQuery<DailyLogPayload>({
    queryKey: ['daily-logs', selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/daily-logs?date=${selectedDate}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!trackerFocusNotes || loading || dailyLogData === undefined) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .getElementById('daily-notes-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    clearTrackerNotesFocus();
  }, [trackerFocusNotes, loading, dailyLogData, clearTrackerNotesFocus]);

  // GELOMBANG 1: nilai check-in (mood/energi/tidur) — digate pada tanggal
  // yang cocok (anti stale keepPreviousData, pola worklog 6-c).
  // BUGHUNT-47 (47-e #3): hari yang hanya punya CATATAN (jurnal) — mood/
  // energi/tidur semua null — tidak lagi dianggap "sudah check-in". Dulunya
  // null dipaksa 3/3/7 → kartu tampil penuh + chip "Tersimpan otomatis"
  // padahal user belum mengisi check-in sama sekali.
  const checkInValue = useMemo(() => {
    if (!dailyLogData) return null;
    const dataDate = dailyLogData.date?.slice(0, 10);
    if (dataDate && dataDate !== selectedDate) return null;
    const hasCheckIn =
      dailyLogData.mood != null || dailyLogData.energy != null || dailyLogData.sleep != null;
    if (!hasCheckIn) return null;
    return {
      mood: dailyLogData.mood ?? 3,
      energy: dailyLogData.energy ?? 3,
      sleep: dailyLogData.sleep ?? 7,
    };
  }, [dailyLogData, selectedDate]);

  return { dailyLogData, checkInValue };
}
