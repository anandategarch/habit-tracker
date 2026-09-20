'use client';

// components/tree/pohon-stage.tsx — ① PANGGUNG INTERAKTIF tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// JSX/animasi/aria identik, hanya pindah rumah:
//   • badge tahap musim mingguan + level seumur hidup + sinyal musiman
//   • artwork aset pengguna (1024²) sebagai tombol sapaan besar (sway)
//   • daun ambient, kunang-kunang malam Jakarta, partikel daun gugur,
//     tetesan penyiraman, sparkle perayaan, petunjuk "ketuk pohonmu".
// State animasi (swayKey/leaves/watering/celebrating/isNight) dimiliki
// use-pohon-play dan dialirkan lewat props dari akar komposisi.

import { Droplet, Leaf, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeGrowthState } from '@/lib/tree-growth';
import type { TreeSeasonState } from '@/lib/tree-season';
import type { LeafParticle } from './pohon-content';

export interface PohonStageProps {
  season: TreeSeasonState;
  tree: TreeGrowthState | null;
  /** Level seumur hidup (dash?.currentLevel) — '…' saat belum termuat. */
  level: number | undefined;
  /** Path artwork mengikuti state pohon (dorman/daun-kuning/berbunga/tahap). */
  artwork: string;
  isNight: boolean;
  swayKey: number;
  leaves: LeafParticle[];
  watering: boolean;
  celebrating: boolean;
  onTap: () => void;
}

