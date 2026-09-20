'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-zone-list.tsx — panel 01 kanan: daftar zona latihan
// + aksi 1-tap "Tandai selesai" (Task 64, dipecah Task 71).
//
// Setiap baris: tombol detail (buka sheet zona) + tombol centang 1-tap
// (pipa sah useGymToggle → XP pohon musim/streak/kalender ikut hidup;
// Peta Otot murni MEMBACA event). Task 70 (audit 70-d MAJOR #2): toggle
// 44px (WCAG 2.5.5).
//
// grid-cols-1 komentar layout ada di gym-screen.tsx (komposisi grid).
// ---------------------------------------------------------------------------

import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ZONE_STATUS_META, type GymZonePayload, type MuscleZoneKey, type MuscleZoneStatus } from '@/lib/muscle-map';
import type { MuscleZoneVisual } from './muscle-map';
import { StatusChip } from './gym-status-chip';

// ── Baris daftar zona (panel 01 kanan) ──────────────────────────────────────

function ZoneRow({
  zone,
  status,
  busy,
  onOpen,
  onToggle,
  toggleRef,
}: {
  zone: GymZonePayload;
  status: MuscleZoneStatus;
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
  toggleRef: (el: HTMLButtonElement | null) => void;
}) {
  const done = zone.doneToday;
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 transition-colors hover:border-primary/30',
        done && 'border-primary/25 bg-primary/5',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 rounded-lg"
        aria-label={`Detail zona ${zone.label} — ${ZONE_STATUS_META[status].label}`}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
          style={{ background: `${zone.color}1f`, border: `1px solid ${zone.color}55` }}
          aria-hidden="true"
        >
          {zone.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{zone.label}</span>
            <StatusChip status={status} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {zone.sessionsThisWeek} / {zone.weeklyTarget} sesi minggu ini
            {zone.fullBodyContrib > 0 ? ` (termasuk ${zone.fullBodyContrib} Full Body)` : ''}
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        ref={toggleRef}
        onClick={onToggle}
        disabled={busy || !zone.habitId}
        aria-label={done ? `Batalkan sesi ${zone.label} hari ini` : `Tandai ${zone.label} selesai hari ini`}
        className={cn(
          // Task 70 (audit 70-d MAJOR #2): 44px — aksi inti 1-tap memenuhi
          // WCAG 2.5.5 (row flex items-center ikut menyesuaikan tinggi).
          'flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
          done
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-border hover:border-primary/40 hover:bg-primary/10 hover:text-primary',
        )}
      >
        <Check className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Kolom daftar zona ───────────────────────────────────────────────────────

export function GymZoneList({
  zones,
  visualsByKey,
  /** Zona yang mutasinya sedang berjalan (null = tidak ada) → tombol busy. */
  busyKey,
  onOpen,
  onToggle,
  setToggleEl,
}: {
  zones: GymZonePayload[];
  visualsByKey: Map<MuscleZoneKey, MuscleZoneVisual>;
  busyKey: MuscleZoneKey | null;
  onOpen: (key: MuscleZoneKey) => void;
  onToggle: (zone: GymZonePayload) => void;
  setToggleEl: (key: MuscleZoneKey, el: HTMLButtonElement | null) => void;
}) {
  const doneTodayCount = zones.filter((z) => z.doneToday).length;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Zona Latihan
        </h2>
        <p className="text-xs text-muted-foreground">
          {doneTodayCount > 0 ? `${doneTodayCount} zona selesai hari ini` : 'Belum ada sesi hari ini'}
        </p>
      </div>
      {zones.map((zone) => {
        const visual = visualsByKey.get(zone.key);
        return (
          <ZoneRow
            key={zone.key}
            zone={zone}
            status={visual?.status ?? 'idle'}
            busy={busyKey === zone.key}
            onOpen={() => onOpen(zone.key)}
            onToggle={() => onToggle(zone)}
            toggleRef={(el) => setToggleEl(zone.key, el)}
          />
        );
      })}
    </div>
  );
}
