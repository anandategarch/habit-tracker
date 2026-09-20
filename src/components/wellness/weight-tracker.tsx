'use client';

// ---------------------------------------------------------------------------
// src/components/wellness/weight-tracker.tsx — baris berat badan (Task 73,
// Fase 2): nilai terakhir + delta mingguan + sparkline 30 hari + input inline
// (Catat/Ubah). Input menerima koma/titik desimal (kebiasaan id-ID) dan
// dibulatkan 0,1 kg (clamp 20–300 sama dengan API).
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Check, PencilLine, Scale, X } from 'lucide-react';
import {
  formatDeltaKgId,
  formatKgId,
  WEIGHT_MAX,
  WEIGHT_MIN,
  type WellnessEntry,
  type WeightPoint,
} from '@/lib/wellness';
import { WeightSparkline } from './weight-sparkline';

interface WeightTrackerProps {
  todayValue: WellnessEntry['weightKg'];
  latestKg: number | null;
  latestYmd: string | null;
  delta7Kg: number | null;
  trend: WeightPoint[];
  onSave: (kg: number) => void;
}

/** Parse input desimal bebas koma/titik → number (NaN bila tak valid). */
function parseKgInput(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function WeightTracker({
  todayValue,
  latestKg,
  delta7Kg,
  trend,
  onSave,
}: WeightTrackerProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const recordedToday = todayValue != null;

  const openEditor = () => {
    setDraft((latestKg ?? '').toString().replace('.', ','));
    setEditing(true);
  };

  const parsed = parseKgInput(draft);
  const valid = !Number.isNaN(parsed) && parsed >= WEIGHT_MIN && parsed <= WEIGHT_MAX;

  const save = () => {
    if (!valid) return;
    onSave(Math.round(parsed * 10) / 10);
    setEditing(false);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="premium-label flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Berat
        </p>
        {editing ? (
          <span className="text-[11px] font-medium text-muted-foreground">kg</span>
        ) : (
          <button
            type="button"
            onClick={openEditor}
            aria-label={recordedToday ? 'Ubah berat hari ini' : 'Catat berat badan'}
            className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all active:scale-95 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            {recordedToday ? 'Ubah' : 'Catat'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="72,5"
            aria-label="Berat badan dalam kilogram"
            autoFocus
            className="h-11 w-28 rounded-xl border border-border bg-background px-3 text-sm font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
          <button
            type="button"
            onClick={save}
            disabled={!valid}
            aria-label="Simpan berat badan"
            className="h-11 w-11 grid place-items-center rounded-xl bg-primary/15 text-primary transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="Batal catat berat"
            className="h-11 w-11 grid place-items-center rounded-xl text-muted-foreground transition-all active:scale-90 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="ml-auto hidden text-[11px] text-muted-foreground/70 sm:block">
            {WEIGHT_MIN}–{WEIGHT_MAX} kg
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span
            className={
              'font-display text-base font-semibold tabular-nums ' +
              (latestKg == null ? 'text-muted-foreground/70' : 'text-foreground')
            }
          >
            {latestKg != null ? formatKgId(latestKg) : '—'}
          </span>
          {delta7Kg != null && (
            <span
              className={
                'rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ' +
                (delta7Kg > 0
                  ? 'border-border/60 bg-muted/40 text-foreground/80'
                  : delta7Kg < 0
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border/60 bg-muted/40 text-muted-foreground')
              }
              title="Perubahan berat dalam 7 hari terakhir"
            >
              {formatDeltaKgId(delta7Kg)} · 7 hari
            </span>
          )}
          <span className="ml-auto">
            <WeightSparkline points={trend} />
          </span>
        </div>
      )}

      {!editing && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {latestKg == null
            ? 'Catat sekali sehari (atau seminggu) — trend 30 hari muncul di sini.'
            : trend.length >= 2
              ? `Trend ${trend.length} catatan · ${trend[0].ymd.slice(5)} → ${trend[trend.length - 1].ymd.slice(5)}`
              : 'Tambah catatan lain untuk melihat trend.'}
        </p>
      )}
    </div>
  );
}
