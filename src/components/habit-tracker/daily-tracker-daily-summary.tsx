'use client';

// components/habit-tracker/daily-tracker-daily-summary.tsx — 4 KPI + progress.
//
// GELOMBANG 1: KPI Level memakai XP TOTAL all-time (completedLogCount × bobot
// difficulty per habit, agregat yang sama dengan /api/dashboard kpi.totalXp)
// — BUKAN todayXP yang reset harian. Tampil "Lv {level} · XP total {xp}".

import { CheckCircle2, Zap, Flame, Award } from 'lucide-react';
import { calcLevel } from '@/lib/dashboard-helpers';

interface DailySummaryProps {
  completedCount: number;
  totalCount: number;
  completionPct: number;
  /** XP hari ini (habit selesai hari ini × bobot difficulty). */
  todayXP: number;
  bestStreak: number;
  /** XP total all-time (agregat completedLogCount × XP_MAP per habit). */
  totalXp: number;
}

export function DailySummary({
  completedCount,
  totalCount,
  completionPct,
  todayXP,
  bestStreak,
  totalXp,
}: DailySummaryProps) {
  const level = calcLevel(totalXp);
  const pct = Math.max(0, Math.min(100, completionPct));

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up"
      aria-label="Ringkasan harian"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Selesai (teal) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Selesai</p>
            <p className="premium-stat text-xl text-foreground">
              {completedCount}
              <span className="text-sm font-semibold text-muted-foreground">
                /{totalCount}
              </span>
            </p>
          </div>
        </div>

        {/* XP hari ini (amber) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="chip-soft chip-soft-amber h-9 w-9 shrink-0" aria-hidden="true">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">XP Hari Ini</p>
            <p className="premium-stat text-xl text-foreground">
              {todayXP}
              <span className="text-sm font-semibold text-muted-foreground"> XP</span>
            </p>
          </div>
        </div>

        {/* Streak terbaik (rose + api animasi) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="chip-soft chip-soft-rose h-9 w-9 shrink-0" aria-hidden="true">
            <Flame
              className={bestStreak > 0 ? 'h-4 w-4 anim-flame-pulse' : 'h-4 w-4'}
            />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Streak Terbaik</p>
            <p className="premium-stat text-xl text-foreground">
              {bestStreak}
              <span className="text-sm font-semibold text-muted-foreground"> hari</span>
            </p>
          </div>
        </div>

        {/* Level XP total (violet) — Gelombang 1 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="chip-soft chip-soft-violet h-9 w-9 shrink-0" aria-hidden="true">
            <Award className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Level</p>
            <p className="premium-stat text-xl text-foreground">Lv {level}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums truncate">
              XP total {totalXp}
            </p>
          </div>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="premium-label">Progres Hari Ini</span>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {pct}%
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Persentase habit selesai hari ini"
        >
          <div
            className="h-full rounded-full premium-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
