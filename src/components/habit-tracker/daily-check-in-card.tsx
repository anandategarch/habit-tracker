'use client';

// components/habit-tracker/daily-check-in-card.tsx — GELOMBANG 1 (baru).
//
// Check-in harian: mood (1..5), energi (1..5), tidur (stepper 0,5 jam).
//  - Emoji dari lib/mood.ts (MOOD_EMOJIS / ENERGY_EMOJIS) — single source.
//  - Optimistic UI: tombol langsung ter-press sebelum server konfirmasi.
//  - Simpan via promise-chain (BUKAN paralel) — bila user mengubah mood →
//    energi → tidur beruntun dalam <1 detik, ketiga PATCH dikirim berurutan
//    (FIFO) sehingga upsert per-tanggal tidak saling menimpa.
//  - Baris DailyLog belum ada → label jujur "Belum diisi" + nilai default
//    (mood 3 / energi 3 / tidur 7 jam) tampil abu-abu; menekan tombol apa
//    pun membuat barisnya (upsert partial).
//  - Tanpa setState dalam effect (aturan react-hooks): sinkronisasi nilai
//    server dilakukan lewat key-remount parent
//    (`key = tanggal|row/none`) — draft optimistic TIDAK ter-reset saat
//    refetch biasa (row → row), hanya saat tanggal / kehadiran baris
//    berubah. Rollback saat gagal simpan memakai serverValueRef.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HeartPulse, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MOOD_EMOJIS, ENERGY_EMOJIS } from '@/lib/mood';
import { jakartaDateString } from '@/lib/timezone';
import { saveDailyLog } from './daily-tracker-helpers';

export interface CheckInValue {
  mood: number;
  energy: number;
  sleep: number;
}

interface DailyCheckInCardProps {
  /** 'yyyy-MM-dd' Jakarta. */
  date: string;
  /** Nilai tersimpan (null = baris belum ada / masih dimuat). */
  value: CheckInValue | null;
}

interface Draft {
  mood: number | null;
  energy: number | null;
  sleep: number | null;
}

const MOOD_LABELS: Record<number, string> = {
  1: 'Mood sangat buruk',
  2: 'Mood buruk',
  3: 'Mood biasa',
  4: 'Mood baik',
  5: 'Mood sangat baik',
};

const ENERGY_LABELS: Record<number, string> = {
  1: 'Energi sangat lemah',
  2: 'Energi lemah',
  3: 'Energi biasa',
  4: 'Energi kuat',
  5: 'Energi sangat kuat',
};

const SLEEP_MIN = 0;
const SLEEP_MAX = 12;
const SLEEP_STEP = 0.5;

const DEFAULTS: CheckInValue = { mood: 3, energy: 3, sleep: 7 };

function formatSleep(hours: number): string {
  // Format Indonesia: koma desimal ("7,5 jam").
  return `${hours.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} jam`;
}

