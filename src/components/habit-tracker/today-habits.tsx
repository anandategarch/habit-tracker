'use client';

// components/habit-tracker/today-habits.tsx — Task 44 "Today's Habits"
// + CONNECTED-APP (Task 47) completion 1-tap.
//
// Seksi konten Beranda (tier 2): SELURUH rutinitas terjadwal hari ini —
// yang belum selesai (aksi) DAN yang sudah (dirayakan, ceklis hijau).
//
// CONNECTED-APP — dua level aksi per baris habit:
//  * PRIMARY   tombol ceklis 44px → langsung selesai dari Beranda
//              (hanya habit biner normal; feedback <500ms: ripple,
//              haptic, toast +XP, confetti). Habit amount/trackTime/
//              avoid BUTUH konteks tracker → tombol membuka tracker
//              tanggal hari ini (stepper/dialog/relapse ada di sana).
//  * SECONDARY baris / ikon grafik → tracker / dialog analisis.
//
// Data murni props (dari /api/dashboard focusToday via contract) — tidak
// ada fetch; mutation completion dipegang parent (dashboard.tsx).

import { BarChart3, Check, Sunrise, Clock, ShieldAlert, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TreeProgress } from '@/components/ui/loaders';
import type { TodayHabitItem } from './dashboard-types';

interface TodayHabitsCardProps {
  habits: TodayHabitItem[];
  /** 'yyyy-MM-dd' Jakarta hari ini — target deep-link tracker. */
  todayStr: string;
  onOpenTracker: (date: string) => void;
  onOpenHabit: (habitId: string) => void;
  /** Jalur FAB: triggerQuickAdd('habit') + pindah tab settings. */
  onAddHabit: () => void;
  /** CONNECTED-APP — completion 1-tap dari Beranda (habit biner normal).
   *  Menerima elemen tombol untuk posisi confetti. */
  onCompleteHabit: (habit: TodayHabitItem, el: HTMLElement | null) => void;
  /** ID habit yang sedang dalam round-trip completion (tombol berdenyut). */
  completingIds?: ReadonlySet<string>;
}

const priorityVariant = (p?: string) => {
  switch ((p ?? 'medium').toLowerCase()) {
    case 'high':
    case 'tinggi':
      return 'destructive' as const;
    case 'medium':
    case 'sedang':
      return 'default' as const;
    default:
      return 'secondary' as const;
  }
};

/** Habit yang AMAN diselesaikan 1-tap dari Beranda: biner 'normal'.
 *  amount (butuh stepper), trackTime (butuh dialog durasi), dan avoid
 *  (cek = catat kambuh — butuh konteks penuh tracker) dinavigasikan. */
const canOneTap = (h: TodayHabitItem) =>
  !h.completed && h.habitType === 'normal' && !h.trackTime;

