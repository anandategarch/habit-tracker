'use client';

// components/habit-tracker/today-hero.tsx — Task 44 "Today is the Hero".
//
// Hero Beranda versi baru (menggantikan GreetingHero yang hanya menampilkan
// sapaan + % mentah). Prinsip brief Fabulous-inspired:
//   1. EMOTIONAL FIRST — sapaan personal (userName dari /api/dashboard),
//      tanggal, dan NARASI progres ("4 dari 6 rutinitas") — bukan angka KPI.
//   2. PROGRESS TERASA HIDUP — TreeProgress (signature Rutina) tumbuh
//      mengikuti progres hari ini di sisi kanan; bar besar + pesan kontekstual.
//   3. GAMIFIKASI ORGANIK — streak & level sebagai chip kecil + mini bar
//      (bukan HUD): "🔥 12 hari" + "Level 7 · 78%".
//
// Surface tier 1 (hero). Logika data murni props — tidak ada fetch di sini.

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { TreeProgress } from '@/components/ui/loaders';
import { CountUpNumber } from './count-up';
import { jakartaDateString } from '@/lib/jakarta-date';
import { jakartaNowParts } from '@/lib/timezone';

interface TodayHeroProps {
  /** Nama user dari greeting API ('' → sapaan generik). */
  userName: string;
  /** Habit selesai hari ini. */
  completed: number;
  /** Total habit terjadwal hari ini. */
  total: number;
  /** Streak global berjalan (hari). */
  currentStreak: number;
  /** Level saat ini. */
  level: number;
  /** Progres XP menuju level berikutnya (0–100). */
  levelProgress: number;
  // CONNECTED-APP — setiap elemen penting hero punya konteks lanjutan:
  onOpenToday?: () => void; // blok progres "X dari Y" → Tracker hari ini
  onOpenHistory?: () => void; // chip streak → Riwayat/kalender habit
  onOpenProgress?: () => void; // chip level → tab Progres (XP/Level)
}

