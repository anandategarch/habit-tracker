'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-history.tsx — V2 (Task 65):
//   * GymWeeklyHistory — heatmap 12 minggu × 7 zona + baris "minggu terbaik".
//   * GymAchievements  — galeri 10 pencapaian (terbuka vs progres).
//
// Semua data adalah LAPISAN TURUNAN dari /api/gym (computeGymHistory —
// murni membaca event HabitLog zona; tidak ada state baru di sisi klien).
// Heatmap memakai warna zona aset user dengan opasitas bertingkat relatif
// target mingguan zona (bukan absolut) — selaras filosofi Balance Score.
// ---------------------------------------------------------------------------

import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { cn } from '@/lib/utils';
import {
  GYM_HISTORY_WEEKS,
  MUSCLE_ZONE_DEF_BY_KEY,
  type GymAchievementPayload,
  type GymMapPayload,
} from '@/lib/muscle-map';

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "2025-08-05" → "5 Agu" (label minggu ringkas). */
export function formatWeekShort(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return ymd;
  const [, m, d] = parts;
  return `${d} ${MONTHS_ID[m - 1] ?? ''}`.trim();
}

/** Opasitas sel relatif target mingguan zona (0/0.25/0.45/0.7/0.9). */
function cellOpacity(sessions: number, weeklyTarget: number): number {
  const ratio = sessions / Math.max(1, weeklyTarget);
  if (ratio >= 1.5) return 0.9;
  if (ratio >= 1) return 0.7;
  if (ratio >= 0.5) return 0.45;
  return 0.25;
}

// ── Heatmap mingguan ─────────────────────────────────────────────────────────

export function GymWeeklyHistory({ data }: { data: GymMapPayload }) {
  const best = data.bestWeek;
  const legendBase = MUSCLE_ZONE_DEF_BY_KEY.fullbody.color; // warna netral untuk legenda

  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">Riwayat Mingguan</h2>
        <p className="text-xs text-muted-foreground">
          {best
            ? `Minggu terbaik: ${best.totalSessions} sesi · ${best.zonesTouched} zona (${formatWeekShort(best.weekStartYmd)})`
            : 'Belum ada riwayat mingguan'}
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {data.zoneHistory.map((zh) => {
          const def = MUSCLE_ZONE_DEF_BY_KEY[zh.key];
          return (
            <div key={zh.key} className="flex items-center gap-1.5">
              <span className="w-11 shrink-0 truncate text-[10px] font-medium text-muted-foreground">
                {zh.label}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-[3px]">
                {zh.cells.map((cell, i) => {
                  const isCurrent = i === GYM_HISTORY_WEEKS - 1;
                  const label = `${zh.label} · minggu ${formatWeekShort(cell.weekStartYmd)}${isCurrent ? ' (minggu ini)' : ''}: ${cell.sessions} sesi`;
                  if (cell.sessions <= 0) {
                    return (
                      <span
                        key={cell.weekStartYmd}
                        aria-hidden="true"
                        title={label}
                        className="aspect-square min-w-0 flex-1 rounded-[3px] bg-muted/70"
                      />
                    );
                  }
                  return (
                    <span
                      key={cell.weekStartYmd}
                      role="img"
                      aria-label={label}
                      title={label}
                      className={cn(
                        'aspect-square min-w-0 flex-1 rounded-[3px]',
                        isCurrent && 'ring-1 ring-inset ring-foreground/25',
                      )}
                      style={{ background: def.color, opacity: cellOpacity(cell.sessions, def.weeklyTarget) }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-[10px] text-muted-foreground">
          12 minggu terakhir · kolom kanan = minggu ini
        </p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-[2px] bg-muted/70" aria-hidden="true" />
            0
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: legendBase, opacity: 0.25 }}
              aria-hidden="true"
            />
            ringan
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: legendBase, opacity: 0.45 }}
              aria-hidden="true"
            />
            setengah
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: legendBase, opacity: 0.7 }}
              aria-hidden="true"
            />
            target
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: legendBase, opacity: 0.9 }}
              aria-hidden="true"
            />
            lebih
          </span>
        </div>
      </div>
    </ScrollReveal>
  );
}

// ── Galeri pencapaian ───────────────────────────────────────────────────────

export function GymAchievements({ achievements }: { achievements: GymAchievementPayload[] }) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Pencapaian Gym</h2>
        <p className="text-xs text-muted-foreground">
          {unlockedCount} / {achievements.length} terbuka
        </p>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {achievements.map((a) => (
          <li
            key={a.id}
            title={`${a.title} — ${a.description}`}
            aria-label={`${a.title}: ${a.description}${a.unlocked ? ' (terbuka)' : `, ${a.progressLabel}`}`}
            className={cn(
              'flex min-w-0 flex-col items-center gap-1 rounded-xl border p-2.5 text-center',
              a.unlocked
                ? 'border-amber-400/40 bg-amber-400/10'
                : 'border-border/60 bg-card/40',
            )}
          >
            <span
              className={cn('text-xl leading-none', !a.unlocked && 'opacity-40 grayscale')}
              aria-hidden="true"
            >
              {a.emoji}
            </span>
            <p className="w-full truncate text-[10px] font-semibold leading-tight">{a.title}</p>
            {a.unlocked ? (
              <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">Terbuka</span>
            ) : (
              <div className="w-full">
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${a.progressPct}%` }}
                  />
                </div>
                <p className="mt-1 w-full truncate text-[9px] text-muted-foreground">{a.progressLabel}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </ScrollReveal>
  );
}
