'use client';

// components/habit-tracker/dashboard-helpers.tsx — widget kecil bersama tab
// Dashboard (dipakai dashboard.tsx hasil recovery). Styling "Rutina Aurora"
// (PREMIUM UI SYSTEM v2): premium-segment / premium-stat / premium-label /
// chip-soft — KONSISTEN dengan konvensi worklog 2-a/4-a.

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  Info,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ENERGY_EMOJIS, MOOD_EMOJIS, energyEmoji, moodEmoji } from '@/lib/mood';
import {
  PERIOD_OPTIONS,
  type BestWorstHabit,
  type MotivationalQuote,
  type Period,
} from './dashboard-types';

/* ── ChartInfo — tooltip penjelasan grafik/section ────────────────────── */

export function ChartInfo({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Penjelasan grafik"
          className="grid h-5 w-5 shrink-0 cursor-help place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <p className="text-xs leading-relaxed">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/* ── ProgressRing — cincin SVG dengan angka .premium-stat ─────────────── */

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Class stroke, mis. 'stroke-primary' / 'stroke-teal-500'. */
  color?: string;
  label?: string;
}

export function ProgressRing({
  value,
  size = 110,
  strokeWidth = 10,
  color = 'stroke-primary',
  label,
}: ProgressRingProps) {
  const safe = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - safe / 100);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={label ? `${label} ${Math.round(safe)} persen` : `${Math.round(safe)} persen`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={cn(color, 'transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none')}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="premium-stat text-lg">{Math.round(safe)}%</span>
        </div>
      </div>
      {label && <span className="premium-label">{label}</span>}
    </div>
  );
}

/* ── Mood / Energi — emoji + label Indonesia (lib/mood single source) ──── */

const MOOD_LABELS: Record<number, string> = {
  1: 'Buruk',
  2: 'Kurang',
  3: 'Biasa',
  4: 'Baik',
  5: 'Hebat',
};

const ENERGY_LABELS: Record<number, string> = {
  1: 'Lemas',
  2: 'Lelah',
  3: 'Biasa',
  4: 'Bertenaga',
  5: 'Penuh energi',
};

/** Emoji mood 1–5; null/undefined → '—' (belum ada log check-in). */
export function MoodEmoji({ mood, className }: { mood: number | null; className?: string }) {
  if (mood == null || !Number.isFinite(mood)) {
    return (
      <span className={className} aria-hidden="true">
        —
      </span>
    );
  }
  const rounded = Math.min(5, Math.max(1, Math.round(mood)));
  return (
    <span className={className} aria-hidden="true">
      {MOOD_EMOJIS[rounded] ?? moodEmoji(mood)}
    </span>
  );
}

export function getMoodLabel(mood: number | null): string {
  if (mood == null || !Number.isFinite(mood)) return 'Belum diisi';
  const rounded = Math.min(5, Math.max(1, Math.round(mood)));
  return MOOD_LABELS[rounded] ?? 'Biasa';
}

/** Emoji energi 1–5; null/undefined → '—'. */
export function EnergyEmoji({ energy, className }: { energy: number | null; className?: string }) {
  if (energy == null || !Number.isFinite(energy)) {
    return (
      <span className={className} aria-hidden="true">
        —
      </span>
    );
  }
  const rounded = Math.min(5, Math.max(1, Math.round(energy)));
  return (
    <span className={className} aria-hidden="true">
      {ENERGY_EMOJIS[rounded] ?? energyEmoji(energy)}
    </span>
  );
}

export function getEnergyLabel(energy: number | null): string {
  if (energy == null || !Number.isFinite(energy)) return 'Belum diisi';
  const rounded = Math.min(5, Math.max(1, Math.round(energy)));
  return ENERGY_LABELS[rounded] ?? 'Biasa';
}

/* ── PeriodFilter — segmented control periode data ────────────────────── */

interface PeriodFilterProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
}