export function TodayHabitsCard({
  habits,
  todayStr,
  onOpenTracker,
  onOpenHabit,
  onAddHabit,
  onCompleteHabit,
  completingIds,
}: TodayHabitsCardProps) {
  // Yang belum selesai dulu (bisa ditindak), lalu yang sudah (dirayakan).
  const pending = habits.filter((h) => !h.completed);
  const done = habits.filter((h) => h.completed);
  // BUGHUNT-54 (3-c #2): semantik avoid — sukses = TIDAK kambuh. Badge
  // "X/Y selesai" menghitung habit BERHASIL (avoid yang masih bersih =
  // berhasil), bukan jumlah baris ter-log; konsisten dengan hero Beranda
  // & KPI "Hari Ini %" (Task 39 #4). Kambuh avoid tidak dihitung sukses.
  const successCount = habits.filter(
    (h) => (h.habitType === 'avoid' ? !h.completed : h.completed),
  ).length;
  const completing = completingIds ?? new Set<string>();

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up"
      aria-label="Rutinitas hari ini"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="chip-soft chip-soft-teal h-8 w-8" aria-hidden="true">
            <Sunrise className="h-4 w-4" />
          </span>
          Rutinitas Hari Ini
        </h3>
        {habits.length > 0 && (
          <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
            {successCount}/{habits.length} selesai
          </Badge>
        )}
      </div>

      {habits.length === 0 ? (
        /* Empty state — hidup & mengundang (bukan "No data"). */
        <div className="premium-empty">
          <TreeProgress size={64} growth={0} />
          <p className="text-sm font-semibold">🌱 Belum ada rutinitas</p>
          <p className="max-w-[26ch] text-center text-[13px] text-muted-foreground">
            Mulai dengan satu rutinitas kecil. Kamu tidak perlu mengubah semuanya
            sekaligus.
          </p>
          <Button size="sm" onClick={onAddHabit} className="btn-primary-gradient anim-press">
            Tambah Rutinitas Pertama
          </Button>
        </div>
      ) : pending.length === 0 && successCount === habits.length ? (
        /* Semua selesai — rayakan, jangan tinggalkan kartu kosong. */
        /* BUGHUNT-54 (3-c #2): rayakan hanya bila SEMUA habit memang berhasil —
           kambuh avoid (pending=0 tapi bukan sukses) tidak lagi memicu
           "Semua selesai 🌳"; habit hindari yang bersih tetap tampil sebagai
           baris aktif (relapse bisa dicatat kapan pun sepanjang hari). */
        <div className="premium-empty">
          <TreeProgress size={64} growth={1} />
          <p className="text-sm font-semibold">Semua selesai hari ini 🌳</p>
          <p className="max-w-[30ch] text-center text-[13px] text-muted-foreground">
            {done.length} rutinitas tuntas. Nikmati sisanya — kamu sudah
            menumbuhkan harimu.
          </p>
        </div>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {pending.map((habit) => {
            const oneTap = canOneTap(habit);
            const isAvoid = habit.habitType === 'avoid';
            const isAmount = habit.habitType === 'amount';
            const isTime = !!habit.trackTime;
            const busy = completing.has(habit.id);
            return (
              <div key={habit.id} className="group/row flex items-center gap-1.5">
                {/* Baris utama — secondary action (VERIFY-48 48-c F11): fokus
                    habit SPESIFIK ini (trackTime → dialog analisis; lainnya →
                    gulir ke kartunya; dulu generik buka puncak tracker —
                    konteks per-habit hilang). */}
                <button
                  type="button"
                  onClick={() => onOpenHabit(habit.id)}
                  aria-label={`Buka detail rutinitas ${habit.name} di tracker`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0 text-base" aria-hidden="true">
                      {habit.icon}
                    </span>
                    <span className="truncate text-sm font-medium">{habit.name}</span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {/* Kapabilitas habit → petunjuk kontekstual (bukan badge kosong). */}
                    {isAmount && (habit.target ?? 0) > 0 && (
                      <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                        {habit.value ?? 0}/{habit.target}
                      </span>
                    )}
                    {isTime && (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
                    )}
                    {isAvoid && (
                      <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden="true" />
                    )}
                    {habit.priority && !isAmount && !isTime && !isAvoid && (
                      <Badge variant={priorityVariant(habit.priority)} className="text-xs">
                        {habit.priority}
                      </Badge>
                    )}
                  </span>
                </button>
                {/* PRIMARY — complete 1-tap (hanya habit biner normal);
                    habit amount/trackTime/avoid: panah membuka tracker
                    (stepper / dialog waktu / konteks relapse ada di sana). */}
                {oneTap ? (
                  <button
                    type="button"
                    onClick={(e) => onCompleteHabit(habit, e.currentTarget)}
                    disabled={busy}
                    aria-label={`Tandai rutinitas ${habit.name} selesai`}
                    aria-busy={busy}
                    className={cn(
                      'relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl',
                      'border border-primary/35 bg-primary/[0.08] text-primary',
                      'transition-all hover:bg-primary/15 hover:border-primary/50',
                      'active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      'motion-reduce:transition-none',
                      busy && 'animate-pulse',
                    )}
                  >
                    {/* Task 61-f (audit 61-a P2): ripple satu-tembakan hanya
                        saat habit SEDANG diselesaikan (busy) — pola benar di
                        daily-tracker-habit-card (justCompleted && isDone + key).
                        Dulu span ini dirender permanen di semua baris pending →
                        animasi 0.6s berjalan sekali SAAT MOUNT (kilau palsu
                        tiap load Beranda) dan tidak pernah diputar ulang saat
                        habit benar-benar diselesaikan. */}
                    {busy && (
                      <span key={`ripple-${habit.id}`} className="rt-check-ripple" aria-hidden="true" />
                    )}
                    <Check className="h-4.5 w-4.5" strokeWidth={2.6} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenTracker(todayStr)}
                    aria-label={`Selesaikan rutinitas ${habit.name} di tracker`}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-border/70 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <Check className="h-4.5 w-4.5" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}
                {/* SECONDARY — analisis waktu (hanya habit trackTime; habit
                    lain dialognya buntu "tidak mencatat waktu"). */}
                {habit.trackTime && (
                  <button
                    type="button"
                    onClick={() => onOpenHabit(habit.id)}
                    aria-label={`Lihat analisis waktu rutinitas ${habit.name}`}
                    className="hidden h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:grid sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}

          {done.length > 0 && pending.length > 0 && (
            <div className="premium-label px-1 pt-2" aria-hidden="true">
              Selesai hari ini
            </div>
          )}

          {done.map((habit) => {
            // Habit avoid yang "selesai" = kambuh tercatat — TIDAK dirayakan
            // (chip emerald akan merayakan keputusan buruk). Netral & lembut.
            const isAvoid = habit.habitType === 'avoid';
            return (
              <div key={habit.id} className="group/row flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenHabit(habit.id)}
                  aria-label={`Rutinitas ${habit.name} sudah selesai hari ini — lihat detailnya di tracker`}
                  className={cn(
                    'flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-muted/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    isAvoid
                      ? 'border-border/60 bg-muted/30'
                      : 'border-emerald-500/25 bg-emerald-500/[0.06]',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0 text-base opacity-80" aria-hidden="true">
                      {habit.icon}
                    </span>
                    <span className="truncate text-sm font-medium text-muted-foreground">
                      {habit.name}
                    </span>
                  </div>
                  {isAvoid ? (
                    <span
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                      aria-label={`${habit.name} tercatat hari ini`}
                    >
                      <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Tercatat
                    </span>
                  ) : (
                    <span
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                      aria-label={`${habit.name} selesai`}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                      Selesai
                    </span>
                  )}
                </button>
                {habit.trackTime && (
                  <button
                    type="button"
                    onClick={() => onOpenHabit(habit.id)}
                    aria-label={`Lihat analisis waktu rutinitas ${habit.name}`}
                    className="hidden h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:grid sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
                  >
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {habits.length > 0 && pending.length > 0 && (
        <p className={cn('mt-3 text-center text-[12px] text-muted-foreground')}>
          Ketuk ceklis untuk menyelesaikan langsung — rutinitas berjumlah/waktu
          membuka tracker.
        </p>
      )}
    </section>
  );
}