export function DailyCheckInCard({ date, value }: DailyCheckInCardProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => ({
    mood: value?.mood ?? null,
    energy: value?.energy ?? null,
    sleep: value?.sleep ?? null,
  }));

  // Nilai server terakhir — untuk rollback bila simpan gagal. Hanya mutasi
  // ref (bukan setState) → bebas aturan set-state-in-effect.
  const serverValueRef = useRef<CheckInValue | null>(value);
  useEffect(() => {
    serverValueRef.current = value;
  }, [value]);

  // Promise-chain FIFO untuk semua penyimpanan — perubahan beruntun dikirim
  // berurutan, bukan Promise.all.
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueSave = useCallback(
    (patch: { mood?: number; energy?: number; sleep?: number }) => {
      saveChainRef.current = saveChainRef.current
        .then(async () => {
          const res = await saveDailyLog({ date, ...patch });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        })
        .then(() => {
          // Segarkan cache daily-logs (dipakai notes/panel lain) — key-remount
          // tidak terpicu karena kehadiran baris tidak berubah.
          void queryClient.invalidateQueries({ queryKey: ['daily-logs', date] });
        })
        .catch(() => {
          toast.error('Gagal menyimpan check-in');
          // Rollback ke nilai server terakhir yang diketahui.
          const server = serverValueRef.current;
          setDraft({
            mood: server?.mood ?? null,
            energy: server?.energy ?? null,
            sleep: server?.sleep ?? null,
          });
        });
    },
    [date, queryClient],
  );

  const guardFuture = useCallback((): boolean => {
    if (date > jakartaDateString()) {
      // Pesan standar guard tanggal masa depan (konsisten dengan toggle habit).
      toast.error('Tidak bisa mencatat habit untuk tanggal yang akan datang');
      return false;
    }
    return true;
  }, [date]);

  const handleMood = (mood: number) => {
    if (!guardFuture()) return;
    setDraft((p) => (p.mood === mood ? p : { ...p, mood }));
    enqueueSave({ mood });
  };

  const handleEnergy = (energy: number) => {
    if (!guardFuture()) return;
    setDraft((p) => (p.energy === energy ? p : { ...p, energy }));
    enqueueSave({ energy });
  };

  const handleSleep = (delta: number) => {
    if (!guardFuture()) return;
    const base = draft.sleep ?? DEFAULTS.sleep;
    const next =
      Math.round(Math.min(SLEEP_MAX, Math.max(SLEEP_MIN, base + delta)) * 2) / 2;
    if (next === draft.sleep) return;
    setDraft((p) => (p.sleep === next ? p : { ...p, sleep: next }));
    enqueueSave({ sleep: next });
  };

  // Nilai efektif: draft bila sudah diisi, default (abu-abu) bila belum.
  const effMood = draft.mood ?? DEFAULTS.mood;
  const effEnergy = draft.energy ?? DEFAULTS.energy;
  const effSleep = draft.sleep ?? DEFAULTS.sleep;
  const filled = draft.mood != null || draft.energy != null || draft.sleep != null;

  return (
    <section
      className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 premium-fade-up"
      aria-label="Check-in harian"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span className="chip-soft chip-soft-teal h-8 w-8" aria-hidden="true">
          <HeartPulse className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold">Check-in Harian</h3>
        <span
          className={
            'ml-auto text-[11px] font-medium ' +
            (filled ? 'text-muted-foreground' : 'text-muted-foreground/70')
          }
        >
          {filled ? 'Tersimpan otomatis' : 'Belum diisi'}
        </span>
      </div>

      <div className="space-y-3.5">
        {/* ── Mood ── */}
        <div className="flex items-center justify-between gap-3">
          <span className="premium-label shrink-0 w-14">Mood</span>
          <div
            className="flex items-center gap-1 sm:gap-1.5"
            role="group"
            aria-label="Pilih mood hari ini"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const active = effMood === n;
              const grayed = active && draft.mood == null;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleMood(n)}
                  aria-label={MOOD_LABELS[n]}
                  aria-pressed={active}
                  className={
                    'h-9 w-9 rounded-xl text-lg grid place-items-center transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ' +
                    (active
                      ? 'bg-primary/15 ring-2 ring-primary/40 scale-105 ' +
                        (grayed ? 'opacity-50 ' : '')
                      : 'hover:bg-muted')
                  }
                >
                  <span aria-hidden="true">{MOOD_EMOJIS[n]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Energi ── */}
        <div className="flex items-center justify-between gap-3">
          <span className="premium-label shrink-0 w-14">Energi</span>
          <div
            className="flex items-center gap-1 sm:gap-1.5"
            role="group"
            aria-label="Pilih energi hari ini"
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const active = effEnergy === n;
              const grayed = active && draft.energy == null;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleEnergy(n)}
                  aria-label={ENERGY_LABELS[n]}
                  aria-pressed={active}
                  className={
                    'h-9 w-9 rounded-xl text-lg grid place-items-center transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ' +
                    (active
                      ? 'bg-primary/15 ring-2 ring-primary/40 scale-105 ' +
                        (grayed ? 'opacity-50 ' : '')
                      : 'hover:bg-muted')
                  }
                >
                  <span aria-hidden="true">{ENERGY_EMOJIS[n]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tidur (stepper 0,5 jam) ── */}
        <div className="flex items-center justify-between gap-3">
          <span className="premium-label shrink-0 w-14">Tidur</span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSleep(-SLEEP_STEP)}
              aria-label="Kurangi tidur setengah jam"
              className="h-9 w-9 rounded-xl grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
              disabled={draft.sleep != null && draft.sleep <= SLEEP_MIN}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span
              className={
                'text-sm font-semibold tabular-nums min-w-[64px] text-center ' +
                (draft.sleep == null ? 'text-muted-foreground/70' : 'text-foreground')
              }
              aria-label={`Tidur ${formatSleep(effSleep)}`}
            >
              {formatSleep(effSleep)}
            </span>
            <button
              type="button"
              onClick={() => handleSleep(SLEEP_STEP)}
              aria-label="Tambah tidur setengah jam"
              className="h-9 w-9 rounded-xl grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
              disabled={draft.sleep != null && draft.sleep >= SLEEP_MAX}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
