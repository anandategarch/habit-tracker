// ---------------------------------------------------------------------------
// DailyCheckInCard — 1-tap input for mood / energy / sleep (DailyLog fields).
//
// WAVE1 Task 9-a: the dashboard + calendar render mood & sleep stats, but no
// UI ever wrote them — every day silently showed the server's create-defaults
// (mood 3 / energy 3 / sleep 7). This card closes that gap.
//
// Dumb component by design (same pattern as HabitCard): values + change
// callbacks are passed in from the daily-tracker orchestrator, which owns the
// ['daily-logs', date] query, the optimistic draft, and the POST partial
// updates (the /api/daily-logs upsert only touches fields it receives).
//
// "Belum diisi" honesty: when the parent passes null, NO option renders as
// pressed (a missing row must not look like mood 3 / sleep 7 was chosen).
//
// PREMIUM (Rutina Aurora): bare div.premium-card host (never the shadcn Card
// component — its unlayered .card-shadow-premium would flatten the multi-layer
// premium shadow, see worklog 2-a/2-c), chip-soft header, premium-label group
// captions, premium-stat sleep figure.
// ---------------------------------------------------------------------------

'use client';

import { memo } from 'react';
import { HeartPulse, Zap, Moon, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MOOD_EMOJIS, MOOD_LABELS, ENERGY_LABELS } from '@/lib/mood';

const LEVELS = [1, 2, 3, 4, 5] as const;

/** Indonesian decimal comma ("7.5" → "7,5") for the sleep display. */
function formatSleepHours(v: number): string {
  return v.toFixed(1).replace('.', ',');
}

export interface DailyCheckInCardProps {
  /** Mood level 1-5, or null when the day's log has no row yet. */
  mood: number | null;
  /** Energy level 1-5, or null when the day's log has no row yet. */
  energy: number | null;
  /** Sleep hours (0-14, 0.5 steps), or null when the day's log has no row yet. */
  sleep: number | null;
  onSetMood: (value: number) => void;
  onSetEnergy: (value: number) => void;
  onSetSleep: (value: number) => void;
}

export const DailyCheckInCard = memo(function DailyCheckInCard({
  mood,
  energy,
  sleep,
  onSetMood,
  onSetEnergy,
  onSetSleep,
}: DailyCheckInCardProps) {
  // Sleep stepper bounds (UI clamps to a sane human range; the schema allows
  // 0-24 but 14h is beyond any useful daily entry).
  const SLEEP_MIN = 0;
  const SLEEP_MAX = 14;
  const SLEEP_STEP = 0.5;

  const sleepPlus = () => {
    // First tap on an unset day starts at 7h (the same default the API uses
    // when it creates the row) — tapping from 0 five hundred times would be
    // hostile. Going below 7 is still easy: tap + then −.
    const base = sleep == null ? SLEEP_STEP * 14 : sleep + SLEEP_STEP;
    onSetSleep(Math.min(SLEEP_MAX, Math.round(base * 2) / 2));
  };
  const sleepMinus = () => {
    if (sleep == null) return;
    onSetSleep(Math.max(SLEEP_MIN, Math.round((sleep - SLEEP_STEP) * 2) / 2));
  };

  return (
    <section
      aria-label="Check-in harian: mood, energi, dan tidur"
      className="premium-card premium-card-sheen rounded-2xl p-4 anim-stagger"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="chip-soft chip-soft-violet h-7 w-7">
          <HeartPulse className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Check-in Harian</h3>
        <span className="ml-auto text-[11px] text-muted-foreground/70">
          {mood == null && energy == null && sleep == null
            ? 'Belum diisi'
            : 'Tersimpan otomatis'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-3">
        {/* ── Mood (1-tap emoji, 1-5) ── */}
        <div>
          <p className="premium-label mb-2">Mood</p>
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="Pilih mood hari ini"
          >
            {LEVELS.map((level) => {
              const selected = mood === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Mood: ${MOOD_LABELS[level]}`}
                  title={`Mood: ${MOOD_LABELS[level]}`}
                  onClick={() => onSetMood(level)}
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center text-xl',
                    'transition-all duration-150 active:scale-90',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    selected
                      ? 'bg-primary/15 ring-2 ring-primary/60 shadow-sm scale-105'
                      : 'bg-muted/60 hover:bg-accent hover:scale-105',
                  )}
                >
                  <span aria-hidden="true">{MOOD_EMOJIS[level]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Energi (1-tap chip, 1-5) ── */}
        <div>
          <p className="premium-label mb-2">Energi</p>
          <div
            className="flex items-center gap-1.5"
            role="group"
            aria-label="Pilih energi hari ini"
          >
            {LEVELS.map((level) => {
              const selected = energy === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Energi: ${ENERGY_LABELS[level]}`}
                  title={`Energi: ${ENERGY_LABELS[level]}`}
                  onClick={() => onSetEnergy(level)}
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center gap-0.5',
                    'transition-all duration-150 active:scale-90',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    selected
                      ? 'bg-primary/15 ring-2 ring-primary/60 shadow-sm scale-105 text-foreground'
                      : 'bg-muted/60 hover:bg-accent hover:scale-105 text-muted-foreground',
                  )}
                >
                  <Zap
                    className={cn(
                      'h-3.5 w-3.5',
                      selected ? 'text-amber-500' : 'text-muted-foreground/70',
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold tabular-nums">
                    {level}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tidur (stepper − 0,5 +) ── */}
        <div>
          <p className="premium-label mb-2">Tidur</p>
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Atur jam tidur"
          >
            <button
              type="button"
              onClick={sleepMinus}
              disabled={sleep == null || sleep <= SLEEP_MIN}
              aria-label="Kurangi jam tidur setengah jam"
              title="Kurangi 0,5 jam"
              className={cn(
                'h-11 w-11 shrink-0 rounded-full border border-border/70',
                'flex items-center justify-center bg-muted/60 hover:bg-accent',
                'text-foreground transition-all duration-150 active:scale-90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              <Minus className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0 text-center">
              {sleep == null ? (
                <span className="text-sm font-medium text-muted-foreground/70">
                  Belum diisi
                </span>
              ) : (
                <span className="premium-stat text-lg">
                  {formatSleepHours(sleep)}
                  <span className="ml-1 text-xs font-semibold text-muted-foreground">
                    jam
                  </span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={sleepPlus}
              disabled={sleep != null && sleep >= SLEEP_MAX}
              aria-label="Tambah jam tidur setengah jam"
              title="Tambah 0,5 jam"
              className={cn(
                'h-11 w-11 shrink-0 rounded-full border border-border/70',
                'flex items-center justify-center bg-muted/60 hover:bg-accent',
                'text-foreground transition-all duration-150 active:scale-90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              <Plus className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
});
