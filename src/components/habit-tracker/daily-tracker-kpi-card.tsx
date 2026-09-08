// ---------------------------------------------------------------------------
// KpiCard — small KPI stat card used in the daily summary row.
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
//
// PREMIUM REDESIGN (Rutina Aurora / Task 2-b): the full pastel card
// backgrounds ("baby app" per VLM critique) are replaced with a clean white
// `.premium-card` (gradient bg + hairline + multi-layer soft shadow) and the
// accent color now lives ONLY in a small tinted `.chip-soft` icon chip.
// Typography: `.premium-label` (editorial small-caps) + `.premium-stat`
// (tabular-nums, tight tracking). Props/API unchanged.
// ---------------------------------------------------------------------------

'use client';

import { cn } from '@/lib/utils';

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  staggerIndex = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  accent: 'green' | 'orange' | 'rose' | 'amber';
  staggerIndex?: number;
}) {
  // Accent → softly tinted icon chip. Map (per design spec):
  //   green → teal    (completed)
  //   orange → amber  (XP)
  //   rose → rose     (streak flame hues)
  //   amber → violet  (level / XP star)
  const accents: Record<string, string> = {
    green: 'chip-soft chip-soft-teal',
    orange: 'chip-soft chip-soft-amber',
    rose: 'chip-soft chip-soft-rose',
    amber: 'chip-soft chip-soft-violet',
  };
  return (
    // Card→div conversion (worklog 2-c anti-pattern): shadcn Card brings the
    // unlayered `.card-shadow-premium` (globals.css §14) which is declared
    // AFTER `.premium-card` (§1) and therefore overrides its multi-layer
    // box-shadow — the card rendered flat. A bare div keeps ONLY the premium
    // treatment; the flex/gap/rounded classes mirror what Card contributed
    // so the layout is pixel-identical.
    <div
      className={cn(
        'group anim-stagger premium-card premium-card-sheen flex flex-col gap-6 rounded-xl p-4',
      )}
      style={{ animationDelay: `${staggerIndex * 60}ms` }}
    >
      <div className="flex items-center gap-2">
        <span className={cn('h-8 w-8', accents[accent])}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="premium-label truncate">{label}</span>
      </div>
      <p className="premium-stat text-2xl mt-3 text-foreground">{value}</p>
      <p className="text-[11px] mt-1 text-muted-foreground">{sub}</p>
    </div>
  );
}
