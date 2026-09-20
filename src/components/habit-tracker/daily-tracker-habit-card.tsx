'use client';

// components/habit-tracker/daily-tracker-habit-card.tsx — kartu habit.
// ROOT KOMPOSISI (Task 71-j): meta badges / tombol aksi / checkbox /
// stepper amount / Target Lulus / wajah riwayat 7 hari di sibling
// daily-tracker-habit-card-*; prop & export (HabitCard + HabitCardProps)
// tetap stabil untuk daily-tracker-habit-grid & daily-tracker-sortable-card.
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
import type { Habit, HabitLog } from './daily-tracker-types';
import { computeStreakDetail, jakartaYmdOf, vacationIntervalsOf } from './daily-tracker-helpers';
import { parseSchedule } from '@/lib/habit-schedule';
import { cn } from '@/lib/utils';
import { CAT_TINT, computeLast7Days, hexTintStyle } from './daily-tracker-habit-card-helpers';
import { HabitCardMetaBadges } from './daily-tracker-habit-card-meta-badges';
import { HabitCardActions } from './daily-tracker-habit-card-actions';
import { HabitCardToggle } from './daily-tracker-habit-card-toggle';
import { HabitCardAmount } from './daily-tracker-habit-card-amount';
import { HabitCardGraduation } from './daily-tracker-habit-card-graduation';
import { HabitCardHistory } from './daily-tracker-habit-card-history';

export interface HabitCardProps {
  habit: Habit;
  idx: number;
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

function HabitCardInner({
  habit,
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
  const startYmd = habit.startDate ? jakartaYmdOf(habit.startDate) : null;
  const days = computeLast7Days({
    monthLogs,
    selectedDate,
    todayStr,
    schedule,
    isScheduledDaily,
    isAvoid,
    startYmd,
  });
  // ── Task 36: streak + info hari aman (🛡) dalam SATU hitungan — selalu
  // sepakat dengan bestStreak tracker, dashboard, dan insight AI (helper
  // bersama; hari kosong mengonsumsi kuota 2 hari aman/bulan).
  // Task 37: hari di luar jadwal tidak memutus rantai.
  // Task 60-c: interval liburan permanen → hari libur NETRAL (streak
  // menyala kembali setelah libur, bukan putus ke 0).
  const streakInfo = computeStreakDetail(monthLogs ?? [], selectedDate, {
    invert: isAvoid,
    startDate: habit.startDate,
    onVacation: !!habit.vacationMode,
    vacation: vacationIntervalsOf(habit),
    schedule,
  });
  const streak = streakInfo.streak;

  const handleCardClick = (e: React.MouseEvent) => {
    if (dragMode) return;
    // Amount: parent handleHabitCheck me-redirect ke +1 (defense in depth).
    onToggleHabit?.(habit, e);
  };

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
                <HabitCardMetaBadges
                  habit={habit}
                  isAvoid={isAvoid}
                  isScheduledDaily={isScheduledDaily}
                  schedule={schedule}
                  doneTime={doneTime}
                  streakInfo={streakInfo}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <HabitCardActions
                  habit={habit}
                  onOpenAnalysis={onOpenAnalysis}
                  onToggleHistory={() => setFlipped((f) => !f)}
                />

                {/* Checkbox binary — habit amount TIDAK punya checkbox
                    (Task 44: hit-area 44px WCAG touch; chip "+XP" saat
                    baru selesai; ripple TASK 45). */}
                {!isAmount && (
                  <HabitCardToggle
                    habit={habit}
                    isDone={isDone}
                    isAvoid={isAvoid}
                    isToggling={isToggling}
                    justCompleted={justCompleted}
                    dragMode={dragMode}
                    onToggleHabit={onToggleHabit}
                    onSetConfettiEl={onSetConfettiEl}
                  />
                )}
              </div>
            </div>

            {/* ── Amount: stepper + progress (GELOMBANG 1) ── */}
            {isAmount && (
              <HabitCardAmount
                habit={habit}
                value={value}
                target={target}
                amountPct={amountPct}
                isToggling={isToggling}
                dragMode={dragMode}
                onAmountDelta={onAmountDelta}
              />
            )}

            {/* ── Task 36: Target Lulus — garis finis habit ── */}
            <HabitCardGraduation
              habit={habit}
              isAvoid={isAvoid}
              isToggling={isToggling}
              dragMode={dragMode}
              onGraduate={onGraduate}
            />
          </div>
        </article>

        {/* ─────────────── BACK (7 hari terakhir) ─────────────── */}
        <HabitCardHistory
          days={days}
          isAvoid={isAvoid}
          streak={streak}
          isScheduledDaily={isScheduledDaily}
          shieldedDays={streakInfo.shieldedDays}
          flipped={flipped}
          onClose={() => setFlipped(false)}
        />
      </div>
    </div>
  );
}

export const HabitCard = memo(HabitCardInner);
