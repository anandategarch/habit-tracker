'use client';

// components/habit-tracker/daily-tracker-daily-summary.tsx — 4 KPI + progress.
//
// GELOMBANG 1: KPI Level memakai XP TOTAL all-time (completedLogCount × bobot
// difficulty per habit, agregat yang sama dengan /api/dashboard kpi.totalXp)
// — BUKAN todayXP yang reset harian. Tampil "Lv {level} · XP total {xp}".

import { CheckCircle2, Zap, Flame, Award } from 'lucide-react';
import { calcLevel } from '@/lib/dashboard-helpers';
import { mmmDdIdFormatter } from '@/lib/date-utils';
import { dateFromYMD } from '@/lib/timezone';
import { TreeProgress } from '@/components/ui/loaders';
import { CountUpNumber } from './count-up';
import { useAppStore } from '@/store/app-store';

interface DailySummaryProps {
  completedCount: number;
  totalCount: number;
  completionPct: number;
  /** XP hari yang SEDANG DILIHAT (habit selesai tanggal itu × bobot difficulty). */
  todayXP: number;
  bestStreak: number;
  /** XP total all-time (agregat completedLogCount × XP_MAP per habit). */
  totalXp: number;
  /** BUGHUNT-54 (3-b #6): tanggal yang sedang dilihat + hari ini Jakarta —
   *  label KPI dinamis ("XP Hari Ini" menyesatkan di tanggal lampau). */
  selectedDate: string;
  todayStr: string;
}

export function DailySummary({
  completedCount,
  totalCount,
  completionPct,
  todayXP,
  bestStreak,
  totalXp,
  selectedDate,
  todayStr,
}: DailySummaryProps) {
  const level = calcLevel(totalXp);
  const pct = Math.max(0, Math.min(100, completionPct));
  // VERIFY-48 (48-c F9): KPI streak → Riwayat (kalender sumber streak).
  const openTrackerHistory = useAppStore((s) => s.openTrackerHistory);
  // BUGHUNT-54 (3-b #6): label dinamis — tanggal lampau tampil "XP {d MMM}" /
  // "Progres {d MMM}" (mmmDdIdFormatter: label pendek Indonesia, konsisten
  // dengan chart/kalender).
  const isToday = selectedDate === todayStr;
  const dateLabel = mmmDdIdFormatter(dateFromYMD(selectedDate));

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up"
      aria-label="Ringkasan harian"
    >
      {/* TASK 45 — pohon signature menyapa di tracker juga (benang emosional
          antar layar): tumbuh mengikuti progres hari yang sedang dilihat. */}
      <div className="flex items-center gap-4 sm:gap-5">
        <TreeProgress
          size={72}
          growth={totalCount > 0 ? completedCount / totalCount : 0}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Selesai (teal) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Selesai</p>
            <p className="premium-stat text-xl text-foreground">
              <CountUpNumber value={completedCount} className="premium-stat-grad" />
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
            <p className="premium-label">{isToday ? 'XP Hari Ini' : `XP ${dateLabel}`}</p>
            <p className="premium-stat text-xl text-foreground">
              <CountUpNumber value={todayXP} className="premium-stat-grad" />
              <span className="text-sm font-semibold text-muted-foreground"> XP</span>
            </p>
          </div>
        </div>

        {/* Streak terbaik (rose + api animasi) — VERIFY-48 (48-c F9):
            KPI streak kini bisa diklik ke Riwayat (semua chip streak lain
            sudah navigasi; ini satu-satunya yang statis). */}
        <button
          type="button"
          onClick={() => openTrackerHistory()}
          aria-label={`Streak terbaik ${bestStreak} hari — lihat riwayat kalender`}
          title="Lihat riwayat kalender — sumber streak"
          className="flex items-center gap-2.5 min-w-0 cursor-pointer rounded-xl p-1 -m-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span className="chip-soft chip-soft-rose h-9 w-9 shrink-0" aria-hidden="true">
            <Flame
              className={bestStreak > 0 ? 'h-4 w-4 anim-flame-pulse' : 'h-4 w-4'}
            />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Streak Terbaik</p>
            <p className="premium-stat text-xl text-foreground">
              <CountUpNumber value={bestStreak} className="premium-stat-grad" />
              <span className="text-sm font-semibold text-muted-foreground"> hari</span>
            </p>
          </div>
        </button>

        {/* Level XP total (violet) — Gelombang 1 */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="chip-soft chip-soft-violet h-9 w-9 shrink-0" aria-hidden="true">
            <Award className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="premium-label">Level</p>
            <p className="premium-stat text-xl text-foreground">
              <CountUpNumber value={level} prefix="Lv " className="premium-stat-grad" />
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums truncate">
              XP total {totalXp}
            </p>
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="premium-label">{isToday ? 'Progres Hari Ini' : `Progres ${dateLabel}`}</span>
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
          aria-label={isToday ? 'Persentase habit selesai hari ini' : `Persentase habit selesai ${dateLabel}`}
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