/** Sapaan waktu-sadar Jakarta — jam dinding, bukan jam server. */
function useJakartaGreeting(): { greeting: string; dateLabel: string } {
  const [, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMinuteTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (typeof window === 'undefined') {
    return { greeting: 'Selamat datang', dateLabel: '' };
  }
  const { hour } = jakartaNowParts();
  const greeting =
    hour >= 4 && hour < 11
      ? 'Selamat pagi'
      : hour >= 11 && hour < 15
        ? 'Selamat siang'
        : hour >= 15 && hour < 19
          ? 'Selamat sore'
          : 'Selamat malam';
  const [y, m, d] = jakartaDateString().split('-').map(Number);
  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
  return { greeting, dateLabel };
}

/** Emoji suasana mengikuti waktu (sapaan tetap teks — emoji terpisah supaya
 *  mudah dilepas dan tidak ikut dibacakan screen reader). */
function greetingEmoji(hour: number): string {
  if (hour >= 4 && hour < 11) return '🌤';
  if (hour >= 11 && hour < 15) return '☀️';
  if (hour >= 15 && hour < 19) return '🌇';
  return '🌙';
}

export function TodayHero({
  userName,
  completed,
  total,
  currentStreak,
  level,
  levelProgress,
  onOpenToday,
  onOpenHistory,
  onOpenProgress,
}: TodayHeroProps) {
  const { greeting, dateLabel } = useJakartaGreeting();
  const hour = typeof window === 'undefined' ? 12 : jakartaNowParts().hour;

  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const growth = total > 0 ? completed / total : 0;
  const remaining = Math.max(0, total - completed);
  const allDone = total > 0 && remaining === 0;

  // Narasi progres — konteks emosional, bukan angka mentah (prinsip #3).
  const narrative =
    total === 0
      ? 'Belum ada rutinitas terjadwal hari ini.'
      : allDone
        ? 'Semua rutinitas hari ini sudah selesai. Kerja bagus! 🌳'
        : completed === 0
          ? 'Hari masih muda — mulai dari satu rutinitas kecil.'
          : remaining <= 2
            ? `Sedikit lagi — ${remaining} rutinitas tersisa hari ini.`
            : `Kamu sedang menjalani rutinitasmu dengan baik.`;

  return (
    <section className="premium-hero" aria-label="Sapaan dan progres hari ini">
      <div className="premium-hero-bubbles" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:px-6">
        {/* Baris 1 — sapaan personal (Display serif Fraunces — momen emosional,
            TASK 45 typography 3-lapis) + tanggal; pohon signature di kanan. */}
        <div className="flex items-start justify-between gap-3">
          <div className="premium-fade-up min-w-0">
            <h2 className="font-display truncate text-[1.35rem] font-semibold leading-snug tracking-tight sm:text-2xl">
              {greeting}
              {userName ? `, ${userName}` : ''}{' '}
              <span aria-hidden="true">{greetingEmoji(hour)}</span>
            </h2>
            {dateLabel && (
              <p className="mt-1 text-[13px] font-medium opacity-90">{dateLabel}</p>
            )}
          </div>
          {/* Signature visual — pohon rutinitas; halo amber menyala saat streak
              ≥7 hari (tree-heat), bloom emerald saat hari tuntas. */}
          <TreeProgress
            size={88}
            growth={growth}
            streak={currentStreak}
            className="premium-fade-up shrink-0"
          />
        </div>

        {/* Baris 2 — narasi + bar progres besar "X dari Y" */}
        <div className="premium-fade-up" style={{ animationDelay: '100ms' }}>
          <p className="text-sm font-medium leading-relaxed opacity-95">{narrative}</p>
          {total > 0 && (
            /* CONNECTED-APP: blok progres "X dari Y" membuka Tracker hari ini
               (destination berguna — lanjut menyelesaikan sisanya). */
            <button
              type="button"
              onClick={onOpenToday}
              disabled={!onOpenToday}
              aria-label={`Buka tracker hari ini — ${completed} dari ${total} rutinitas selesai (${pct}%)`}
              className="mt-3 w-full rounded-xl text-left transition-[background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-white/10 enabled:active:scale-[0.99]"
            >
              <div className="flex items-baseline justify-between gap-3 px-1">
                <p className="font-display text-[13px] font-semibold">
                  <CountUpNumber value={completed} className="font-display text-[1.65rem] font-bold leading-none" />
                  <span className="opacity-80"> dari {total} rutinitas</span>
                </p>
                <span className="premium-stat text-lg">{pct}%</span>
              </div>
              {/* Bar di atas gradien: track putih-transparan, fill terang */}
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/25"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progres hari ini ${pct}%`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-100 via-white to-emerald-100 transition-[width] duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          )}
        </div>

        {/* Baris 3 — gamifikasi organik: chip streak + mini bar level */}
        <div
          className="premium-fade-up flex flex-wrap items-center gap-x-4 gap-y-2"
          style={{ animationDelay: '160ms' }}
        >
          {currentStreak > 0 && (
            /* CONNECTED-APP: streak → kalender Riwayat (konteks yang
               menghasilkan angka streak itu). */
            <button
              type="button"
              onClick={onOpenHistory}
              disabled={!onOpenHistory}
              aria-label={`Streak ${currentStreak} hari berturut-turut — buka riwayat kalender`}
              className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default enabled:cursor-pointer enabled:hover:bg-white/20"
            >
              <Flame
                className={currentStreak >= 3 ? 'anim-flame-pulse h-4 w-4 text-amber-200' : 'h-4 w-4 text-amber-200'}
                aria-hidden="true"
              />
              <span>
                {currentStreak} hari berturut-turut
                {currentStreak >= 3 && currentStreak < 7 ? ' — momentummu sedang tumbuh' : ''}
              </span>
            </button>
          )}
          {/* CONNECTED-APP: level & XP → tab Progres (KPI Total XP/Level). */}
          <button
            type="button"
            onClick={onOpenProgress}
            disabled={!onOpenProgress}
            aria-label={`Level ${level}, ${Math.round(levelProgress)}% menuju level berikutnya — buka tab Progres`}
            className="group flex min-w-[150px] flex-1 items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default enabled:cursor-pointer sm:max-w-[220px]"
          >
            <span className="shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-semibold transition-colors duration-200 group-hover:bg-white/20">
              Level {level}
            </span>
            <span
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25"
              role="progressbar"
              aria-valuenow={Math.round(levelProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres level ${Math.round(levelProgress)}%`}
            >
              <span
                className="block h-full rounded-full bg-gradient-to-r from-emerald-200 to-white transition-[width] duration-700"
                style={{ width: `${Math.min(100, Math.max(0, levelProgress))}%` }}
              />
            </span>
            <span className="shrink-0 text-[12px] font-semibold opacity-90 tabular-nums">
              {Math.round(levelProgress)}%
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
