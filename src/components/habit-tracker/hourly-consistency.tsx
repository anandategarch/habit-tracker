'use client';

// components/habit-tracker/hourly-consistency.tsx — heatmap "Kapan Paling
// Konsisten?" (PHASE3-HABIT): jam 0–23 dari completedAt (+07:00 Jakarta).
//
// - Data: GET /api/analytics/hourly-consistency?period={periodDays} →
//   { byHour: [{hour, count, rate}], periodStart, periodEnd } (kontrak).
// - Remount internal key={periodDays} → jam terpilih di-reset saat periode
//   dashboard berganti (fix 6-a FIX-11) — queryKey ikut memuat periodDays
//   sehingga data tidak tertukar antar periode.
// - Jam dengan penyelesaian terbanyak terpilih otomatis (derived state,
//   tanpa set-state-in-effect).
// - Empty state premium-empty/orb; error state + tombol "Coba Lagi"
//   (fix 6-a FIX-10).

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChartInfo } from './dashboard-helpers';

interface HourlyPoint {
  hour: number;
  count: number;
  rate: number;
}

interface HourlyPayload {
  byHour?: HourlyPoint[];
  periodStart?: string;
  periodEnd?: string;
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Rate konsisten dibakukan ke 0–100 (tahan payload fraksi 0–1). */
function normalizeRate(rate: unknown): number {
  const n = typeof rate === 'number' && Number.isFinite(rate) ? rate : 0;
  return n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n);
}

export default function HourlyConsistency({ periodDays }: { periodDays: number }) {
  // key remount: state jam terpilih tidak dibawa antar periode.
  return <HourlyConsistencyPanel key={periodDays} periodDays={periodDays} />;
}

function HourlyConsistencyPanel({ periodDays }: { periodDays: number }) {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const { data, isLoading, isError, refetch } = useQuery<HourlyPayload>({
    queryKey: ['hourly-consistency', periodDays, refreshKey],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/hourly-consistency?period=${periodDays}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json as HourlyPayload;
    },
    retry: 1,
  });

  const byHour = useMemo<HourlyPoint[]>(() => {
    const rows: HourlyPoint[] = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, rate: 0 }));
    for (const p of data?.byHour ?? []) {
      if (p && typeof p.hour === 'number' && Number.isInteger(p.hour) && p.hour >= 0 && p.hour < 24) {
        rows[p.hour] = {
          hour: p.hour,
          count: typeof p.count === 'number' && Number.isFinite(p.count) ? p.count : 0,
          rate: normalizeRate(p.rate),
        };
      }
    }
    return rows;
  }, [data]);

  const [userSelectedHour, setUserSelectedHour] = useState<number | null>(null);
  // Jam terpilih = pilihan user, jatuh ke jam dengan penyelesaian
  // terbanyak (derived — tanpa set-state-in-effect; otomatis mengikuti
  // data periode aktif).
  const autoHour = useMemo<number | null>(() => {
    if (byHour.length === 0) return null;
    const best = byHour.reduce((a, b) => (b.count > a.count ? b : a), byHour[0]);
    return best.count > 0 ? best.hour : null;
  }, [byHour]);
  const selectedHour = userSelectedHour ?? autoHour;

  const selected = selectedHour !== null ? byHour[selectedHour] : null;
  const hasData = byHour.some((h) => h.count > 0);

  if (isLoading) {
    return <Skeleton className="h-44 w-full rounded-2xl" />;
  }

  if (isError) {
    return (
      <section aria-label="Konsistensi per jam">
        <div className="premium-card rounded-2xl">
          <div className="premium-empty">
            <div className="premium-empty-orb">
              <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Gagal memuat data konsistensi jam</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Coba Lagi
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Konsistensi per jam">
      <div className="premium-card premium-card-sheen rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="premium-label flex items-center gap-2">
            <span className="chip-soft chip-soft-teal h-8 w-8 justify-center" aria-hidden="true">
              <Clock className="h-4 w-4" />
            </span>
            Kapan Paling Konsisten?
            <ChartInfo
              text={`Seberapa konsisten kamu menyelesaikan habit pada tiap jam (0–23), dihitung dari waktu penyelesaian (waktu Jakarta) selama ${periodDays} hari terakhir. Klik sel jam untuk melihat detailnya.`}
            />
          </h3>
          <span className="premium-label shrink-0">{periodDays} hari</span>
        </div>

        {!hasData ? (
          <div className="premium-empty py-6">
            <div className="premium-empty-orb">
              <Clock className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Belum ada data waktu</p>
            <p className="text-xs text-muted-foreground">
              Selesaikan habit dengan pencatatan waktu untuk melihat pola jam kamu.
            </p>
          </div>
        ) : (
          <>
            <div
              role="group"
              aria-label="Peta konsistensi per jam, 0 sampai 23"
              className="grid grid-cols-12 gap-1.5"
            >
              {byHour.map((h) => {
                const isSelected = selectedHour === h.hour;
                // Intensitas warna aman kontras di light+dark: maks 45% mix
                // dengan teks warna foreground.
                const intensity = Math.min(45, Math.round((h.rate / 100) * 45));
                return (
                  <button
                    key={h.hour}
                    type="button"
                    onClick={() => setUserSelectedHour(h.hour)}
                    aria-pressed={isSelected}
                    aria-label={`Jam ${pad2(h.hour)} — ${h.count} penyelesaian, ${h.rate} persen konsisten`}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-lg border text-[10px] font-semibold tabular-nums transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none',
                      h.count > 0
                        ? 'border-transparent text-foreground'
                        : 'border-border/60 text-muted-foreground',
                      isSelected && 'outline outline-2 -outline-offset-1 outline-primary'
                    )}
                    style={
                      h.count > 0
                        ? { backgroundColor: `color-mix(in oklab, var(--primary) ${intensity}%, transparent)` }
                        : undefined
                    }
                  >
                    {pad2(h.hour)}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
                <span className="premium-label">
                  Jam {pad2(selected.hour)}.00–{pad2(selected.hour)}.59
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {selected.count} penyelesaian
                </span>
                <span className="text-sm font-semibold tabular-nums text-primary">
                  {selected.rate}% konsisten
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
