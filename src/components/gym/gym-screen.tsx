'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-screen.tsx — TAB GYM / PETA OTOT (Task 64).
//
// Layout mengikuti aset desain user (upload/peta-otot/):
//   panel 01 : header + toggle Depan/Belakang + siluet + daftar zona
//   panel 04 : legenda status (6 state zona)
//   panel 11 : Weekly Mission "X / 6 zona" + banner Balanced Week
//   panel 09 : Muscle Focus — sheet detail zona (tap zona/daftar)
//   panel 03 : preset gerakan per zona (tanpa alat)
//
// Zona selesai = centang habit zona lewat pipa sah (use-gym) → XP pohon
// musim, streak, kalender ikut hidup; Peta Otot MURNI MEMBACA event.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Dumbbell, Flame, Pencil, Sparkles, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageHeader } from '@/components/ui/page-header';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { cn } from '@/lib/utils';
import { burstFromElement } from '@/lib/confetti';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  GYM_TAGLINE,
  MUSCLE_MAP_DISCLAIMER,
  ZONE_EXERCISE_PRESETS,
  ZONE_STATUS_META,
  exerciseDisplay,
  lifetimeDefinitionPct,
  pumpPeakFor,
  recoveryPct,
  recoveryPctLabel,
  ymdDaysBetween,
  zoneRecommendation,
  zoneStatus,
  zoneVisualFill,
  zoneVisualOpacity,
  type GymExerciseItem,
  type GymZoneHistoryPayload,
  type GymZonePayload,
  type MuscleZoneKey,
  type MuscleZoneStatus,
} from '@/lib/muscle-map';
import { MuscleMap, type MuscleZoneVisual } from './muscle-map';
import { useGymMap, useGymSetup, useGymToggle } from './use-gym';
import { RestTimer, type RestSuggestion } from './rest-timer';
import { GymAchievements, GymWeeklyHistory, formatWeekShort } from './gym-history';
import { ExerciseEditorDialog } from './exercise-editor';

/** Baris latihan untuk tampilan — preset boleh membawa chip mapping zona. */
type GymExerciseView = GymExerciseItem & { mapping?: { label: string; pct: number }[] };

type BodyView = 'front' | 'back';

