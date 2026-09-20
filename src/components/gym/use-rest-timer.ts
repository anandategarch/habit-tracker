'use client';

// ---------------------------------------------------------------------------
// src/components/gym/use-rest-timer.ts — TIMER ISTIRAHAT PERSISTEN
// (Task 76 Bonus #1 — dipecah dari rest-timer.tsx supaya UI tetap ramping).
//
// Semua logic timer + PERSISTENSI localStorage:
//   * countdown berbasis DEADLINE jam nyata (ref) — bebas drift, setState
//     hanya terjadi di callback interval (bukan sinkron di efek);
//   * state bermakna (berjalan / jeda / tersisa) disimpan ke localStorage
//     hanya saat TRANSISI (mulai/jeda/lanjut/+15/reset/selesai) — deadline
//     adalah sumber kebenaran, jadi tik 200ms tidak menulis apa pun;
//   * RESTORE di useEffect (bukan render pertama) → bebas hydration mismatch
//     (SSR merender keadaan segar; klien mengganti setelah mount):
//       - berjalan & deadline lewat  → selesai (penyimpanan dibersihkan);
//       - berjalan & masih hidup     → lanjut menghitung (reload / ganti tab /
//                                       navigasi lintas layar tidak memutus);
//       - terjeda                    → tampil terjeda dengan sisa yang sama.
// Timer murni alat bantu — tidak menyentuh data/XP apa pun.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'rutina_rest_timer_v1';

/** Bentuk tersimpan — deadline ms epoch + keadaan transisi terakhir. */
interface PersistedRestTimer {
  v: 1;
  total: number;
  deadlineMs: number;
  running: boolean;
  /** Sisa detik saat terjeda (dipakai hanya bila !running). */
  pausedRemaining: number;
}

function loadPersisted(): PersistedRestTimer | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const p: unknown = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return null;
    const r = p as Record<string, unknown>;
    if (r.v !== 1) return null;
    if (typeof r.total !== 'number' || !Number.isFinite(r.total) || r.total <= 0) return null;
    if (typeof r.deadlineMs !== 'number' || !Number.isFinite(r.deadlineMs)) return null;
    if (typeof r.running !== 'boolean') return null;
    if (typeof r.pausedRemaining !== 'number' || !Number.isFinite(r.pausedRemaining)) return null;
    return { v: 1, total: r.total, deadlineMs: r.deadlineMs, running: r.running, pausedRemaining: r.pausedRemaining };
  } catch {
    // localStorage tak tersedia (private mode) / JSON rusak → anggap kosong.
    return null;
  }
}

function persist(p: PersistedRestTimer | null): void {
  try {
    if (p === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Penyimpanan gagal — timer tetap hidup di memori (fitur best-effort).
  }
}

export interface RestTimerApi {
  total: number;
  remaining: number;
  running: boolean;
  done: boolean;
  start: (secs: number) => void;
  pause: () => void;
  resume: () => void;
  addFifteen: () => void;
  reset: () => void;
}

/** Getar + toast saat hitungan HABIS secara alami (bukan saat restore). */
function announceDone(): void {
  toast.success('Istirahat selesai — waktunya set berikutnya! 💪');
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([120, 70, 120]);
    } catch {
      // perangkat menolak getaran — abaikan
    }
  }
}

export function useRestTimer(): RestTimerApi {
  const [total, setTotal] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  /** Tenggat jam nyata (ms epoch) — sumber kebenaran countdown saat berjalan. */
  const deadlineRef = useRef<number>(Date.now() + 60_000);

  // ── Restore keadaan tersimpan SEKALI setelah mount (aman hydration). ──
  useEffect(() => {
    const p = loadPersisted();
    if (!p) return;
    if (p.running) {
      const secs = Math.max(0, Math.ceil((p.deadlineMs - Date.now()) / 1000));
      deadlineRef.current = p.deadlineMs;
      setTotal(p.total);
      setRemaining(secs);
      if (secs <= 0) {
        // Waktu habis saat aplikasi tertutup → tampil selesai, lupakan.
        setRunning(false);
        setDone(true);
        persist(null);
      } else {
        setDone(false);
        setRunning(true);
      }
    } else if (p.pausedRemaining > 0) {
      setTotal(p.total);
      setRemaining(p.pausedRemaining);
      setDone(false);
      setRunning(false);
    }
    // pausedRemaining 0 / keadaan asing → biarkan segar (penyimpanan basi).
  }, []);

  // ── Tik: hitung sisa detik dari deadline (bebas drift), stop saat habis. ──
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const secs = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        setRunning(false);
        setDone(true);
        persist(null); // selesai → tidak ada yang perlu dipulihkan
        announceDone();
      }
    }, 200);
    return () => clearInterval(id);
  }, [running]);

  const start = (secs: number) => {
    deadlineRef.current = Date.now() + secs * 1000;
    setTotal(secs);
    setRemaining(secs);
    setDone(false);
    setRunning(true);
    persist({ v: 1, total: secs, deadlineMs: deadlineRef.current, running: true, pausedRemaining: secs });
  };

  const pause = () => {
    const secs = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
    setRemaining(secs);
    setRunning(false);
    persist({ v: 1, total, deadlineMs: deadlineRef.current, running: false, pausedRemaining: secs });
  };

  const resume = () => {
    deadlineRef.current = Date.now() + remaining * 1000;
    setRunning(true);
    persist({ v: 1, total, deadlineMs: deadlineRef.current, running: true, pausedRemaining: remaining });
  };

  const addFifteen = () => {
    // Nilai dihitung dari closure handler (satu klik = satu render terkini) —
    // JANGAN taruh mutasi ref/persist di dalam state updater (StrictMode
    // memanggil updater dua kali → deadline bisa +30 dtk).
    const nextTotal = total + 15;
    const nextRemaining = remaining + 15;
    if (running) deadlineRef.current += 15_000;
    setTotal(nextTotal);
    setRemaining(nextRemaining);
    persist({ v: 1, total: nextTotal, deadlineMs: deadlineRef.current, running, pausedRemaining: nextRemaining });
  };

  const reset = () => {
    setRunning(false);
    setDone(false);
    setRemaining(total);
    deadlineRef.current = Date.now() + total * 1000;
    persist({ v: 1, total, deadlineMs: deadlineRef.current, running: false, pausedRemaining: total });
  };

  return { total, remaining, running, done, start, pause, resume, addFifteen, reset };
}
