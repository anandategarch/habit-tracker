'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-screen.tsx — TAB GYM / PETA OTOT (Task 64; dipecah
// jadi komposisi Task 71 — akar komposisi, ≤300 baris).
//
// Layout mengikuti aset desain user (upload/peta-otot/):
//   panel 01 : header + toggle Depan/Belakang + siluet + daftar zona
//              → gym-map-panel.tsx + gym-zone-list.tsx
//   panel 04 : legenda status (6 state zona) → gym-legend.tsx
//   panel 11 : Weekly Mission "X / 6 zona" + banner Balanced Week
//              → gym-weekly-mission.tsx
//   panel 09 : Muscle Focus — sheet detail zona (tap zona/daftar)
//              → zone-focus-sheet.tsx
//   panel 03 : preset gerakan per zona (tanpa alat) → zone-focus-sheet.tsx
//              + exercise-editor.tsx (CRUD Task 67)
//
// Zona selesai = centang habit zona lewat pipa sah (use-gym) → XP pohon
// musim, streak, kalender ikut hidup; Peta Otot MURNI MEMBACA event.
// Semua state & derivasi ada di use-gym-screen-state.ts.
// ---------------------------------------------------------------------------

import { Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { GYM_TAGLINE } from '@/lib/muscle-map';
import { GymIntroCard } from './gym-intro-card';
import { ReadinessCard } from './readiness-card';
import { GymMapPanel } from './gym-map-panel';
import { GymZoneList } from './gym-zone-list';
import { ZoneFocusSheet } from './zone-focus-sheet';
import { GymWeeklyMission } from './gym-weekly-mission';
import { RestTimer } from './rest-timer';
import { GymAchievements, GymWeeklyHistory } from './gym-history';
import { ExerciseEditorDialog } from './exercise-editor';
import { useGymScreenState } from './use-gym-screen-state';

export default function GymScreen() {
  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    setup,
    toggle,
    nowMs,
    view,
    setView,
    focusKey,
    setFocusKey,
    setEditorKey,
    restSuggest,
    clearRestSuggestion,
    toggleElsRef,
    achievementsRef,
    allZones,
    zoneHistoryBy,
    visualsBykey,
    visuals,
    readiness,
    recoveryFactor,
    focusZone,
    focusStatus,
    focusExercises,
    focusCustomized,
    editorZone,
    exercisesFor,
    handleToggle,
  } = useGymScreenState();

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
        <GymIntroCard onSetup={() => setup.mutate()} isPending={setup.isPending} />
      )}

      {/* Task 72 F1 (Gym Cerdas): kesiapan harian — skor tidur/energi/mood,
          multiplier pemulihan + saran zona. Dibaca SEBELUM peta supaya
          status zona di peta langsung terbawa konteksnya. */}
      <ReadinessCard
        readiness={readiness}
        zones={data.zones}
        nowMs={nowMs}
        todayYmd={data.todayYmd}
        onOpenZone={(key) => setFocusKey(key)}
      />

      {/* Peta + daftar zona (panel 01). */}
      {/* grid-cols-1 (minmax(0,1fr)) WAJIB: implicit auto track memaksa
          lebar min-content anak (row zona) → panel melebihi viewport 320px.
          Dengan 1fr, kolom menyusut dan row flex (min-w-0) ikut membungkus. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <GymMapPanel
          view={view}
          onViewChange={setView}
          visuals={visuals}
          pumpOrder={toggle.pump?.order ?? []}
          pumpNonce={toggle.pump?.nonce ?? 0}
          onSelectZone={(key) => setFocusKey(key)}
        />

        {/* Daftar zona + aksi 1-tap. */}
        <GymZoneList
          zones={allZones}
          visualsByKey={visualsBykey}
          busyKey={toggle.isPending ? (toggle.variables?.zone.key ?? null) : null}
          onOpen={(key) => setFocusKey(key)}
          onToggle={(zone) => handleToggle(zone)}
          setToggleEl={(key, el) => toggleElsRef.current.set(key, el)}
        />
      </div>

      {/* Timer istirahat antar set (V2 — desain user: rest timer sederhana,
          saran muncul otomatis setelah zona selesai). */}
      <RestTimer suggestion={restSuggest} onConsumeSuggestion={clearRestSuggestion} />

      {/* Weekly Mission (panel 11) + balance score (desain #4). */}
      <GymWeeklyMission mission={data.mission} balanceScore={data.balanceScore} zones={data.zones} />

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
        recoveryFactor={recoveryFactor}
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
