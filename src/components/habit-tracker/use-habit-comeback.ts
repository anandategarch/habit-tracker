// components/habit-tracker/use-habit-comeback.ts — memo Banner Kembali
// (Task 36, anti-nunda): syarat, hitungan gap, dan kandidat habit ringan.
//
// Task 71-c (split god file): DIEKSTRAKSI dari daily-tracker.tsx —
// monthLogsCache kini dikirim sebagai NILAI (bukan ref) dari body komponen
// (baca ref.current dalam callback useMemo memicu react-hooks/refs yang tak
// bisa di-disable). Nilai bulan todayStr identik dengan bulan selectedDate
// di jalur aktif: memo mengembalikan null lebih dulu saat selectedDate !==
// todayStr, jadi cache hanya terpakai saat keduanya sama bulannya.
// State "disembunyikan per hari" tetap di modul ComebackBanner.

import { useMemo } from 'react';
import { dateFromYMD } from '@/lib/timezone';
import { toDateString, jakartaYmdOf } from './daily-tracker-helpers';
import type { Habit, HabitLog } from './daily-tracker-types';

export interface ComebackInfo {
  gapDays: number;
  pick: Habit;
}

export function useHabitComeback(opts: {
  selectedDate: string;
  todayStr: string;
  habits: Habit[];
  activeHabits: Habit[];
  scheduledHabits: Habit[];
  trackableHabits: Habit[];
  completionMap: Record<string, boolean>;
  /** Nilai cache log bulan berjalan — dibaca di body komponen pemanggil. */
  monthLogsCache: Record<string, HabitLog[]> | undefined;
}): ComebackInfo | null {
  const {
    selectedDate,
    todayStr,
    habits,
    activeHabits,
    scheduledHabits,
    trackableHabits,
    completionMap,
    monthLogsCache,
  } = opts;

  // ── Task 36: Banner Kembali (anti-nunda) ─────────────────────────────
  // Tipe "sering nunda" paling rapuh justru di hari KEMBALI: rasa bersalah
  // membuat menghindari aplikasi. Banner menyambut TANPA menghukum +
  // menawarkan SATU habit paling ringan untuk dicentang sekarang (tombol
  // 1-ketuk, confetti dari tombol). Syarat: sedang melihat hari ini, belum
  // ada kemenangan hari ini, dan selesai terakhir ≥ 2 hari lalu — atau
  // tidak ketemu di jendela cache 2 bulan padahal totalnya pernah ada.
  return useMemo(() => {
    if (selectedDate !== todayStr) return null;
    // Menang pasif TIDAK menutup banner: habit 'avoid' bersih hari ini tidak
    // butuh usaha apa pun — kalau tidak ada habit normal/amount yang dicentang
    // hari ini, orangnya belum MELAKUKAN apa-apa → sapaan tetap relevan.
    const hasActiveWinToday = trackableHabits.some(
      (h) => h.habitType !== 'avoid' && !!(completionMap[h.id] ?? false),
    );
    if (hasActiveWinToday) return null;
    if (activeHabits.length === 0) return null;
    const everDone = habits.some((h) => (h.completedLogCount ?? 0) > 0);
    if (!everDone) return null; // pemula — belum ada "kembali"
    // Selesai terakhir dalam jendela cache ±2 bulan (cache bulan berjalan
    // menyimpan gabungan prev+current — lihat M4-fix di use-habit-completions).
    const cache = monthLogsCache;
    let last = '';
    if (cache) {
      for (const logs of Object.values(cache)) {
        for (const l of logs) {
          if (!l.completed) continue;
          const ymd = toDateString(l.date);
          if (ymd <= todayStr && ymd > last) last = ymd;
        }
      }
    }
    // Task 39 (#7): tanggal WISUDA = tanggal kemenangan terakhir habit lulus.
    // Cache log bulanan hanya berisi habit yang BELUM lulus, jadi tanpa ini
    // pengguna yang kemarin menyelesaikan habit terakhirnya lalu hari ini
    // membuka app disambut "sudah lama tidak mampir" (gap 99 palsu).
    for (const h of habits) {
      if (!h.graduatedAt) continue;
      const gy = jakartaYmdOf(h.graduatedAt);
      if (gy <= todayStr && gy > last) last = gy;
    }
    const gapDays = last
      ? Math.round((dateFromYMD(todayStr).getTime() - dateFromYMD(last).getTime()) / 86_400_000)
      : 99; // tidak ketemu di 2 bulan → gap panjang, tetap sambut
    if (gapDays < 2) return null;
    // Saran mulai: habit normal/amount TERJADWAL hari ini yang belum
    // selesai & tidak libur — prioritas kesulitan paling ringan (Easy/Mudah).
    // Habit 'avoid' TIDAK ditawarkan (tombolnya menandai kambuh, bukan
    // kemenangan). Task 37: kandidat hanya habit yang memang jadwalnya hari
    // ini — hari tanpa jadwal apa pun tidak menawarkan apa pun (banner
    // otomatis tidak muncul karena candidates kosong).
    const candidates = scheduledHabits.filter(
      (h) => h.habitType !== 'avoid' && !h.vacationMode && !(completionMap[h.id] ?? false),
    );
    if (candidates.length === 0) return null;
    const easy = candidates.filter((h) => h.difficulty === 'Easy' || h.difficulty === 'Mudah');
    const pick = (easy.length > 0 ? easy : candidates)[0];
    return { gapDays, pick };
    // Deps: compiler menyimpulkan activeHabits & monthLogsCache juga terpakai
    // (dulu tidak di deps kode asli — tersembunyi oleh pelanggaran refs yang
    // membuat compiler bailout). Memo komputasi murni: recompute lebih sering
    // hanya menghasilkan nilai sama-atau-lebih-segar, identitas objek berganti
    // hanya saat datanya memang berganti.
  }, [selectedDate, todayStr, trackableHabits, scheduledHabits, habits, activeHabits, completionMap, monthLogsCache]);
}
