'use client';

// ---------------------------------------------------------------------------
// src/components/gym/use-gym-screen-state.ts — state & derivasi layar Gym
// (Task 64, dipecah Task 71 dari gym-screen.tsx).
//
// SEMUA logic state GymScreen (bukan UI): query peta (useGymMap), setup,
// toggle sesi (useGymToggle + saran rest timer), jam hidup 1-menit
// (useNowMs), pandangan Depan/Belakang, zona fokus (sheet), editor latihan
// (Task 67), visual zona turunan (status/fill/opacity/peak), daftar latihan
// EFEKTIF (kustom ?? preset), dan efek perayaan pencapaian baru
// (localStorage + confetti). Hook data use-gym.ts TIDAK diduplikasi —
// file ini hanya menyusunnya untuk satu layar.
//
// gym-screen.tsx tinggal komposisi: hook ini + komponen presentasi.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { burstFromElement } from '@/lib/confetti';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  ZONE_EXERCISE_PRESETS,
  pumpPeakFor,
  zoneStatus,
  zoneVisualFill,
  zoneVisualOpacity,
  type GymZoneHistoryPayload,
  type GymZonePayload,
  type MuscleZoneKey,
} from '@/lib/muscle-map';
import { useGymMap, useGymSetup, useGymToggle } from './use-gym';
import type { RestSuggestion } from './rest-timer';
import type { MuscleZoneVisual } from './muscle-map';
import type { BodyView } from './gym-map-panel';
import type { GymExerciseView } from './zone-focus-sheet';

/** Jam "hidup" — status pump/recovery diturunkan ulang tiap menit. */
function useNowMs(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function useGymScreenState() {
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
  /** Peta elemen tombol toggle per zona — jangkar confetti toggle (dibaca
   *  hanya di event handler handleToggle / ref callback baris zona). */
  const toggleElsRef = useRef(new Map<MuscleZoneKey, HTMLButtonElement | null>());
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
        el: toggleElsRef.current.get(zone.key) ?? null,
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

  return {
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
    editorKey,
    setEditorKey,
    restSuggest,
    clearRestSuggestion: () => setRestSuggest(null),
    toggleElsRef,
    achievementsRef,
    allZones,
    zoneHistoryBy,
    visualsBykey,
    visuals,
    focusZone,
    focusStatus,
    focusExercises,
    focusCustomized,
    editorZone,
    exercisesFor,
    handleToggle,
  };
}
