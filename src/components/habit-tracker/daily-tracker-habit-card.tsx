'use client';

// components/habit-tracker/daily-tracker-habit-card.tsx — kartu habit.
//
// GELOMBANG 1: habit amount (habitType==='amount') TIDAK punya checkbox —
// tampil "X/target {unit} menuju target" + stepper −/+ (prop onAmountDelta;
// parent meng-clamp 0..target, completed = value >= target). Habit
// normal/avoid tetap binary (checkbox bulat gradien).
//
// Premium (Rutina Aurora): premium-card + hover + sheen; state selesai =
// wash emerald (kambuh = rose) via overlay child (bukan bg di elemen
// premium-card — alasan cascade worklog 2-b/6-c); checkbox gradien
// teal→emerald (avoid rose→red) + pop anim + confetti; flip-card back face
// berisi 7 hari terakhir.

import { memo, useState, type CSSProperties } from 'react';
import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  GraduationCap,
  History,
  Minus,
  Plus,
  Shield,
  X,
  Target,
} from 'lucide-react';
import type { Habit, HabitLog } from './daily-tracker-types';
import { computeStreakDetail, shiftYmdKey, toDateString } from './daily-tracker-helpers';
import { xpForHabit } from '@/lib/dashboard-helpers';
import { dateFromYMD } from '@/lib/timezone';
import { eeeIdFormatter } from '@/lib/date-utils';
import {
  isScheduledOn,
  parseSchedule,
  scheduleLabel,
} from '@/lib/habit-schedule';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/app-store';

