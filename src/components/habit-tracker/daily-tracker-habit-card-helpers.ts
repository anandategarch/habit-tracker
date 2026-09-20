// components/habit-tracker/daily-tracker-habit-card-helpers.ts — helper
// MURNI kartu habit: tint warna kategori (legacy nama + HEX) dan turunan
// sel riwayat 7 hari (DayCell).
// Dipecah dari daily-tracker-habit-card.tsx (Task 71-j) — logika identik.

import type { CSSProperties } from 'react';
import type { HabitLog } from './daily-tracker-types';
import { shiftYmdKey, toDateString } from './daily-tracker-helpers';
import { dateFromYMD } from '@/lib/timezone';
import { eeeIdFormatter } from '@/lib/date-utils';
import { isScheduledOn, type HabitSchedule } from '@/lib/habit-schedule';

// Map nama warna opsi kategori → kelas tint yang ada di globals.css
// (jalur LEGACY — dipakai bila color masih berupa nama, mis. 'slate').
export const CAT_TINT: Record<string, string> = {
  emerald: 'cat-emerald',
  orange: 'cat-orange',
  teal: 'cat-teal',
  rose: 'cat-rose',
  fuchsia: 'cat-fuchsia',
  red: 'cat-red',
  slate: 'cat-slate',
};

/**
 * M6-fix: warna kategori dari habit-options adalah HEX ('#14b8a6' dll),
 * bukan nama kelas — CAT_TINT lama tidak pernah cocok sehingga SEMUA kartu
 * jatuh ke cat-slate. HEX apa pun dikonversi menjadi wash 12% via inline
 * style: alpha rendah identik semantik kelas cat-* (oklch / 0.12), jadi
 * aman untuk light & dark mode. Fallback tetap cat-slate untuk nilai yang
 * bukan hex valid maupun nama yang dikenal.
 */
export function hexTintStyle(color: string): CSSProperties | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!m) return null;
  const raw = m[1];
  const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${(0.12 * a).toFixed(3)})` };
}

export interface DayCell {
  ymd: string;
  label: string;
  dayNum: number;
  // 'off' = Task 37: hari di luar jadwal habit (bukan miss, bahan bolong).
  // 'prestart' = BUGHUNT-54 (3-b #5): hari sebelum startDate — habit belum
  // ada, bukan "terlewat" (netral; styling sama seperti 'off').
  state: 'done' | 'miss' | 'relapse' | 'clean' | 'future' | 'off' | 'prestart';
  isSelected: boolean;
}

/**
 * Sel riwayat 7 hari terakhir (selectedDate-6 … selectedDate) untuk wajah
 * belakang kartu. BUGHUNT-54 (3-b #5): batas bawah flip 7 hari = startDate
 * (YMD Jakarta — pola computeStreak/kalender Task 39 #9; null → tidak ada
 * batas). Hari pra-mulai jadi sel NETRAL ('prestart'), bukan 'miss' —
 * habit baru tidak terkesan langsung gagal seminggu.
 */
export function computeLast7Days(opts: {
  monthLogs?: HabitLog[];
  selectedDate: string;
  todayStr: string;
  schedule: HabitSchedule;
  isScheduledDaily: boolean;
  isAvoid: boolean;
  startYmd: string | null;
}): DayCell[] {
  const { monthLogs, selectedDate, todayStr, schedule, isScheduledDaily, isAvoid, startYmd } = opts;
  return Array.from({ length: 7 }, (_, i) => {
    const ymd = shiftYmdKey(selectedDate, i - 6);
    const d = dateFromYMD(ymd);
    const log = monthLogs?.find((l) => toDateString(l.date) === ymd);
    const done = !!log?.completed;
    const off = !isScheduledDaily && !isScheduledOn(schedule, ymd);
    const prestart = !!startYmd && ymd < startYmd;
    let state: DayCell['state'];
    if (ymd > todayStr) state = 'future';
    else if (done) state = isAvoid ? 'relapse' : 'done';
    else if (prestart) state = 'prestart';
    else if (off) state = 'off';
    else if (isAvoid) state = 'clean';
    else state = 'miss';
    return {
      ymd,
      label: eeeIdFormatter(d),
      dayNum: d.getUTCDate(),
      state,
      isSelected: ymd === selectedDate,
    };
  });
}
