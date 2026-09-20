'use client';

// ---------------------------------------------------------------------------
// src/components/gym/readiness-suggestions.tsx — seksi "Saran Hari Ini"
// (Task 72 F1): chip zona hasil suggestZonesForToday — tap membuka sheet
// detail zona. Kosong → pesan positif. Presentasi murni, tanpa state.
// ---------------------------------------------------------------------------

import { Dumbbell } from 'lucide-react';
import { suggestionHeadline, type GymZoneSuggestion, type GymReadinessTier } from '@/lib/muscle-map';
import type { MuscleZoneKey } from '@/lib/muscle-map';

export function ReadinessSuggestions({
  suggestions,
  tier,
  onOpenZone,
}: {
  suggestions: GymZoneSuggestion[];
  tier: GymReadinessTier;
  /** Buka sheet detail zona (setFocusKey di gym screen). */
  onOpenZone: (key: MuscleZoneKey) => void;
}) {
  return (
    <section aria-label="Saran latihan hari ini" className="mt-3 border-t border-border/60 pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {suggestionHeadline(tier)}
      </h3>
      {suggestions.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Semua zona yang tersisa masih pemulihan atau target mingguan sudah tercapai. Kerja bagus! 💪
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onOpenZone(s.key)}
                aria-label={`Buka zona ${s.label} — ${s.reason}`}
                className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                style={{ borderColor: `${s.color}55`, background: `${s.color}14` }}
              >
                <span aria-hidden="true" className="text-sm">
                  {s.emoji}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">{s.reason}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Dumbbell className="h-3 w-3 shrink-0" aria-hidden="true" />
        Saran turunan dari target mingguan, recovery zona & kesiapanmu — bukan diagnosis medis.
      </p>
    </section>
  );
}
