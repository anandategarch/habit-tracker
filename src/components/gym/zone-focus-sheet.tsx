'use client';

// ---------------------------------------------------------------------------
// src/components/gym/zone-focus-sheet.tsx — sheet detail zona "Muscle Focus"
// (panel 09 + 03, Task 64, dipecah Task 71 dari gym-screen.tsx).
//
// Dibuka dengan tap zona peta / baris daftar zona. Isi: header zona + chip
// status, rekomendasi, recovery bar, dua lapis waktu (minggu ini vs
// seumur hidup), statistik zona (XP/streak/terakhir), PR zona (V2),
// daftar latihan (preset default ATAU kustom user Task 67 — chip "Kustom"
// + ikon pensil buka editor CRUD; tap baris = catat set aktual Task 74),
// Rekor Pribadi + riwayat jurnal set 30 hari (F3), tombol toggle sesi,
// disclaimer.
// ---------------------------------------------------------------------------

import { Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  MUSCLE_MAP_DISCLAIMER,
  ZONE_STATUS_META,
  lifetimeDefinitionPct,
  recoveryPct,
  recoveryPctLabel,
  recoverySpeedText,
  ymdDaysBetween,
  zoneRecommendation,
  type GymExerciseItem,
  type GymZoneHistoryPayload,
  type GymZonePayload,
  type GymZoneSetsPayload,
  type MuscleZoneStatus,
} from '@/lib/muscle-map';
import { formatWeekShort } from './gym-history';
import { StatusChip } from './gym-status-chip';
import { ZoneExerciseList } from './zone-exercise-list';
import { ZonePrList } from './zone-pr-list';
import { ZoneSetHistory } from './zone-set-history';

/** Baris latihan untuk tampilan — preset boleh membawa chip mapping zona. */
export type GymExerciseView = GymExerciseItem & { mapping?: { label: string; pct: number }[] };

function relativeLastTrained(lastYmd: string | null, todayYmd: string): string {
  if (!lastYmd) return 'Belum pernah';
  const d = ymdDaysBetween(lastYmd, todayYmd);
  if (d <= 0) return 'Hari ini';
  if (d === 1) return 'Kemarin';
  if (d < 7) return `${d} hari lalu`;
  if (d < 30) return `${Math.floor(d / 7)} minggu lalu`;
  return `${Math.floor(d / 30)} bulan lalu`;
}