export interface HabitCardProps {
  habit: Habit;
  idx: number;
  /** CONNECTED-APP (Task 49) — judul tujuan yang didukung habit (bila ada). */
  goalTitle?: string;
  isDone: boolean;
  isToggling: boolean;
  justCompleted: boolean;
  doneTime: string | null;
  monthLogs?: HabitLog[];
  selectedDate: string;
  todayStr: string;
  categoryColor?: string;
  primaryColor?: string;
  /** Mode atur urutan: interaksi toggle/stepper dimatikan. */
  dragMode?: boolean;
  /** Nilai amount hari ini (habit amount saja). */
  amountValue?: number;
  onToggleHabit?: (
    habit: Habit,
    event?: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onAmountDelta?: (habit: Habit, delta: number, event?: React.MouseEvent) => void;
  onSetConfettiEl?: (el: HTMLElement | null) => void;
  onOpenAnalysis?: (habitId: string) => void;
  /** Task 36 — wisudakan habit (tombol muncul saat progres target tercapai). */
  onGraduate?: (habit: Habit, el: HTMLElement | null) => void;
}

// Map nama warna opsi kategori → kelas tint yang ada di globals.css
// (jalur LEGACY — dipakai bila color masih berupa nama, mis. 'slate').
const CAT_TINT: Record<string, string> = {
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
function hexTintStyle(color: string): CSSProperties | null {
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

interface DayCell {
  ymd: string;
  label: string;
  dayNum: number;
  // 'off' = Task 37: hari di luar jadwal habit (bukan miss, bahan bolong).
  state: 'done' | 'miss' | 'relapse' | 'clean' | 'future' | 'off';
  isSelected: boolean;
}

function HabitCardInner({
  habit,
  goalTitle,
  isDone,
  isToggling,
  justCompleted,
  doneTime,
  monthLogs,
  selectedDate,
  todayStr,
  categoryColor,
  dragMode = false,
  amountValue = 0,
  onToggleHabit,
  onAmountDelta,
  onSetConfettiEl,
  onOpenAnalysis,
  onGraduate,
}: HabitCardProps) {
  const [flipped, setFlipped] = useState(false);
  // CONNECTED-APP (Task 49): chip tujuan → tab Tujuan (fokus + sorot).
  const openGoalFocus = useAppStore((s) => s.openGoalFocus);
  const isAvoid = habit.habitType === 'avoid';
  const isAmount = habit.habitType === 'amount';
  const target = Math.max(1, habit.target || 1);
  const value = Math.max(0, Math.min(target, amountValue));
  const amountPct = Math.round((value / target) * 100);
  const catRawColor = String(categoryColor ?? 'slate').trim().toLowerCase();
  // M6: hex → inline wash; nama dikenal → kelas cat-*; selainnya → slate.
  const catTint = CAT_TINT[catRawColor] ?? '';
  const catTintStyle = catTint ? undefined : hexTintStyle(catRawColor) ?? undefined;
  const catTintClass = catTint || (catTintStyle ? '' : 'cat-slate');

  // ── Task 37: jadwal tampil habit (null = setiap hari) ──
  const schedule = parseSchedule(habit.scheduleJson);
  const isScheduledDaily = schedule.kind === 'daily';

  // ── Back face: 7 hari terakhir (selectedDate-6 … selectedDate) ──
  const days: DayCell[] = Array.from({ length: 7 }, (_, i) => {
    const ymd = shiftYmdKey(selectedDate, i - 6);
    const d = dateFromYMD(ymd);
    const log = monthLogs?.find((l) => toDateString(l.date) === ymd);
    const done = !!log?.completed;
    const off = !isScheduledDaily && !isScheduledOn(schedule, ymd);
    let state: DayCell['state'];
    if (ymd > todayStr) state = 'future';
    else if (done) state = isAvoid ? 'relapse' : 'done';
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
  // ── Task 36: streak + info hari aman (🛡) dalam SATU hitungan — selalu
  // sepakat dengan bestStreak tracker, dashboard, dan insight AI (helper
  // bersama; hari kosong mengonsumsi kuota 2 hari aman/bulan).
  // Task 37: hari di luar jadwal tidak memutus rantai.
  const streakInfo = computeStreakDetail(monthLogs ?? [], selectedDate, {
    invert: isAvoid,
    startDate: habit.startDate,
    onVacation: !!habit.vacationMode,
    schedule,
  });
  const streak = streakInfo.streak;

  // ── Task 36: Target Lulus — progres menuju garis finis habit. Habit lulus
  // sudah tidak dirender tracker (difilter parent), jadi di sini hanya dua
  // keadaan: masih mengejar target, atau SIAP diwisuda.
  const hasGraduationTarget = !isAvoid && !!habit.targetDays && !habit.graduatedAt;
  const gradTarget = Math.max(1, habit.targetDays ?? 1);
  const gradDone = habit.completedLogCount ?? 0;
  const gradPct = Math.min(100, Math.round((gradDone / gradTarget) * 100));
  const readyToGraduate = hasGraduationTarget && gradDone >= gradTarget;

  // ── Task 36: lookup hari aman untuk sel riwayat 7 hari ──
  const shieldedSet = new Set(streakInfo.shieldedDays);

  const handleCardClick = (e: React.MouseEvent) => {
    if (dragMode) return;
    // Amount: parent handleHabitCheck me-redirect ke +1 (defense in depth).
    onToggleHabit?.(habit, e);
  };

  const handleCheckboxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (dragMode) return;
    // TASK 45 — haptic ringan (bila didukung perangkat): completion harus
    // terasa FISIK, <300ms, tanpa menunggu network. Guard feature-detect.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
    // Set elemen asal confetti DULU (pola BUG-5) lalu toggle tanpa event —
    // parent memakai ref yang baru saja diset.
    onSetConfettiEl?.(e.currentTarget);
    onToggleHabit?.(habit);
  };

  const checkboxLabel = isAvoid
    ? `${habit.name} — tandai kambuh`
    : isDone
      ? `Batalkan selesai: ${habit.name}`
      : `Tandai selesai: ${habit.name}`;

  const amountLabel = value >= target
    ? `Target tercapai · ${value}/${target}${habit.unit ? ` ${habit.unit}` : ''}`
    : `${value}/${target}${habit.unit ? ` ${habit.unit}` : ''} menuju target`;

  return (
    <div id={habit.id} className="relative scroll-mt-24 [perspective:1200px]">
      <div
        className={cn(
          'habit-flip-wrap relative transition-transform duration-500 [transform-style:preserve-3d]',
          flipped && '[transform:rotateY(180deg)]',
        )}
      >
        {/* ─────────────── FRONT ─────────────── */}
        <article
          onClick={handleCardClick}
          className={cn(
            'premium-card premium-card-hover premium-card-sheen rounded-2xl [backface-visibility:hidden]',
            // FIX-HABIT-GRID-GAP: saat kartu dibalik, wajah depan jadi overlay
            // absolute (bukan in-flow) supaya tinggi container mengikuti wajah
            // belakang yang lebih tinggi (riwayat 7 hari) — tidak ada konten
            // yang meluber. Saat normal, wajah depan tetap in-flow.
            flipped
              ? 'habit-flip-overlay pointer-events-none'
              : 'cursor-pointer',
            isToggling && 'opacity-70',
          )}
        >
          {/* Wash state — overlay child, bukan bg di premium-card (cascade). */}
          {isDone && !isAvoid && (
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent pointer-events-none"
              aria-hidden="true"
            />
          )}
          {isDone && isAvoid && (
            <div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-500/15 via-red-500/10 to-transparent pointer-events-none"
              aria-hidden="true"
            />
          )}

          <div className="relative p-3.5 sm:p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'h-10 w-10 shrink-0 rounded-xl grid place-items-center text-xl leading-none',
                  catTintClass,
                )}
                style={catTintStyle}
                aria-hidden="true"
              >
                {habit.emoji}
              </span>

              <div className="flex-1 min-w-0">
                <h4
                  className={cn(
                    'text-sm font-semibold leading-snug break-words',
                    isDone &&
                      !isAvoid &&
                      'line-through decoration-muted-foreground/60 text-muted-foreground',
                  )}
                >
                  {habit.name}
                </h4>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="inline-flex items-center rounded-full border border-border/70 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {habit.category}
                  </span>
                  {/* CONNECTED-APP (Task 49): tujuan yang didukung habit —
                      1 klik ke tab Tujuan (fokus + sorot + expand). */}
                  {habit.goalId && goalTitle && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openGoalFocus(habit.goalId!);
                      }}
                      title={`Mendukung tujuan: ${goalTitle}`}
                      aria-label={`Buka tujuan ${goalTitle}`}
                      className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold tracking-wider text-amber-700 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:text-amber-400"
                    >
                      <Target className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                      <span className="max-w-[8rem] truncate normal-case">{goalTitle}</span>
                    </button>
                  )}
                  {/* Task 36 — chip Hari Aman: sisa kuota bolong yang diampuni */}
                  {/* bulan ini (2/bulan). Tooltip menjelaskan aturannya. */}
                  {!isAvoid && (
                    <span
                      title={`Hari Aman: 2 hari kosong per bulan tidak memutus streak — sisa bulan ini ${streakInfo.shieldsLeftThisMonth}.`}
                      className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/10 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider tabular-nums"
                    >
                      <Shield className="h-2.5 w-2.5" aria-hidden="true" />
                      {streakInfo.shieldsLeftThisMonth}
                    </span>
                  )}
                  {habit.vacationMode && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider">
                      🏖 Libur
                    </span>
                  )}
                  {/* Task 37 — chip jadwal: hari/tanggal tempat habit tampil. */}
                  {!isScheduledDaily && (
                    <span
                      title={`Jadwal: ${scheduleLabel(schedule)}`}
                      className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/10 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider max-w-[7.5rem]"
                    >
                      <CalendarDays className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                      <span className="truncate normal-case">{scheduleLabel(schedule)}</span>
                    </span>
                  )}
                  {doneTime && (
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 tabular-nums">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      Selesai {doneTime}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAnalysis?.(habit.id);
                  }}
                  aria-label={`Analisis waktu: ${habit.name}`}
                  title="Analisis waktu"
                  className="h-10 w-10 rounded-full grid place-items-center text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFlipped((f) => !f);
                  }}
                  aria-label={`Riwayat 7 hari: ${habit.name}`}
                  title="Riwayat 7 hari"
                  className="h-10 w-10 rounded-full grid place-items-center text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <History className="h-3.5 w-3.5" />
                </button>

                {/* Checkbox binary — habit amount TIDAK punya checkbox.
                    Task 44: hit-area 44px (WCAG touch) — lingkaran visual 24px
                    jadi anak span; + chip "+XP" melayang saat baru selesai. */}
                {!isAmount && (
                  <span
                    className={cn(
                      'relative inline-grid place-items-center',
                      justCompleted && 'anim-nav-icon-pop',
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isDone}
                      aria-label={checkboxLabel}
                      disabled={isToggling || dragMode}
                      onClick={handleCheckboxClick}
                      className={cn(
                        'relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                        isToggling && 'animate-pulse',
                      )}
                    >
                      {/* TASK 45 — ripple satu-tembakan: ring memancar dari
                          tombol saat baru selesai (0.6s, reduced-motion aware).
                          Pelengkap confetti + chip XP → completion terasa
                          instant + satisfying tanpa animasi panjang. */}
                      {justCompleted && isDone && (
                        <span key={`ripple-${habit.id}`} aria-hidden="true" className="rt-check-ripple" />
                      )}
                      <span
                        className={cn(
                          'grid h-7 w-7 place-items-center rounded-full border-2 transition-all duration-200',
                          isDone
                            ? isAvoid
                              ? 'border-transparent bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-[0_0_14px_-2px_rgba(244,63,94,0.65)]'
                              : 'border-transparent bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-[0_0_16px_-2px_rgba(16,185,129,0.75)]'
                            : cn(
                                'border-muted-foreground/40 bg-transparent',
                                isAvoid
                                  ? 'hover:border-rose-500/70'
                                  : 'hover:border-teal-500/70',
                              ),
                        )}
                      >
                        {isDone && <Check className="h-4 w-4" strokeWidth={3.5} />}
                      </span>
                    </button>
                    {/* Task 44 — reward XP terlihat: muncul HANYA untuk habit
                        normal yang baru saja diselesaikan (avoid = kambuh,
                        tidak berhak XP; amount = tanpa checkbox). Animasi
                        0.75s naik-lalu-pudar (anim-xp-rise, reduced-motion
                        aware). aria-hidden: informasi XP sudah dibawa toast. */}
                    {justCompleted && !isAvoid && isDone && (
                      <span
                        key={`xp-${habit.id}`}
                        aria-hidden="true"
                        className="anim-xp-rise pointer-events-none absolute -top-1 right-0 whitespace-nowrap text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                      >
                        +{xpForHabit(habit)} XP
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* ── Amount: stepper + progress (GELOMBANG 1) ── */}
            {isAmount && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      'text-xs tabular-nums',
                      value >= target
                        ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    {amountLabel}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (dragMode) return;
                        onAmountDelta?.(habit, -1, e);
                      }}
                      aria-label={`Kurangi: ${habit.name}`}
                      disabled={value <= 0 || isToggling || dragMode}
                      className="h-10 w-10 rounded-full border border-border/70 grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (dragMode) return;
                        onAmountDelta?.(habit, 1, e);
                      }}
                      aria-label={`Tambah: ${habit.name}`}
                      disabled={isToggling || dragMode}
                      className="h-10 w-10 rounded-full btn-primary-gradient grid place-items-center text-primary-foreground active:scale-90 transition-all disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div
                  className="h-1.5 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={value}
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-label={`Progres ${habit.name}`}
                >
                  <div
                    className="h-full rounded-full premium-progress-fill"
                    style={{ width: `${Math.min(100, amountPct)}%` }}
                  />
                </div>
              </div>
            )}

            {/* ── Task 36: Target Lulus — garis finis habit ── */}
            {/* Habit tipe "senang memulai, susah menyelesaikan" butuh garis */}
            {/* finis yang bisa DISELESAIKAN: progres menuju wisuda, lalu */}
            {/* tombol Lulus (confetti dari elemen tombol). */}
            {hasGraduationTarget &&
              (readyToGraduate ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragMode) return;
                    onGraduate?.(habit, e.currentTarget);
                  }}
                  disabled={isToggling || dragMode}
                  aria-label={`Luluskan habit ${habit.name} — target ${gradTarget} hari tercapai`}
                  className="w-full h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-semibold text-xs sm:text-sm grid place-items-center gap-1.5 grid-flow-col shadow-[0_6px_18px_-6px_rgba(245,158,11,0.55)] hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 anim-micro-pulse"
                >
                  <GraduationCap className="h-4.5 w-4.5" aria-hidden="true" />
                  Target {gradTarget} hari tercapai — Luluskan!
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      {gradDone}/{gradTarget} hari menuju lulus
                    </p>
                    <span className="text-[10px] font-semibold text-muted-foreground/80 tabular-nums">
                      {gradPct}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full bg-muted overflow-hidden"
                    role="progressbar"
                    aria-valuenow={gradDone}
                    aria-valuemin={0}
                    aria-valuemax={gradTarget}
                    aria-label={`Progres lulus ${habit.name}`}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                      style={{ width: `${gradPct}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </article>

        {/* ─────────────── BACK (7 hari terakhir) ─────────────── */}
        <div
          className={cn(
            'rounded-2xl premium-card premium-card-sheen [backface-visibility:hidden] [transform:rotateY(180deg)]',
            // FIX-HABIT-GRID-GAP: back face HANYA absolute saat tidak dibalik.
            // (Sebelumnya selalu `absolute inset-0`, tapi .premium-card yang tak
            // berlayer mengalahkan utilitas Tailwind — posisinya jadi relative
            // dan menambah ±150px tinggi tiap kartu = celah palsu antar baris
            // grid. Kini: normal → overlay tersembunyi; dibalik → in-flow, jadi
            // container membesar pas dengan konten riwayat.)
            flipped ? 'pointer-events-auto' : 'habit-flip-overlay pointer-events-none',
          )}
          aria-hidden={!flipped}
        >
          <div className="relative p-3.5 sm:p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <p className="premium-label">7 Hari Terakhir</p>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                {isAvoid ? `Bersih ${streak} hari` : `Streak ${streak} hari`}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFlipped(false);
                }}
                aria-label="Tutup riwayat 7 hari"
                className="h-9 w-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 flex-1">
              {days.map((day) => {
                // Task 36: hari 'miss' yang diampuni hari aman → tampak 🛡
                // (streak tetap nyambung lewat hari itu).
                const isShielded = !isAvoid && day.state === 'miss' && shieldedSet.has(day.ymd);
                return (
                <div
                  key={day.ymd}
                  title={`${day.ymd}${
                    day.state === 'off'
                      ? ' — di luar jadwal'
                      : isShielded
                        ? ' — hari aman (streak tetap jalan)'
                        : day.state === 'relapse'
                          ? ' — kambuh'
                          : day.state === 'done'
                            ? ' — selesai'
                            : ''
                  }`}
                  className={cn(
                    'rounded-lg flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px]',
                    day.isSelected && 'ring-1 ring-primary/60',
                    day.state === 'done' && 'bg-teal-500/20 dark:bg-teal-500/25',
                    day.state === 'clean' && 'bg-emerald-500/15 dark:bg-emerald-500/20',
                    day.state === 'relapse' && 'bg-rose-500/20 dark:bg-rose-500/25',
                    isShielded && 'bg-teal-500/15 dark:bg-teal-400/15',
                    day.state === 'off' && 'opacity-45 bg-muted/30',
                    !isShielded &&
                      (day.state === 'miss' || day.state === 'future') &&
                      'bg-muted/60',
                  )}
                >
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                    {day.label}
                  </span>
                  <span className="text-[11px] font-bold text-foreground tabular-nums">
                    {day.dayNum}
                  </span>
                  <span className="text-[10px] leading-none" aria-hidden="true">
                    {day.state === 'done' && (
                      <Check className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                    )}
                    {day.state === 'clean' && (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {day.state === 'relapse' && (
                      <X className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                    )}
                    {isShielded && (
                      <Shield className="h-3 w-3 text-teal-600 dark:text-teal-300" />
                    )}
                    {day.state === 'miss' && !isShielded && (
                      <span className="block h-3 w-[3px] rounded-full bg-muted-foreground/40" />
                    )}
                    {day.state === 'off' && (
                      <Minus className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
                    )}
                    {day.state === 'future' && (
                      <span className="block h-1 w-1 rounded-full bg-muted-foreground/30" />
                    )}
                  </span>
                </div>
                );
              })}
            </div>

            <p className="text-[10px] text-muted-foreground/80 mt-2">
              {isAvoid
                ? 'Hijau = hari bersih tanpa kambuh · merah = kambuh'
                : 'Teal = selesai · 🛡 = hari aman · abu = terlewat'}
              {!isAvoid && !isScheduledDaily && ' · ─ = di luar jadwal'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const HabitCard = memo(HabitCardInner);
