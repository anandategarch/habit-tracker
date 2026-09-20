'use client';

// components/tree/use-pohon-play.ts — interaksi "menyenangkan" tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) — logika
// state/handler TIDAK berubah (hanya pindah rumah):
//   • Sapaan pohon (swayKey + daun gugur + bisik-bisik + easter egg tap-10)
//   • Penyiraman (animasi tetesan → toast / perayaan sparkle)
//   • Ambience malam Jakarta (hydrate-aman, tick 60 dtk)
//   • safeTimeout — timer dibersihkan saat unmount (Task 59-b4 #3)
// Navigasi (openTrackerDate / setSettingsSection / setActiveTab) dibaca
// langsung dari primitive store — jalur keluar identik dengan sebelumnya.

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { TREE_WHISPERS, type LeafParticle } from './pohon-content';

export interface PohonPlayArgs {
  /** Total rutinitas hari ini (semantik avoid = TIDAK kambuh). */
  todayTotal: number;
  /** Rutinitas selesai hari ini (avoid dihitung terbalik). */
  todayDone: number;
  /** Semua rutinitas hari ini selesai. */
  allWatered: boolean;
  /** YMD hari ini Jakarta (useJakartaToday). */
  todayStr: string;
}

export function usePohonPlay({ todayTotal, todayDone, allWatered, todayStr }: PohonPlayArgs) {
  const openTrackerDate = useAppStore((s) => s.openTrackerDate);
  const setSettingsSection = useAppStore((s) => s.setSettingsSection);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const [swayKey, setSwayKey] = useState(0);
  const [leaves, setLeaves] = useState<LeafParticle[]>([]);
  const [watering, setWatering] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const tapCountRef = useRef(0);
  const leafIdRef = useRef(0);
  const whisperIdxRef = useRef(0);
  // TASK 59-b4 #3: kumpulan id timer animasi/toast — dibersihkan saat
  // unmount. Dulu timer 1150ms handleWater (dan 2200/2400ms celebrating,
  // cleanup daun) tetap hidup melewati unmount: pindah tab di tengah
  // penyiraman → toast "Belum ada rutinitas…" meletus di ATAS tab lain.
  const timersRef = useRef<number[]>([]);
  /** setTimeout yang aman-unmount: id dicatat & dibersihkan saat komponen
   *  lepas — callback (termasuk toast) tidak pernah jalan pasca-unmount. */
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);
  useEffect(
    () => () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    },
    []
  );

  // Ambience malam (hydrate-aman: default siang, dihitung setelah mount).
  const [isNight, setIsNight] = useState(false);
  useEffect(() => {
    const update = () => {
      const hour = Number(
        new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date()),
      );
      setIsNight(hour >= 18 || hour < 6);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  const handleTapTree = useCallback(() => {
    setSwayKey((k) => k + 1);
    tapCountRef.current += 1;

    // Daun gugur — 2-3 lembar tiap sapaan.
    const spawn: LeafParticle[] = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      id: ++leafIdRef.current,
      leftPct: 34 + Math.random() * 32,
      dx: Math.round(-60 + Math.random() * 120),
      durMs: 1900 + Math.round(Math.random() * 900),
      delayMs: Math.round(Math.random() * 120),
      amber: Math.random() < 0.3,
    }));
    setLeaves((prev) => [...prev.slice(-8), ...spawn]);
    const maxDur = Math.max(...spawn.map((l) => l.durMs + l.delayMs));
    safeTimeout(() => {
      setLeaves((prev) => prev.filter((l) => !spawn.some((s) => s.id === l.id)));
    }, maxDur + 150);

    // Easter egg tap ke-10 — rahasia kecil pengguna setia.
    if (tapCountRef.current === 10) {
      toast.success('Rahasia kecil: pohon ini tumbuh dari XP-mu 🌱 terus siram!');
      setCelebrating(true);
      safeTimeout(() => setCelebrating(false), 2200);
      return;
    }
    // Bisik-bisik tiap sapaan ke-4 — rotasi pesan, anti-spam toast.
    if (tapCountRef.current % 4 === 0) {
      toast(TREE_WHISPERS[whisperIdxRef.current % TREE_WHISPERS.length], {
        icon: '🌿',
        duration: 2600,
      });
      whisperIdxRef.current += 1;
    }
  }, [safeTimeout]);

  const handleWater = useCallback(() => {
    if (watering) return;
    setWatering(true);
    safeTimeout(() => {
      setWatering(false);
      if (todayTotal === 0) {
        toast('Belum ada rutinitas untuk disiram hari ini', {
          description: 'Buat rutinitas pertamamu — biji pohon menunggu ditanam.',
          action: {
            label: 'Buat Rutinitas',
            onClick: () => {
              setSettingsSection('habits');
              setActiveTab('settings');
            },
          },
        });
      } else if (allWatered) {
        setCelebrating(true);
        safeTimeout(() => setCelebrating(false), 2400);
        toast.success('Pohonmu minum hari ini! 🌟 Pertumbuhan terjaga.', {
          description: `${todayDone} rutinitas selesai — tetesan jatuh sempurna.`,
        });
      } else {
        toast(`Baru ${todayDone} dari ${todayTotal} tetes hari ini`, {
          description: 'Setiap rutinitas yang kamu selesai meneteskan air untuk pohonmu.',
          action: {
            label: 'Lihat Rutinitas',
            onClick: () => {
              openTrackerDate(todayStr);
            },
          },
        });
      }
    }, 1150);
  }, [watering, todayTotal, todayDone, allWatered, openTrackerDate, todayStr, setSettingsSection, setActiveTab, safeTimeout]);

  return { swayKey, leaves, watering, celebrating, isNight, handleTapTree, handleWater };
}