export function ZoneFocusSheet({
  zone,
  status,
  history,
  exercises,
  customized,
  nowMs,
  recoveryFactor,
  setsPayload,
  busy,
  onToggle,
  onEdit,
  onLogExercise,
  onClose,
}: {
  zone: GymZonePayload | null;
  status: MuscleZoneStatus | null;
  history: GymZoneHistoryPayload | null;
  /** Daftar EFEKTIF zona: kustom tersimpan atau preset default (Task 67). */
  exercises: GymExerciseView[];
  /** true bila zona memakai daftar kustom user. */
  customized: boolean;
  nowMs: number;
  /** Task 72 F1: multiplier pemulihan dari readiness (default 1 = normal). */
  recoveryFactor?: number;
  /** Task 74 F3: jurnal set zona (PR + riwayat) — undefined saat dimuat. */
  setsPayload: GymZoneSetsPayload | undefined;
  busy: boolean;
  onToggle: (zone: GymZonePayload) => void;
  /** Buka editor latihan zona (Task 67). */
  onEdit: () => void;
  /** Buka dialog catat set untuk satu gerakan (Task 74). */
  onLogExercise: (ex: GymExerciseView) => void;
  onClose: () => void;
}) {
  const todayYmd = jakartaDateString();
  const factor = recoveryFactor ?? 1;
  const rec = zone ? recoveryPct(zone, nowMs, factor) : null;
  /** Catatan efek kesiapan hanya bila multiplier menyimpang jelas (Task 72). */
  const showFactorNote = zone !== null && (factor <= 0.95 || factor >= 1.05);
  const lifetime = zone ? lifetimeDefinitionPct(zone.lifetimeSessions) : 0;
  const weeklyPct = zone
    ? Math.min(100, Math.round((zone.sessionsThisWeek / Math.max(1, zone.weeklyTarget)) * 100))
    : 0;

  return (
    <Sheet open={!!zone} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        // Task 70 (audit 70-d MINOR #10): custom-scrollbar pada area scroll sheet.
        className="custom-scrollbar mx-auto flex max-h-[88dvh] w-full flex-col gap-0 overflow-y-auto rounded-t-3xl border-t bg-card p-0 md:max-w-lg md:rounded-3xl"
      >
        {zone && (
          <>
            <SheetHeader className="space-y-1 border-b border-border/70 px-5 pt-5 pb-4">
              <SheetTitle className="flex items-center gap-3 text-left text-base">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                  style={{ background: `${zone.color}1f`, border: `1px solid ${zone.color}55` }}
                  aria-hidden="true"
                >
                  {zone.emoji}
                </span>
                <span className="flex flex-col">
                  <span>{zone.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {zone.sessionsThisWeek} sesi minggu ini
                    {zone.habitName ? ` · ${zone.habitName}` : ''}
                  </span>
                </span>
                {status && <StatusChip status={status} />}
              </SheetTitle>
              <SheetDescription className="text-left text-xs">
                {status ? zoneRecommendation(zone, status, nowMs, factor) : ''}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-5 py-5">
              {/* Recovery (desain #2 — "Dada 62% pulih"). */}
              <section aria-label="Pemulihan zona">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recovery
                  </h3>
                  <span className="text-sm font-bold" style={{ color: ZONE_STATUS_META.recovery.color }}>
                    {recoveryPctLabel(rec)}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={rec ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Pemulihan zona ${zone.label}`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#64e7a0] to-[#13d8bc] transition-[width] duration-500"
                    style={{ width: `${rec ?? 0}%` }}
                  />
                </div>
                {/* Task 72 F1: efek kesiapan harian terhadap pemulihan zona. */}
                {showFactorNote && (
                  <p className="mt-1.5 text-[10px] font-medium text-muted-foreground">
                    {recoverySpeedText(factor)}
                  </p>
                )}
              </section>

              {/* Dua lapis waktu (desain #5). */}
              <section className="grid grid-cols-2 gap-3" aria-label="Progres zona">
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Aktivitas Minggu Ini
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {zone.sessionsThisWeek}
                    <span className="text-sm font-medium text-muted-foreground"> / {zone.weeklyTarget} sesi</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${weeklyPct}%`, background: zone.color }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Definisi Seumur Hidup
                  </p>
                  <p className="mt-1 text-xl font-bold">
                    {lifetime}
                    <span className="text-sm font-medium text-muted-foreground">%</span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {zone.lifetimeSessions} sesi total · tidak pernah reset
                  </p>
                </div>
              </section>

              {/* Statistik ringkas. */}
              <section className="grid grid-cols-3 gap-2 text-center" aria-label="Statistik zona">
                <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">XP minggu ini</p>
                  <p className="text-base font-bold text-primary">+{zone.weeklyZoneXp}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Streak zona</p>
                  <p className="flex items-center justify-center gap-1 text-base font-bold">
                    <Flame className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                    {zone.zoneStreak}h
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Terakhir</p>
                  <p className="text-sm font-bold">{relativeLastTrained(zone.lastSessionYmd, todayYmd)}</p>
                </div>
              </section>

              {/* PR zona (V2 — rekor sepanjang masa, turunan murni). */}
              {history && (history.bestWeekSessions > 0 || history.longestStreakDays >= 2) && (
                <section aria-label="Rekor zona">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rekor Zona
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Rekor sesi/minggu
                      </p>
                      <p className="text-base font-bold text-primary">{history.bestWeekSessions} sesi</p>
                      {history.bestWeekStartYmd && (
                        <p className="text-[9px] text-muted-foreground">
                          mgg {formatWeekShort(history.bestWeekStartYmd)}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Streak terpanjang
                      </p>
                      <p className="flex items-center justify-center gap-1 text-base font-bold">
                        <Flame className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        {history.longestStreakDays} hari
                      </p>
                      <p className="text-[9px] text-muted-foreground">berturut-turut</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Latihan zona (panel 03 + Task 67 CRUD + Task 74 F3: tap
                  baris = catat set aktual; chip 🏆 PR per gerakan). */}
              <ZoneExerciseList
                exercises={exercises}
                customized={customized}
                zoneLabel={zone.label}
                zoneColor={zone.color}
                setsPayload={setsPayload}
                onLog={onLogExercise}
                onEdit={onEdit}
                busy={busy}
              />

              {/* Task 74 F3: rekor pribadi per gerakan (turunan jurnal). */}
              {setsPayload && <ZonePrList zoneKey={zone.key} prs={setsPayload.prs} todayYmd={setsPayload.todayYmd} />}

              {/* Task 74 F3: riwayat jurnal set 30 hari. */}
              {setsPayload && (
                <ZoneSetHistory zoneKey={zone.key} logs={setsPayload.logs} todayYmd={setsPayload.todayYmd} />
              )}

              <Button
                onClick={() => onToggle(zone)}
                disabled={busy || !zone.habitId}
                className="w-full cursor-pointer"
                aria-label={
                  zone.doneToday
                    ? `Batalkan sesi ${zone.label} hari ini`
                    : `Tandai ${zone.label} selesai hari ini`
                }
              >
                {zone.doneToday ? 'Batalkan Sesi Hari Ini' : 'Selesai Latihan Hari Ini'}
              </Button>

              <p className="text-center text-[10px] text-muted-foreground">{MUSCLE_MAP_DISCLAIMER}</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