export function PohonStage({
  season,
  tree,
  level,
  artwork,
  isNight,
  swayKey,
  leaves,
  watering,
  celebrating,
  onTap,
}: PohonStageProps) {
  return (
    <section
      aria-label={`Panggung pohon — musim minggu ini, tahap ${season.stage.label}`}
      className="relative overflow-hidden rounded-3xl border border-teal-900/60 shadow-[0_18px_44px_-18px_rgba(2,20,17,0.55)]"
      style={{ background: 'linear-gradient(160deg,#071715 0%,#05110F 60%,#04100D 100%)' }}
    >
      {/* Cahaya lingkungan — teal lembut; malam → bulan emas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-60px] h-56 w-56 rounded-full blur-3xl"
        style={{ background: isNight ? 'rgba(237,188,63,0.16)' : 'rgba(52,217,163,0.14)' }}
      />

      {/* Badge tahap + musim */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[70%] flex-col items-start gap-2">
        <span className="rounded-full border border-[#63E6BE]/30 bg-[#071715]/70 px-3 py-1.5 text-[11px] font-bold text-[#9AF4CC] backdrop-blur-sm">
          {season.stage.label} · Minggu Ini
        </span>
        {/* Task 62: pencapaian seumur hidup tetap terlihat sebagai
            konteks (level tidak pernah turun — bukan sewa). */}
        <span className="rounded-full border border-[#9BC1B7]/25 bg-[#071715]/70 px-3 py-1.5 text-[11px] font-semibold text-[#C6DAD3] backdrop-blur-sm">
          Level {level ?? '…'} · seumur hidup
        </span>
        {tree?.blooming && (
          <span className="rounded-full border border-[#F1A2C5]/35 bg-[#F1A2C5]/15 px-3 py-1.5 text-[11px] font-semibold text-[#F1C9D9] backdrop-blur-sm">
            Sedang berbunga
          </span>
        )}
        {tree?.dorman && (
          <span className="rounded-full border border-[#9BC1B7]/30 bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-[#C6DAD3] backdrop-blur-sm">
            Sebagian dorman 😴
          </span>
        )}
        {tree?.care && (
          <span className="rounded-full border border-[#E7B64B]/35 bg-[#E7B64B]/15 px-3 py-1.5 text-[11px] font-semibold text-[#F1D9A0] backdrop-blur-sm">
            Daun menguning
          </span>
        )}
      </div>

      {/* Pohon — area tap besar (sentuh = sapamu pohon) */}
      <button
        type="button"
        onClick={onTap}
        aria-label={`Sapa pohonmu — musim minggu ini tahap ${season.stage.label}, Level ${level ?? '…'} seumur hidup. Ketuk untuk membuatnya bergoyang.`}
        className="group relative block w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63E6BE]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.995]"
      >
        <div key={swayKey} className="anim-pohon-sway">
          {/* Artwork aset pengguna (1024²) — pas penuh, bg menyatu */}
          <img
            src={artwork}
            alt=""
            width={640}
            height={640}
            loading="eager"
            decoding="async"
            className="mx-auto block aspect-square w-full max-w-[440px] select-none object-contain"
            draggable={false}
          />
        </div>

        {/* Daun ambient (selalu ada, halus) */}
        <span aria-hidden="true" className="anim-pohon-drift pointer-events-none absolute left-[16%] top-[26%] hidden text-[#63E6BE]/50 sm:block" style={{ ['--pohon-dur' as string]: '7s' }}>
          <Leaf className="h-4 w-4" />
        </span>
        <span aria-hidden="true" className="anim-pohon-drift pointer-events-none absolute right-[18%] top-[38%] hidden text-[#9AF4CC]/40 sm:block" style={{ ['--pohon-dur' as string]: '8.5s', ['--pohon-delay' as string]: '1.2s' }}>
          <Leaf className="h-3.5 w-3.5" />
        </span>

        {/* Kunang-kunang — hanya malam Jakarta */}
        {isNight && (
          <>
            <span aria-hidden="true" className="anim-pohon-firefly pointer-events-none absolute left-[24%] top-[30%] h-1.5 w-1.5 rounded-full bg-[#9AF4CC] shadow-[0_0_8px_2px_rgba(154,244,204,0.6)]" />
            <span aria-hidden="true" className="anim-pohon-firefly pointer-events-none absolute right-[28%] top-[46%] h-1 w-1 rounded-full bg-[#EDBC3F] shadow-[0_0_6px_2px_rgba(237,188,63,0.55)]" style={{ ['--pohon-dur' as string]: '6s', ['--pohon-delay' as string]: '0.8s' }} />
          </>
        )}

        {/* Partikel daun gugur (sapaan) */}
        {leaves.map((l) => (
          <span
            key={l.id}
            aria-hidden="true"
            className="anim-pohon-leaf pointer-events-none absolute top-[38%]"
            style={{
              left: `${l.leftPct}%`,
              ['--pohon-dx' as string]: `${l.dx}px`,
              ['--pohon-dur' as string]: `${l.durMs}ms`,
              ['--pohon-delay' as string]: `${l.delayMs}ms`,
            }}
          >
            <Leaf className={cn('h-4 w-4', l.amber ? 'text-[#EDBC3F]' : 'text-[#63E6BE]')} />
          </span>
        ))}

        {/* Tetesan penyiraman */}
        {watering &&
          Array.from({ length: 5 }, (_, i) => (
            <span
              key={`drop-${i}`}
              aria-hidden="true"
              className="anim-pohon-drop pointer-events-none absolute top-[30%]"
              style={{
                left: `${36 + i * 7}%`,
                ['--pohon-delay' as string]: `${i * 110}ms`,
              }}
            >
              <Droplet className="h-3.5 w-3.5 text-[#7DD3C8] drop-shadow-[0_2px_4px_rgba(125,211,200,0.5)]" />
            </span>
          ))}

        {/* Perayaan sparkle emas */}
        {celebrating &&
          Array.from({ length: 9 }, (_, i) => (
            <span
              key={`spark-${i}`}
              aria-hidden="true"
              className="anim-pohon-sparkle pointer-events-none absolute"
              style={{
                left: `${18 + (i * 67) % 66}%`,
                top: `${20 + ((i * 37) % 46)}%`,
                ['--pohon-dur' as string]: `${1300 + (i % 4) * 260}ms`,
                ['--pohon-delay' as string]: `${(i % 5) * 130}ms`,
              }}
            >
              <Sparkles className={cn('h-5 w-5', i % 3 === 0 ? 'text-[#FFE99A]' : 'text-[#63E6BE]')} />
            </span>
          ))}

        {/* Petunjuk halus — "ini bisa disentuh" */}
        <span className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-[#071715]/60 px-3 py-1 text-[10.5px] font-semibold tracking-wide text-[#9BC1B7] backdrop-blur-sm transition-opacity group-hover:opacity-100 sm:opacity-70">
            ketuk pohonmu 👆
          </span>
        </span>
      </button>
    </section>
  );
}