export function PeriodFilter({ period, onPeriodChange }: PeriodFilterProps) {
  return (
    <div role="group" aria-label="Pilih periode data" className="premium-segment">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-active={period === opt.value}
          aria-pressed={period === opt.value}
          onClick={() => onPeriodChange(opt.value)}
          className="premium-segment-item cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── QuoteDisplay — kutipan motivasi (typewriter + refresh) ────────────── */

interface QuoteDisplayProps {
  quote: MotivationalQuote;
  onRefresh: () => void;
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function QuoteDisplay({ quote, onRefresh }: QuoteDisplayProps) {
  const full = quote.quote ?? '';
  const [typed, setTyped] = useState('');

  // Typewriter: interval diketik ulang tiap kutipan baru (deps [full]).
  // prefers-reduced-motion / kutipan kosong → nilai final lewat timeout
  // (setState hanya di dalam callback, bukan sync di body effect).
  useEffect(() => {
    if (reducedMotion() || !full) {
      const t = window.setTimeout(() => setTyped(full), 0);
      return () => window.clearTimeout(t);
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [full]);

  return (
    <div className="flex items-start gap-3">
      <span
        className="chip-soft chip-soft-teal h-9 w-9 shrink-0 justify-center"
        aria-hidden="true"
      >
        <Sparkles className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          key={full}
          className="premium-fade-up premium-quote-text"
        >
          &ldquo;{typed}&rdquo;
        </p>
        {quote.author ? (
          <p className="premium-quote-author mt-2">— {quote.author}</p>
        ) : null}
        {quote.translation ? (
          <p className="mt-1 text-xs italic text-muted-foreground/80">{quote.translation}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Ganti kutipan motivasi"
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-all hover:rotate-180 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        style={{ transitionDuration: '0.45s' }}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ── BestWorstTile — tile leaderboard (1-klik ke analisis habit) ───────── */

interface BestWorstTileProps {
  habit: BestWorstHabit;
  tone: 'best' | 'worst';
  /** Dipanggil dengan habit id saat tile diklik (bila id tersedia). */
  onOpen: (habitId: string) => void;
}

export function BestWorstTile({ habit, tone, onOpen }: BestWorstTileProps) {
  const isBest = tone === 'best';
  const habitId = habit.id; // const lokal → narrowing aman di closure
  const tileClass = cn(
    'flex w-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-center',
    isBest
      ? 'border border-primary/15 bg-primary/5 dark:border-primary/20 dark:bg-primary/10'
      : 'border border-orange-500/20 bg-orange-500/5 dark:border-orange-400/20 dark:bg-orange-400/10',
    habitId &&
      'cursor-pointer transition-colors hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:hover:border-primary/40 dark:hover:bg-primary/15',
  );
  const content = (
    <>
      <div
        className={cn(
          'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
          isBest ? 'text-primary' : 'text-orange-600 dark:text-orange-400',
        )}
      >
        {isBest ? (
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
        )}
        {isBest ? 'Performa Terbaik' : 'Perlu Perhatian'}
      </div>
      <span
        className={cn(
          'chip-soft h-11 w-11 justify-center text-xl',
          isBest ? 'chip-soft-teal' : 'chip-soft-amber',
        )}
        aria-hidden="true"
      >
        {habit.icon}
      </span>
      <span className="text-sm font-semibold leading-tight">{habit.name}</span>
      <span
        className={cn(
          'premium-stat text-xl',
          isBest ? 'text-primary' : 'text-orange-600 dark:text-orange-400',
        )}
      >
        {habit.rate}%
      </span>
      {isBest ? (
        <Crown className="h-4 w-4 text-amber-500" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-orange-500" aria-hidden="true" />
      )}
    </>
  );
  // ONE-CLICK (4-a/6-a FIX-1): tile jadi tombol bila API mengirim id habit;
  // tanpa id → div statis (data tidak tersedia).
  if (habitId) {
    return (
      <button
        type="button"
        onClick={() => onOpen(habitId)}
        aria-label={`Lihat analisis waktu habit ${habit.name}`}
        className={tileClass}
      >
        {content}
      </button>
    );
  }
  return <div className={tileClass}>{content}</div>;
}
