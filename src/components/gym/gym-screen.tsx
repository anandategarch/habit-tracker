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
import { ProgramTodayCard } from './program-today-card';
import { ProgramPickerDialog } from './program-picker-dialog';
import { ProgramBuilderDialog } from './program-builder-dialog';
import { GymMapPanel } from './gym-map-panel';
import { GymZoneList } from './gym-zone-list';
import { ZoneFocusSheet } from './zone-focus-sheet';
import { GymWeeklyMission } from './gym-weekly-mission';
import { RestTimer } from './rest-timer';
import { CardioCard } from './cardio-card';
import { CardioLogDialog } from './cardio-log-dialog';
import { ProgressPhotoCard } from './progress-photo-card';
import { PhotoCaptureDialog } from './photo-capture-dialog';
import { PhotoViewerDialog } from './photo-viewer-dialog';
import { GymAchievements, GymWeeklyHistory } from './gym-history';
import { ExerciseEditorDialog } from './exercise-editor';
import { ExerciseLogDialog } from './exercise-log-dialog';
import { useGymScreenState } from './use-gym-screen-state';
import type { GymPhotoPose, GymPhotosPayload } from '@/lib/muscle-map';

/** Gerbang dialog Ambil Foto — dipasang bila photos payload siap. Dibuat
 *  komponen kecil supaya gym-screen.tsx tetap komposisi ramping. */
function PhotoCaptureGate({
  open,
  photos,
  initialPose,
  onClose,
}: {
  open: boolean;
  photos: GymPhotosPayload;
  initialPose: GymPhotoPose | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return <PhotoCaptureDialog payload={photos} initialPose={initialPose} onClose={onClose} />;
}

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
    zoneSets,
    // Task 75 F4 — program latihan.
    program,
    programLoading,
    pickerOpen,
    setPickerOpen,
    builderTarget,
    openBuilder,
    closeBuilder,
    logTarget,
    logZone,
    handleLogExercise,
    closeLogExercise,
    suggestRest,
    // Task 76 Bonus — kardio & foto progres.
    cardio,
    cardioLogOpen,
    setCardioLogOpen,
    photos,
    photoCaptureOpen,
    photoCapturePose,
    openPhotoCapture,
    closePhotoCapture,
    photoViewId,
    setPhotoViewId,
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

      {/* Task 75 F4 (Gym Cerdas): Program Hari Ini — split mingguan + strip
          minggu + hint kesiapan. Hanya tampil bila setup zona selesai (tanpa
          habit zona, progres hari latihan tak berarti). Loading → skeleton;
          error → disembunyikan (lapisan opsional). */}
      {data.setupDone &&
        (programLoading ? (
          <div className="h-36 animate-pulse rounded-2xl bg-muted/40" aria-hidden="true" />
        ) : program ? (
          <ProgramTodayCard
            program={program}
            readiness={readiness}
            onOpenZone={(key) => setFocusKey(key)}
            onOpenPicker={() => setPickerOpen(true)}
            onEdit={(p) => openBuilder({ program: p })}
          />
        ) : null)}

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
          saran muncul otomatis setelah zona selesai). Task 76 Bonus: kini
          PERSISTEN — timer berjalan/terjeda bertahan saat pindah layar
          atau reload (deadline jam nyata di localStorage). */}
      <RestTimer suggestion={restSuggest} onConsumeSuggestion={clearRestSuggestion} />

      {/* Task 76 Bonus #2: kardio — statistik minggu + riwayat 30 hari +
          dialog catat sesi. Lapisan opsional (pola program F4). */}
      {cardio && <CardioCard data={cardio} onLog={() => setCardioLogOpen(true)} />}

      {/* Task 76 Bonus #3: foto progres — petak pose + strip riwayat.
          Lapisan opsional (pola program F4). */}
      {photos && (
        <ProgressPhotoCard
          data={photos}
          onAdd={(pose) => openPhotoCapture(pose)}
          onOpen={(id) => setPhotoViewId(id)}
        />
      )}

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
        setsPayload={zoneSets}
        busy={toggle.isPending}
        onToggle={(z) => handleToggle(z)}
        onEdit={() => focusKey && setEditorKey(focusKey)}
        onLogExercise={handleLogExercise}
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

      {/* Task 74 F3: dialog Catat Set — key zone+exercise supaya state
          stepper selalu segar saat gerakan lain dibuka. */}
      {logTarget && logZone && (
        <ExerciseLogDialog
          key={`${logTarget.zone}-${logTarget.exercise.name}`}
          zone={logZone}
          exercise={logTarget.exercise}
          setsPayload={zoneSets}
          onSaved={(suggest) => suggestRest(suggest)}
          onClose={closeLogExercise}
        />
      )}

      {/* Task 75 F4: dialog pilih program (template + tersimpan). */}
      <ProgramPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        saved={program?.saved ?? []}
        onBuildNew={() => openBuilder('new')}
        onEditSaved={(p) => openBuilder({ program: p })}
      />

      {/* Task 75 F4: builder program — key supaya draft selalu segar saat
          program lain dibuka / dibuat ulang. */}
      {builderTarget && (
        <ProgramBuilderDialog
          key={builderTarget === 'new' ? 'new' : builderTarget.program.id}
          target={builderTarget}
          onClose={closeBuilder}
        />
      )}

      {/* Task 76 Bonus #2: dialog catat sesi kardio. */}
      {cardioLogOpen && cardio && (
        <CardioLogDialog key="cardio-log" payload={cardio} onClose={() => setCardioLogOpen(false)} />
      )}

      {/* Task 76 Bonus #3: dialog ambil foto — gate null saat tertutup,
          state pose/preview segar setiap kali dibuka (remount via flag). */}
      {photos && (
        <PhotoCaptureGate
          open={photoCaptureOpen}
          photos={photos}
          initialPose={photoCapturePose}
          onClose={closePhotoCapture}
        />
      )}

      {/* Task 76 Bonus #3: penampil foto penuh. */}
      {photoViewId && (
        <PhotoViewerDialog
          key={photoViewId}
          photoId={photoViewId}
          todayYmd={photos?.todayYmd ?? data.todayYmd}
          onClose={() => setPhotoViewId(null)}
        />
      )}
    </div>
  );
}
