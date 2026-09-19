'use client';

// ---------------------------------------------------------------------------
// src/components/gym/rest-timer.tsx — TIMER ISTIRAHAT ANTAR SET (Task 65 V2).
//
// Desain user: "rest timer sederhana + kontekstual". Murni sisi klien:
//   * preset 30/60/90/120 detik (1 ketuk langsung jalan),
//   * ring countdown SVG (transisi 1 dtk linear — halus, bukan animasi hiasan),
//   * jeda/lanjut, +15 detik, reset,
//   * selesai → toast + getar perangkat (bila tersedia),
//   * SARAN KONTEKSTUAL: setelah zona selesai (toggle sukses), pemilik kartu
//     menyarankan "istirahat 60 detik?" — 1 ketuk mulai.
// Implementasi: countdown berbasis DEADLINE jam nyata (ref) — bebas drift
// dan setState hanya terjadi di callback interval (bukan sinkron di efek).
// Tidak menyentuh data/XP apa pun (semata-mata alat bantu antar set).
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Plus, RotateCcw, Timer as TimerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MuscleZoneKey } from '@/lib/muscle-map';

const PRESETS = [30, 60, 90, 120];

export interface RestSuggestion {
  zoneKey: MuscleZoneKey;
  label: string;
  emoji: string;
}

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R;

export function RestTimer({
  suggestion,
  onConsumeSuggestion,
}: {
  suggestion: RestSuggestion | null;
  onConsumeSuggestion: () => void;
}) {
  const [total, setTotal] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  /** Tenggat jam nyata (ms epoch) — sumber kebenaran countdown saat berjalan. */
  const deadlineRef = useRef(Date.now() + 60_000);

  // Tik: hitung sisa detik dari deadline (bebas drift), hentikan saat habis.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const secs = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        setRunning(false);
        setDone(true);
        toast.success('Istirahat selesai — waktunya set berikutnya! 💪');
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([120, 70, 120]);
          } catch {
            // perangkat menolak getaran — abaikan
          }
        }
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
    onConsumeSuggestion();
  };

  const pause = () => {
    setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    setRunning(false);
  };

  const resume = () => {
    deadlineRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };

  const addFifteen = () => {
    setRemaining((r) => r + 15);
    setTotal((t) => t + 15);
    if (running) deadlineRef.current += 15_000;
  };

  const reset = () => {
    setRunning(false);
    setDone(false);
    setRemaining(total);
    deadlineRef.current = Date.now() + total * 1000;
  };

  const progress = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
  const stateLabel = running ? 'berjalan' : done ? 'selesai' : 'siaga';

  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <TimerIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          Timer Istirahat
        </h2>
        <p className="text-xs text-muted-foreground">antar set</p>
      </div>

      {/* Saran kontekstual: zona baru selesai (konsumsi sekali saat timer mulai). */}
      {suggestion && !running && !done && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-2.5">
          <span className="text-base" aria-hidden="true">
            {suggestion.emoji}
          </span>
          <p className="min-w-0 flex-1 text-xs text-foreground">
            Zona <span className="font-semibold">{suggestion.label}</span> baru selesai — istirahat antar set?
          </p>
          <Button
            size="sm"
            onClick={() => start(60)}
            className="h-7 cursor-pointer px-2.5 text-[11px]"
            aria-label="Mulai timer istirahat 60 detik"
          >
            Mulai 60 dtk
          </Button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 sm:gap-6">
        {/* Ring countdown */}
        <div
          className="relative h-24 w-24 shrink-0"
          role="timer"
          aria-label={`Timer istirahat ${fmtSeconds(remaining)} tersisa, ${stateLabel}`}
        >
          <svg viewBox="0 0 96 96" className="h-full w-full" aria-hidden="true">
            <circle cx="48" cy="48" r={RING_R} fill="none" strokeWidth="7" className="stroke-muted" />
            <circle
              cx="48"
              cy="48"
              r={RING_R}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - progress)}
              transform="rotate(-90 48 48)"
              className={cn(
                'transition-[stroke-dashoffset] duration-300 ease-linear',
                done ? 'stroke-emerald-500' : 'stroke-primary',
              )}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-xl font-bold tabular-nums', done && 'text-emerald-500')}>
              {done ? '✓' : fmtSeconds(remaining)}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              {done ? 'selesai' : 'menit:detik'}
            </span>
          </div>
        </div>

        {/* Kontrol */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Preset durasi istirahat">
            {PRESETS.map((secs) => (
              <Button
                key={secs}
                variant="outline"
                size="sm"
                onClick={() => start(secs)}
                aria-label={`Mulai istirahat ${secs} detik`}
                className="h-8 cursor-pointer px-0 text-xs tabular-nums"
              >
                {secs >= 120 ? '2 mnt' : `${secs} dtk`}
              </Button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {running ? (
              <Button
                variant="outline"
                size="sm"
                onClick={pause}
                className="h-8 flex-1 cursor-pointer text-xs"
                aria-label="Jeda timer"
              >
                <Pause className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Jeda
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (done) {
                    start(total);
                    return;
                  }
                  resume();
                }}
                disabled={remaining === 0 && !done}
                className="h-8 flex-1 cursor-pointer text-xs"
                aria-label={done ? 'Ulangi timer' : 'Lanjutkan timer'}
              >
                <Play className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {done ? 'Ulangi' : 'Lanjut'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={addFifteen}
              className="h-8 flex-1 cursor-pointer text-xs"
              aria-label="Tambah 15 detik"
            >
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              15 dtk
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="h-8 w-9 shrink-0 cursor-pointer px-0"
              aria-label="Reset timer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </ScrollReveal>
  );
}
