'use client';

// components/habit-tracker/daily-tracker-view-toggle.tsx — pill segmented
// "Hari Ini | Riwayat" (Calendar merge: nav 6 → 5).
//
// Task 71-c (split god file): DIEKSTRAKSI VERBATIM dari daily-tracker.tsx —
// PREMIUM REDESIGN (Rutina Aurora): premium segmented pill. Plain buttons +
// aria-pressed (not role=tab) so keyboard users can Tab between them
// natively without needing arrow-key handlers.

import type { TrackerViewMode } from '@/store/app-store';

export function TrackerViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: TrackerViewMode;
  onChange: (mode: TrackerViewMode) => void;
}) {
  return (
    <div
      className="premium-segment w-fit"
      role="group"
      aria-label="Mode tampilan tracker"
    >
      <button
        onClick={() => onChange('today')}
        data-active={viewMode === 'today'}
        aria-pressed={viewMode === 'today'}
        className="premium-segment-item"
      >
        Hari Ini
      </button>
      <button
        onClick={() => onChange('history')}
        data-active={viewMode === 'history'}
        aria-pressed={viewMode === 'history'}
        className="premium-segment-item"
      >
        Riwayat
      </button>
    </div>
  );
}
