'use client';

// ---------------------------------------------------------------------------
// src/components/gym/zone-exercise-list.tsx — daftar latihan zona di dalam
// Zone Focus Sheet (Task 74 F3, diekstrak dari zone-focus-sheet.tsx).
//
// Setiap baris kini TAPPABLE untuk mencatat performa aktual (jurnal set):
//   * chip 🏆 PR gerakan (amount terkuat, satuan sama dengan rencana),
//   * bila sudah tercatat hari ini: ringkasan aktual menggantikan rencana
//     + centang hijau (state "selesai dicatat"),
//   * tap → dialog Catat Set (exercise-log-dialog.tsx).
// Tombol pensil (editor CRUD Task 67) tetap di header seksi.
// ---------------------------------------------------------------------------

import { Check, Pencil, Trophy } from 'lucide-react';
import {
  exerciseDisplay,
  exerciseNameKey,
  type GymExercisePr,
  type GymExerciseUnit,
  type GymSetLogRow,
  type GymZoneSetsPayload,
} from '@/lib/muscle-map';
import type { GymExerciseView } from './zone-focus-sheet';

/** PR gerakan untuk satuan yang sama (beda satuan = beda dimensi rekor). */
function prFor(prs: GymExercisePr[] | undefined, nameKey: string, unit: GymExerciseUnit): GymExercisePr | null {
  if (!prs) return null;
  return prs.find((p) => p.nameKey === nameKey && p.unit === unit) ?? null;
}

/** Catatan hari ini untuk gerakan ini (koreksi/upsert target). */
function todayLogFor(logs: GymSetLogRow[] | undefined, nameKey: string, todayYmd: string): GymSetLogRow | null {
  if (!logs || !todayYmd) return null;
  return logs.find((r) => r.nameKey === nameKey && r.dayKey === todayYmd) ?? null;
}

export function ZoneExerciseList({
  exercises,
  customized,
  zoneLabel,
  zoneColor,
  setsPayload,
  onLog,
  onEdit,
  busy,
}: {
  exercises: GymExerciseView[];
  customized: boolean;
  zoneLabel: string;
  zoneColor: string;
  /** Jurnal set zona (PR + log) — undefined saat masih dimuat. */
  setsPayload: GymZoneSetsPayload | undefined;
  /** Buka dialog catat set untuk gerakan ini. */
  onLog: (ex: GymExerciseView) => void;
  /** Buka editor latihan zona (Task 67). */
  onEdit: () => void;
  busy: boolean;
}) {
  const todayYmd = setsPayload?.todayYmd ?? '';

  return (
    <section aria-label="Latihan zona">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {customized ? 'Latihan Kamu' : 'Latihan Direkomendasikan'}
          {customized && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-primary">
              Kustom
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Ubah daftar latihan zona ${zoneLabel}`}
          // Task 70 (audit 70-d MAJOR #2): 36px + safety-net coarse-pointer.
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {exercises.length === 0 ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 w-full cursor-pointer rounded-lg border border-dashed border-border/60 p-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          Belum ada gerakan — ketuk untuk menambah latihan {zoneLabel} sendiri.
        </button>
      ) : (
        <ul className="mt-2 space-y-2">
          {exercises.map((ex, i) => {
            const nameKey = exerciseNameKey(ex.name);
            const pr = prFor(setsPayload?.prs, nameKey, ex.unit);
            const today = todayLogFor(setsPayload?.logs, nameKey, todayYmd);
            const logged = today !== null && todayYmd !== '';
            return (
              <li key={`${ex.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => onLog(ex)}
                  disabled={busy}
                  aria-label={`Catat set untuk ${ex.name}${pr ? ` — rekor ${pr.bestAmount} ${pr.unit}` : ''}`}
                  className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {logged && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-emerald-500"
                          aria-label="Sudah tercatat hari ini"
                        />
                      )}
                      <span className="truncate">{ex.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {logged && today
                        ? `Hari ini: ${exerciseDisplay({ sets: today.sets, amount: today.amount, unit: today.unit })}`
                        : exerciseDisplay(ex)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {pr && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400"
                        title={`Rekor pribadi: ${pr.bestAmount} ${pr.unit} (${pr.bestSets} set)`}
                      >
                        <Trophy className="h-2.5 w-2.5" aria-hidden="true" />
                        PR {pr.bestAmount}
                      </span>
                    )}
                    {ex.mapping && (
                      <div className="hidden flex-wrap justify-end gap-1 sm:flex" aria-hidden="true">
                        {ex.mapping.map((m) => (
                          <span
                            key={m.label}
                            className="rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                          >
                            {m.label} {m.pct}%
                          </span>
                        ))}
                      </div>
                    )}
                    <span
                      // Panah kecil — indikator tap; warna zona agar baris
                      // tetap "milik" zona ini.
                      className="text-[10px] font-bold opacity-40 transition-opacity group-hover:opacity-90"
                      style={{ color: zoneColor }}
                      aria-hidden="true"
                    >
                      ＋
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        Ketuk gerakan untuk mencatat set yang benar-benar kamu kerjakan.
      </p>
    </section>
  );
}
