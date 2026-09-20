'use client';

// ---------------------------------------------------------------------------
// src/components/gym/program-today-card.tsx — kartu "PROGRAM HARI INI"
// (Task 75 F4 — Gym Cerdas).
//
// Composisi: header program (emoji, nama, chip "Minggu ke-N", menu ⋯) +
// panel hari ini (judul hari + chip zona tappable → sheet zona — selesai
// zona tetap lewat pipa sah toggle di sheet/daftar; PR lewat dialog Catat
// Set F3) + panel istirahat (hari tanpa latihan + berikutnya) + hint
// kesiapan F1 (tier Rendah → saran dengarkan tubuh) + strip minggu
// (program-week-strip) + ringkasan statistik minggu.
//
// Empty state (belum ada program aktif): CTA "Pilih Program" → picker.
// Progres MURNI dibaca dari HabitLog zona (prinsip Peta Otot) — kartu ini
// tidak mengubah XP/streak apa pun.
// ---------------------------------------------------------------------------

import { CalendarCheck, ChevronRight, MoreHorizontal, Sparkles } from 'lucide-react';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  MUSCLE_ZONE_DEF_BY_KEY,
  dowLabelFull,
  type GymProgramPayload,
  type GymProgramSaved,
  type GymReadinessPayload,
  type MuscleZoneKey,
} from '@/lib/muscle-map';
import { ProgramWeekStrip } from './program-week-strip';
import { useGymProgramStop } from './use-gym-program';

/** Teks latihan berikutnya setelah hari ini ("Rabu — Pull — Punggung & Lengan"). */
function nextWorkoutText(program: GymProgramPayload): string | null {
  const active = program.active;
  if (!active) return null;
  const future = active.week.find((e) => e.isFuture && e.zones.length > 0);
  if (future?.title) return `${dowLabelFull(future.dow)} — ${future.title}`;
  // Sisa minggu kosong → hari pertama program muncul lagi minggu depan.
  const row = program.saved.find((p) => p.id === active.id);
  const first = row?.days[0];
  return first ? `${dowLabelFull(first.dow)} — ${first.title}` : null;
}

/** Chip zona hari ini — tap membuka sheet zona (toggle + catat set). */
function ZoneChip({
  zoneKey,
  done,
  onOpen,
}: {
  zoneKey: MuscleZoneKey;
  done: boolean;
  onOpen: (key: MuscleZoneKey) => void;
}) {
  const def = MUSCLE_ZONE_DEF_BY_KEY[zoneKey];
  if (!def) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(zoneKey)}
      aria-label={`Buka zona ${def.label}${done ? ' (sudah selesai hari ini)' : ''}`}
      className={cn(
        'group inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        done
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border/70 bg-card/40 text-foreground hover:border-primary/40 hover:bg-primary/5',
      )}
    >
      <span aria-hidden="true">{done ? '✅' : def.emoji}</span>
      <span>{def.label}</span>
      <ChevronRight
        className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-80"
        aria-hidden="true"
      />
    </button>
  );
}

export function ProgramTodayCard({
  program,
  readiness,
  onOpenZone,
  onOpenPicker,
  onEdit,
}: {
  program: GymProgramPayload;
  /** null bila belum check-in — hint kesiapan disembunyikan. */
  readiness: GymReadinessPayload | null;
  onOpenZone: (key: MuscleZoneKey) => void;
  onOpenPicker: () => void;
  /** Buka builder untuk mengubah program aktif. */
  onEdit: (program: GymProgramSaved) => void;
}) {
  const stop = useGymProgramStop();
  const active = program.active;

  // ── Empty state: belum ada program aktif → ajakan memilih. ──
  if (!active) {
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
            <h2 className="text-sm font-semibold">Program Latihan — Baru! 🗓</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ikuti split mingguan (atau buat sendiri) — app mengingatkan hari latihan &
              istirahatmu, progresnya terbaca otomatis dari Peta Otot.
            </p>
          </div>
        </div>
        <Button
          onClick={onOpenPicker}
          className="mt-3 w-full cursor-pointer"
          size="sm"
        >
          <CalendarCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Pilih Program
        </Button>
      </ScrollReveal>
    );
  }

  const today = active.today;
  const stats = active.stats;
  const activeRow = program.saved.find((p) => p.id === active.id) ?? null;
  const lowReadiness = today && !today.done && readiness?.tier === 'rendah';

  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      {/* Header program + menu. */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-xl"
          aria-hidden="true"
        >
          {active.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            Program Latihan
            <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Minggu ke-{active.weekNumber}
            </span>
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{active.name}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu program"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpenPicker} className="cursor-pointer">
              Ganti / pilih program…
            </DropdownMenuItem>
            {activeRow && (
              <DropdownMenuItem onClick={() => onEdit(activeRow)} className="cursor-pointer">
                Ubah jadwal program…
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => stop.mutate()}
              disabled={stop.isPending}
              className="cursor-pointer text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-400"
            >
              Hentikan program
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Panel hari ini. */}
      {today ? (
        <div
          className={cn(
            'mt-3 rounded-xl border p-3',
            today.done
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-border/60 bg-card/40',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hari ini · {dowLabelFull(today.dow)}
          </p>
          <p className="mt-0.5 text-sm font-bold">
            {today.done ? '✅ ' : ''}
            {today.title}
          </p>
          {today.done ? (
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Hari latihan selesai — semua zona tercentang! 🎉
            </p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {today.zones.map((z) => (
                  <ZoneChip
                    key={z}
                    zoneKey={z}
                    done={today.zoneDone.includes(z)}
                    onOpen={onOpenZone}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground" role="status">
                {today.zoneDone.length}/{today.zones.length} zona selesai — ketuk zona
                untuk mencatat set (F3) & menandai selesai.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-card/30 p-3">
          <p className="text-sm font-bold">😌 Hari istirahat</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pemulihan adalah bagian dari program.
            {nextWorkoutText(program) ? ` Berikutnya: ${nextWorkoutText(program)}.` : ''}
          </p>
        </div>
      )}

      {/* Hint kesiapan F1 — hanya saat hari latihan belum tuntas & tier Rendah. */}
      {lowReadiness && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium">
          🐢 Kesiapan hari ini <strong>Rendah</strong> — dengarkan tubuhmu: boleh kurangi
          set, pilih varian ringan, atau tunda ke hari bebas berikutnya.
        </p>
      )}

      {/* Strip minggu + statistik. */}
      <ProgramWeekStrip week={active.week} className="mt-3" />
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Minggu ini: {stats.done} selesai · {stats.missed} terlewat · {stats.upcoming}{' '}
        menunggu
        {stats.adherencePct !== null && ` · kepatuhan ${stats.adherencePct}%`}
      </p>
    </ScrollReveal>
  );
}
