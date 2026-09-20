'use client';

// ---------------------------------------------------------------------------
// src/components/gym/readiness-card.tsx — kartu "Kesiapan Hari Ini"
// (Task 72 F1 — Gym Cerdas).
//
// Komposisi: ring skor (readiness-ring) + headline/body tier + rincian chip
// tidur/energi/mood + efek pemulihan (multiplier) + seksi saran zona
// (readiness-suggestions). Sumber = readiness payload /api/gym (turunan
// DailyLog check-in TERBARU — hari ini, fallback kemarin).
//
// Empty state (readiness null): ajakan mengisi check-in harian — loop
// engagement Tracker ↔ Gym tanpa navigasi paksa (kartu tetap informatif).
// ---------------------------------------------------------------------------

import { Battery, BedDouble, CloudSun, Sparkles } from 'lucide-react';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import {
  READINESS_TIER_META,
  recoverySpeedText,
  suggestZonesForToday,
  type GymReadinessPayload,
  type GymZonePayload,
  type MuscleZoneKey,
} from '@/lib/muscle-map';
import { ReadinessRing } from './readiness-ring';
import { ReadinessSuggestions } from './readiness-suggestions';

function formatSleep(hours: number): string {
  const h = Math.round(hours * 10) / 10;
  return `${h} jam`;
}

/** Chip rincian komponen kesiapan (ikon + label + nilai). */
function BreakdownChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  );
}

export function ReadinessCard({
  readiness,
  zones,
  nowMs,
  todayYmd,
  onOpenZone,
}: {
  readiness: GymReadinessPayload | null;
  /** Zona misi (tanpa Full Body) — bahan saran hari ini. */
  zones: GymZonePayload[];
  nowMs: number;
  todayYmd: string;
  onOpenZone: (key: MuscleZoneKey) => void;
}) {
  // ── Empty state: belum ada check-in hari ini/kemarin → ajakan mengisi.
  if (!readiness) {
    return (
      <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Kesiapan Hari Ini</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Isi check-in harian (mood, energi, tidur) di tab Tracker — Peta Otot akan membaca
              kesiapan latihanmu dan menyesuaikan pemulihan zona. 🧠
            </p>
          </div>
        </div>
      </ScrollReveal>
    );
  }

  const meta = READINESS_TIER_META[readiness.tier];
  const suggestions = suggestZonesForToday(
    zones,
    readiness.tier,
    nowMs,
    todayYmd,
    readiness.recoveryFactor,
  );

  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-4">
        <ReadinessRing score={readiness.score} tier={readiness.tier} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            Kesiapan Hari Ini
            {!readiness.isToday && (
              <span className="ml-1.5 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-muted-foreground">
                check-in kemarin
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-sm font-bold" style={{ color: meta.color }}>
            {meta.emoji} {meta.headline}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.body}</p>
        </div>
      </div>

      {/* Rincian komponen kesiapan (sumber: check-in terbaru). */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <BreakdownChip icon={BedDouble} label="Tidur" value={formatSleep(readiness.sleep)} />
        <BreakdownChip
          icon={Battery}
          label="Energi"
          value={`${Math.round(readiness.energy * 10) / 10}/5`}
        />
        <BreakdownChip
          icon={CloudSun}
          label="Mood"
          value={`${Math.round(readiness.mood * 10) / 10}/5`}
        />
      </div>

      {/* Efek terhadap pemulihan zona (multiplier 0.8–1.1). */}
      <p
        className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium"
        style={{
          borderColor: `${meta.color}40`,
          background: `${meta.color}0d`,
          color: 'hsl(var(--foreground))',
        }}
      >
        {recoverySpeedText(readiness.recoveryFactor)}
      </p>

      {/* Saran zona hari ini (chip → sheet detail zona). */}
      <ReadinessSuggestions suggestions={suggestions} tier={readiness.tier} onOpenZone={onOpenZone} />
    </ScrollReveal>
  );
}