/** Jam "hidup" — status pump/recovery diturunkan ulang tiap menit. */
function useNowMs(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function relativeLastTrained(lastYmd: string | null, todayYmd: string): string {
  if (!lastYmd) return 'Belum pernah';
  const d = ymdDaysBetween(lastYmd, todayYmd);
  if (d <= 0) return 'Hari ini';
  if (d === 1) return 'Kemarin';
  if (d < 7) return `${d} hari lalu`;
  if (d < 30) return `${Math.floor(d / 7)} minggu lalu`;
  return `${Math.floor(d / 30)} bulan lalu`;
}

// ── Status chip kecil ───────────────────────────────────────────────────────

function StatusChip({ status }: { status: MuscleZoneStatus }) {
  const meta = ZONE_STATUS_META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

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

// ── Sheet detail zona — Muscle Focus (panel 09 + 03) ────────────────────────

function ZoneFocusSheet({
  zone,
  status,
  history,
  exercises,
  customized,
  nowMs,
  busy,
  onToggle,
  onEdit,
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
  busy: boolean;
  onToggle: (zone: GymZonePayload) => void;
  /** Buka editor latihan zona (Task 67). */
  onEdit: () => void;
  onClose: () => void;
}) {
  const todayYmd = jakartaDateString();
  const rec = zone ? recoveryPct(zone, nowMs) : null;
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
                {status ? zoneRecommendation(zone, status, nowMs) : ''}
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

              {/* Latihan zona (panel 03 + Task 67: CRUD fleksibel — ganti/
                  tambah/hapus gerakan lewat editor; "Kustom" bila daftar
                  tersimpan user, chip mapping hanya untuk preset). */}
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
                    aria-label={`Ubah daftar latihan zona ${zone.label}`}
                    // Task 70 (audit 70-d MAJOR #2): 36px (naik dari 32px) +
                    // safety-net CSS coarse-pointer melengkapi ke 44px di
                    // perangkat sentuh; layout baris tetap rapi.
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
                    Belum ada gerakan — ketuk untuk menambah latihan {zone.label} sendiri.
                  </button>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {exercises.map((ex, i) => (
                      <li
                        /* Task 70 (audit 70-b MINOR #2): anti React duplicate
                           key — nama kini bisa divalidasi unik di depan, tapi
                           preset/payload lama tetap aman digabung indeks. */
                        key={`${ex.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{ex.name}</p>
                          <p className="text-xs text-muted-foreground">{exerciseDisplay(ex)}</p>
                        </div>
                        {ex.mapping && (
                          <div className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex" aria-hidden="true">
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
                      </li>
                    ))}
                  </ul>
                )}
              </section>

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

// ── Halaman utama ───────────────────────────────────────────────────────────

export default function GymScreen() {
  // Task 70 (audit 70-d MINOR #5): refetch untuk tombol "Coba Lagi".
  const { data, isLoading, isError, isRefetching, refetch } = useGymMap();
  const setup = useGymSetup();
  const toggle = useGymToggle();
  const nowMs = useNowMs();

  const [view, setView] = useState<BodyView>('front');
  const [focusKey, setFocusKey] = useState<MuscleZoneKey | null>(null);
  /** Task 67: zona yang editor latihannya sedang terbuka (dialog CRUD). */
  const [editorKey, setEditorKey] = useState<MuscleZoneKey | null>(null);
  /** Saran timer istirahat kontekstual (zona yang baru saja selesai). */
  const [restSuggest, setRestSuggest] = useState<RestSuggestion | null>(null);
  const toggleEls = useRef(new Map<MuscleZoneKey, HTMLButtonElement | null>()).current;
  /** Jangkar confetti saat pencapaian baru terbuka. */
  const achievementsRef = useRef<HTMLDivElement>(null);

  const todayYmd = data?.todayYmd ?? jakartaDateString();

  const allZones = useMemo(() => {
    if (!data) return [] as GymZonePayload[];
    return [...data.zones, ...(data.fullBody ? [data.fullBody] : [])];
  }, [data]);

  const zoneHistoryBy = useMemo(() => {
    const map = new Map<MuscleZoneKey, GymZoneHistoryPayload>();
    for (const zh of data?.zoneHistory ?? []) map.set(zh.key, zh);
    return map;
  }, [data?.zoneHistory]);

  const visualsBykey = useMemo(() => {
    const map = new Map<MuscleZoneKey, MuscleZoneVisual>();
    for (const zone of allZones) {
      const status = zoneStatus(zone, nowMs, todayYmd);
      map.set(zone.key, {
        zone,
        status,
        fill: zoneVisualFill(status, zone.color),
        opacity: zoneVisualOpacity(status, zone.lifetimeSessions),
        peak: pumpPeakFor(zone.difficulty),
      });
    }
    return map;
  }, [allZones, nowMs, todayYmd]);

  const visuals = useMemo(() => [...visualsBykey.values()], [visualsBykey]);
  const focusZone = focusKey ? (visualsBykey.get(focusKey)?.zone ?? null) : null;
  const focusStatus = focusKey ? (visualsBykey.get(focusKey)?.status ?? null) : null;

  // ── Task 67: daftar latihan EFEKTIF — kustom tersimpan bila ada baris
  // marker GymExerciseList, selain itu preset default (tanpa alat).
  const exercisesFor = (key: MuscleZoneKey): GymExerciseView[] => {
    if (data?.customizedZones.includes(key)) return data?.exercisesByZone[key] ?? [];
    return ZONE_EXERCISE_PRESETS[key];
  };
  const focusExercises = focusKey ? exercisesFor(focusKey) : [];
  const focusCustomized = focusKey ? (data?.customizedZones.includes(focusKey) ?? false) : false;
  const editorZone = editorKey ? (allZones.find((z) => z.key === editorKey) ?? null) : null;

  const handleToggle = (zone: GymZonePayload) => {
    toggle
      .mutateAsync({
        zone,
        next: !zone.doneToday,
        el: toggleEls.get(zone.key) ?? null,
      })
      .then(() => {
        // V2: saran timer istirahat kontekstual setelah zona selesai.
        if (!zone.doneToday) {
          setRestSuggest({ zoneKey: zone.key, label: zone.label, emoji: zone.emoji });
        }
      })
      .catch(() => {
        /* toast error sudah ditangani onError di hook */
      });
  };

  // V2: perayaan pencapaian BARU — bandingkan pencapaian terbuka dengan
  // daftar yang pernah dilihat (localStorage). Kunjungan pertama hanya
  // menandai (tanpa confetti) supaya riwayat lama tidak disalahrayakan.
  useEffect(() => {
    const achievements = data?.achievements;
    if (!achievements || achievements.length === 0) return;
    const KEY = 'rutina_gym_seen_ach_v1';
    try {
      const raw = window.localStorage.getItem(KEY);
      const firstVisit = raw === null;
      let seen: string[] = [];
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) seen = parsed.filter((x): x is string => typeof x === 'string');
      }
      const unlockedIds = achievements.filter((a) => a.unlocked).map((a) => a.id);
      if (!firstVisit) {
        const fresh = unlockedIds.filter((id) => !seen.includes(id));
        if (fresh.length > 0) {
          for (const id of fresh.slice(0, 3)) {
            const a = achievements.find((x) => x.id === id);
            if (a) toast.success(`Pencapaian baru: ${a.title} ${a.emoji}`);
          }
          burstFromElement(achievementsRef.current, { count: 32, rainbow: true });
        }
      }
      window.localStorage.setItem(KEY, JSON.stringify(unlockedIds));
    } catch {
      // localStorage tidak tersedia (private mode) — perayaan dilewati.
    }
  }, [data?.achievements]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="mm-panel h-40 animate-pulse rounded-2xl" aria-hidden="true" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted/40" aria-hidden="true" />
        <p className="sr-only" role="status">Memuat Peta Otot…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      // Task 70 (audit 70-d MINOR #5): role=alert + tombol Coba Lagi
      // (sebelumnya hanya teks statis tanpa aksi).
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm text-destructive">Gagal memuat Peta Otot.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="cursor-pointer"
        >
          {isRefetching ? 'Mencoba…' : 'Coba Lagi'}
        </Button>
      </div>
    );
  }

  const mission = data.mission;
  const missionPct = mission.total > 0 ? Math.round((mission.touched / mission.total) * 100) : 0;
  const doneTodayCount = allZones.filter((z) => z.doneToday).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Dumbbell}
        eyebrow="Gym di Rumah"
        title="Peta Otot"
        subtitle="Latih tubuhmu, lihat progresnya"
      />

      {/* Banner setup (idempoten — hanya tampil bila habit zona belum ada). */}
      {!data.setupDone && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Bangun Peta Otot-mu</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Buat 7 habit latihan (6 zona + Full Body) — XP & streak ikut pohon musim mingguan.
            </p>
          </div>
          <Button onClick={() => setup.mutate()} disabled={setup.isPending} className="cursor-pointer">
            <Dumbbell className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {setup.isPending ? 'Menyiapkan…' : 'Aktifkan'}
          </Button>
        </div>
      )}

      {/* Peta + daftar zona (panel 01). */}
      {/* grid-cols-1 (minmax(0,1fr)) WAJIB: implicit auto track memaksa
          lebar min-content anak (row zona) → panel melebihi viewport 320px.
          Dengan 1fr, kolom menyusut dan row flex (min-w-0) ikut membungkus. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ScrollReveal className="mm-panel relative overflow-hidden rounded-2xl p-4">
          {/* Toggle Depan/Belakang (aset 01/08).
              Task 70 (audit 70-d MINOR #4 + MAJOR #2): tab ARIA lengkap
              (id + aria-controls + arrow-key) dan min-h 44px touch target. */}
          <div
            className="mx-auto flex w-fit rounded-full bg-[#092238] p-1"
            role="tablist"
            aria-label="Pandangan tubuh"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const next: BodyView = view === 'front' ? 'back' : 'front';
              setView(next);
              document.getElementById(`mm-tab-${next}`)?.focus();
            }}
          >
            {(['front', 'back'] as BodyView[]).map((v) => (
              <button
                key={v}
                id={`mm-tab-${v}`}
                type="button"
                role="tab"
                aria-selected={view === v}
                aria-controls="mm-map-panel"
                onClick={() => setView(v)}
                className={cn(
                  'min-h-[44px] cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  view === v
                    ? 'bg-gradient-to-r from-[#1589ff] to-[#26b8ff] text-white shadow'
                    : 'text-[#a7b8c5] hover:text-[#eef7ff]',
                )}
              >
                {v === 'front' ? 'Depan' : 'Belakang'}
              </button>
            ))}
          </div>

          <div
            className="mx-auto mt-2 max-w-[210px]"
            role="tabpanel"
            id="mm-map-panel"
            aria-labelledby={`mm-tab-${view}`}
          >
            <MuscleMap
              view={view}
              visuals={visuals}
              pumpOrder={toggle.pump?.order ?? []}
              pumpNonce={toggle.pump?.nonce ?? 0}
              onSelectZone={(key) => setFocusKey(key)}
              ariaLabel={`Peta otot tampak ${view === 'front' ? 'depan' : 'belakang'} — ketuk zona untuk detail`}
            />
          </div>

          {/* Legenda status (panel 04). */}
          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
            {(Object.keys(ZONE_STATUS_META) as MuscleZoneStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-[10px] text-[#a7b8c5]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: ZONE_STATUS_META[s].color }}
                  aria-hidden="true"
                />
                {ZONE_STATUS_META[s].label}
              </span>
            ))}
          </div>

          <p className="mt-3 text-center text-[10px] text-[#7a8893]">{MUSCLE_MAP_DISCLAIMER}</p>
        </ScrollReveal>

        {/* Daftar zona + aksi 1-tap. */}
        <div className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Zona Latihan
            </h2>
            <p className="text-xs text-muted-foreground">
              {doneTodayCount > 0 ? `${doneTodayCount} zona selesai hari ini` : 'Belum ada sesi hari ini'}
            </p>
          </div>
          {allZones.map((zone) => {
            const visual = visualsBykey.get(zone.key);
            return (
              <ZoneRow
                key={zone.key}
                zone={zone}
                status={visual?.status ?? 'idle'}
                busy={toggle.isPending && toggle.variables?.zone.key === zone.key}
                onOpen={() => setFocusKey(zone.key)}
                onToggle={() => handleToggle(zone)}
                toggleRef={(el) => toggleEls.set(zone.key, el)}
              />
            );
          })}
        </div>
      </div>

      {/* Timer istirahat antar set (V2 — desain user: rest timer sederhana,
          saran muncul otomatis setelah zona selesai). */}
      <RestTimer
        suggestion={restSuggest}
        onConsumeSuggestion={() => setRestSuggest(null)}
      />

      {/* Weekly Mission (panel 11) + balance score (desain #4). */}
      <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Misi Minggu Ini</h2>
          <p className="text-xs font-medium text-muted-foreground">
            {mission.touched} / {mission.total} zona
            <span className="mx-1.5" aria-hidden="true">·</span>
            Keseimbangan {data.balanceScore}/100
          </p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={missionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Misi zona minggu ini: ${mission.touched} dari ${mission.total}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#64e7a0] to-[#13d8bc] transition-[width] duration-500"
            style={{ width: `${missionPct}%` }}
          />
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {data.zones.map((z) => {
            const done = z.sessionsThisWeek >= 1;
            return (
              <li key={z.key} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: done ? z.color : '#3f4a55' }}
                  aria-hidden="true"
                />
                <span className={cn('truncate', done ? 'text-foreground' : 'text-muted-foreground')}>
                  {z.label}
                </span>
                {done ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="tersentuh" />
                ) : (
                  <span className="sr-only">belum tersentuh</span>
                )}
              </li>
            );
          })}
        </ul>

        {mission.balancedWeek ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
            <Trophy className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Balanced Week! 🏆</p>
              <p className="text-xs text-muted-foreground">
                Semua zona tersentuh minggu ini — tubuhmu seimbang.
              </p>
            </div>
          </div>
        ) : mission.touched >= mission.total - 1 && mission.total > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Tinggal 1 zona lagi untuk Balanced Week!
          </p>
        ) : null}
      </ScrollReveal>

      {/* Riwayat mingguan heatmap 12 minggu + minggu terbaik (V2). */}
      <GymWeeklyHistory data={data} />

      {/* Galeri pencapaian (V2) — jangkar confetti unlock baru. */}
      <div ref={achievementsRef}>
        <GymAchievements achievements={data.achievements} />
      </div>

      <p className="px-1 text-center text-xs text-muted-foreground">{GYM_TAGLINE}</p>

      {/* Muscle Focus (panel 09) — sheet detail zona. */}
      <ZoneFocusSheet
        zone={focusZone}
        status={focusStatus}
        history={focusKey ? (zoneHistoryBy.get(focusKey) ?? null) : null}
        exercises={focusExercises}
        customized={focusCustomized}
        nowMs={nowMs}
        busy={toggle.isPending}
        onToggle={(z) => handleToggle(z)}
        onEdit={() => focusKey && setEditorKey(focusKey)}
        onClose={() => setFocusKey(null)}
      />

      {/* Task 67: editor latihan zona (dialog CRUD fleksibel). Key per zona
          → state selalu diinisialisasi ulang dari daftar efektif terbaru
          saat dibuka (aman terhadap refetch yang berjalan). */}
      {editorZone && (
        <ExerciseEditorDialog
          key={editorZone.key}
          zone={editorZone}
          initial={exercisesFor(editorZone.key)}
          customized={data.customizedZones.includes(editorZone.key)}
          onClose={() => setEditorKey(null)}
        />
      )}
    </div>
  );
}
