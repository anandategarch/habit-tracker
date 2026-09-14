'use client';

import { cn } from '@/lib/utils';

/** Loader "sprout" legacy — dipertahankan untuk kompatibilitas (tidak dipakai
 *  di page.tsx sejak Task 28; TreeGrow menggantikannya). */
export function SproutGrow({ className, size = 64 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Memuat"
    >
      <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
      <svg viewBox="0 0 24 24" className="text-primary" style={{ width: size * 0.62, height: size * 0.62 }} aria-hidden="true">
        <path
          d="M12 22V12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6z"
          className="origin-bottom animate-pulse"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path
          d="M12 10c0-3.5 2.6-5 6-5 0 3.5-2.6 5-6 5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.15"
        />
      </svg>
    </div>
  );
}

/** Path daun — basis di (0,0), ujung di (0,-13). Dipakai kipas daun di
 *  ujung ranting dan daun melayang. */
const TREE_LEAF_D = 'M0 0 C4.5 -3.5 4.5 -9 0 -13 C-4.5 -9 -4.5 -3.5 0 0 Z';

/** Kipas 3 daun yang mekar dari ujung ranting (scale 0→1, spring).
 *  Struktur 2 lapis <g>: outer = translate/scale statis (SVG transform
 *  attribute), inner = kelas animasi (CSS transform). Kenapa dipisah?
 *  CSS property `transform` MENIMPA transform attribute SVG pada elemen
 *  yang sama — kalau digabung, animasi scale akan menghapus translate/scale
 *  statisnya (pelajaran desain Task 28 v2). */
function LeafFan({ x, y, scale = 1, cls }: { x: number; y: number; scale?: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={`tree-leaves ${cls}`}>
        <path className="tree-leafp tree-leafp-a" transform="rotate(-40)" d={TREE_LEAF_D} />
        <path className="tree-leafp tree-leafp-b" d={TREE_LEAF_D} />
        <path className="tree-leafp tree-leafp-c" transform="rotate(40)" d={TREE_LEAF_D} />
      </g>
    </g>
  );
}

/** Daun tunggal kecil di tengah ranting — mengisi siluet supaya pohon
 *  terlihat rimbun tanpa menutupi struktur cabang. */
function StemLeaf({ x, y, rotate = 0, scale = 1, cls }: { x: number; y: number; rotate?: number; scale?: number; cls: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={`tree-leaves ${cls}`}>
        <path className="tree-leafp tree-leafp-b" transform={`rotate(${rotate})`} d={TREE_LEAF_D} />
      </g>
    </g>
  );
}

/**
 * TreeMark (Task 56, fix Task 57) — ikon aplikasi Rutina: artwork pohon
 * botanical milik pengguna (public/tree/tunas-mark.svg, tahap "Tunas").
 *
 * TASK 56: splash + tab loading disamakan dengan pohon terbaru — mengganti
 * TreeGrow (pohon garis vektor lama, Task 28). Artwork yang sama dipakai
 * kartu "Pohonmu" Beranda, tab Pohon, dan paket ikon PWA/favicon — identitas
 * visual satu suara dari launcher → splash → dalam aplikasi.
 *
 * TASK 57 (fix "kok jadi kotak"): tunas.svg asli adalah artwork gaya IKON
 * dengan 3 layer latar (rect teal gelap + grid + glow dekoratif) — di splash
 * yang background-nya terang, layer itu tampak sebagai KOTAK gelap, bukan
 * pohon. Solusi: tunas-mark.svg — geometri & warna artwork PERSIS sama
 * (gundukan tanah + akar + batang + 2 daun botanical) TANPA layer latar,
 * viewBox di-crop persegi (342 595 340 350) di sekitar tunas, bayangan tanah
 * dilembutkan .75→.16. Loading kini menampilkan POHONNYA — bukan kotak.
 *
 * Varian:
 * - 'splash' : mark masuk dengan settle-spring + halo teal bernapas +
 *   progress ring MENGAKSELERASI (ease-in — riset CMU: terasa lebih cepat).
 *   Untuk layar pembuka (1.6s, sinkron anim-splash-exit di page.tsx).
 * - 'inline' : mark tampil langsung + goyang lembut dari pangkal (tanpa
 *   ring/sekuens) — untuk tab-loading yang selesai dalam ~300ms.
 *
 * Kenapa <img> dan bukan inline-SVG: aset punya gradient id (xleaf/xwood…)
 * yang akan bertabrakan kalau dua instance ter-render bersamaan (splash +
 * tab loading saat transisi). Sebagai dokumen terpisah, id aman.
 * Goyang/bernafas lewat kelas CSS (globals.css §TreeMark) — adaptif
 * prefers-reduced-motion.
 */
export function TreeMark({
  className,
  size = 64,
  variant = 'inline',
  ring = false,
}: {
  className?: string;
  size?: number;
  variant?: 'splash' | 'inline';
  /** Tampilkan progress ring yang mengakselerasi (varian splash). */
  ring?: boolean;
}) {
  // Padding supaya ring (r≈47% dari size) melingkar DI LUAR mark artwork.
  const pad = Math.max(3, Math.round(size * 0.085));
  const tile = Math.max(24, size - pad * 2);
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Memuat"
    >
      {/* Halo teal "bernapas" di belakang mark — hanya splash (tenang, bukan
          strobo). Terlihat menembus celah antar daun karena mark transparan.
          Static samar di bawah prefers-reduced-motion. */}
      {variant === 'splash' && <div className="treemark-halo treemark-halo-on" aria-hidden="true" />}

      {/* Progress ring — mulai pukul 12, arc mengakselerasi 1 putaran.
          pathLength=1 menormalkan keliling → dasharray 1 = sepanjang path. */}
      {ring && (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <g transform="rotate(-90 50 50)">
            <circle className="treemark-ring-track" cx="50" cy="50" r="47" fill="none" strokeWidth="2.6" />
            <circle
              className="treemark-ring-arc"
              cx="50"
              cy="50"
              r="47"
              fill="none"
              strokeWidth="2.6"
              strokeLinecap="round"
              pathLength={1}
            />
          </g>
        </svg>
      )}

      {/* Mark transparan (Task 57 — tanpa kotak): SVG auto-fit preserve-aspect
          di dalam kotak tile (aspect 340:350 ≈ persegi, letterbox ~1.4%).
          Enter (splash) di wrapper, sway di <img> supaya dua animasi tidak
          bertabrakan di elemen yang sama. */}
      <div
        className={cn('treemark-tile', variant === 'splash' && 'treemark-enter')}
        style={{ width: tile, height: tile }}
      >
        <img
          src="/tree/tunas-mark.svg"
          alt=""
          width={340}
          height={350}
          decoding="async"
          draggable={false}
          fetchPriority={variant === 'splash' ? 'high' : 'auto'}
          className="treemark-art treemark-sway h-full w-full select-none"
        />
      </div>
    </div>
  );
}

/** Baris skeleton generik. */
export function SkeletonRow({ className }: { className?: string }) {
  return <div className={cn('h-14 animate-pulse rounded-xl bg-muted/60', className)} />;
}

/* ── TreeProgress (Task 44) — signature visual Rutina ────────────────────
 * Pohon yang BERTUMBUH mengikuti progres rutinitas hari ini (0..1).
 * Geometri IDENTIK dengan TreeGrow (akar → batang → 5 ranting → 7 kipas
 * daun + glow + daun melayang) sehingga ikon "Rutina" langsung dikenali;
 * kelas `tree-instant` mematikan sekuens splash, lalu tiap bagian dibungkus
 * <g class="tree-part"> yang di-fade/slide oleh inline style (transisi
 * 0.6s dari globals.css §17). Saat user menyelesaikan habit, progress
 * naik → daun baru mekar — reward visual yang tenang, bukan gimmick.
 *
 * Peta tahap (growth):
 *   0.00  tanah + gundukan + akar samar        "hari dimulai"
 *   0.05  batang tumbuh
 *   0.22  ranting bercabang (tengah → samping)
 *   0.44  kipas daun mekar bertahap (7 buah)
 *   0.92  daun melayang + glow penuh           "hari sempurna"
 * Glory: 100% → glow + 3 daun drift (hidup, lembut — bukan loop glamor).
 */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Opacity bagian pada tahap [start, start+span] dari growth. */
function stage(growth: number, start: number, span = 0.14): number {
  if (growth <= start) return 0;
  if (growth >= start + span) return 1;
  return (growth - start) / span;
}

/** Style reveal untuk <g class="tree-part">: fade + slide-up kecil. */
function partStyle(o: number, rise = 4): React.CSSProperties {
  return {
    opacity: o,
    transform: o >= 1 ? undefined : `translateY(${(1 - o) * rise}px)`,
  };
}

export function TreeProgress({
  className,
  size = 96,
  growth = 0,
  streak = 0,
}: {
  className?: string;
  size?: number;
  /** Progres hari ini 0..1 (mis. 4 dari 6 habit = 0.667). */
  growth?: number;
  /** Streak global berjalan (hari) — ≥7 menyalakan halo hangat "momentum"
   *  (TASK 45: pohon = signature; streak mengubah visual state pohon). */
  streak?: number;
}) {
  const g = clamp01(growth);
  const oTrunk = stage(g, 0.05, 0.22);
  const oBc = stage(g, 0.22);
  const oBl1r1 = stage(g, 0.27);
  const oBl2r2 = stage(g, 0.32);
  const oLc = stage(g, 0.44, 0.11);
  const oLl2r2 = stage(g, 0.53, 0.11);
  const oLl1r1 = stage(g, 0.62, 0.11);
  const oLm = stage(g, 0.71, 0.11);
  const oFloat = stage(g, 0.93, 0.07);
  // Glow selalu ada samar, makin terang seiring pertumbuhan.
  const glowO = 0.3 + 0.7 * g;
  const done = g >= 0.999;

  const pctLabel = Math.round(g * 100);
  // TASK 45 — tahap tumbuh (seed → sprout → small → mature → flourishing).
  // Label emosional untuk aria; visual tetap geometri bertahap yang sama.
  const stageLabel =
    g <= 0.001
      ? 'benih menunggu'
      : g < 0.22
        ? 'tunas mulai tumbuh'
        : g < 0.44
          ? 'pohon kecil'
          : g < 0.93
            ? 'tumbuh subur'
            : 'mekar penuh';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        // Halo streak ≥7 hari — momentum hangat menyala di sekeliling pohon.
        streak >= 7 && 'tree-heat',
        // Hari tuntas — bloom emerald mengelilingi tajuk.
        done && 'tree-bloom',
        className
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Pohon rutinitas: ${stageLabel} — ${pctLabel}% hari ini`}
    >
      {/* Wrapper HTML — skala halus mengikuti growth (transform ter-composite,
          murah). tree-part memberi transisi yang sama dengan bagian SVG. */}
      <div
        className="tree-part h-full w-full"
        style={{ transform: `scale(${0.93 + 0.07 * g})` }}
      >
        <svg viewBox="0 0 200 200" className="css-tree-svg tree-instant h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="tree-progress-glow" cx="50%" cy="50%" r="50%">
              <stop className="tree-glow-stop-a" offset="0%" />
              <stop className="tree-glow-stop-b" offset="100%" />
            </radialGradient>
          </defs>

          {/* Glow — opacity pembungkus = target growth; animasi "bernapas"
              internal (tree-glow-pulse) tetap berjalan di dalamnya. */}
          <g className="tree-part" style={partStyle(glowO, 0)}>
            <circle className="tree-glow" cx="100" cy="88" r="62" fill="url(#tree-progress-glow)" />
          </g>

          {/* Panggung: tanah + gundukan (selalu tampil — hari selalu dimulai) */}
          <path className="tree-ground" d="M36 150 H164" pathLength={1} />
          <ellipse className="tree-mound" cx="100" cy="150" rx="32" ry="7" />
          <g className="tree-part" style={partStyle(0.45 + 0.55 * g, 0)}>
            <path className="tree-root tree-root-1" d="M100 150 C92 156 80 160 64 159" pathLength={1} />
            <path className="tree-root tree-root-2" d="M100 150 C108 156 120 160 136 159" pathLength={1} />
            <path className="tree-root tree-root-3" d="M100 150 C97 161 96 169 95 178" pathLength={1} />
            <path className="tree-root tree-root-4" d="M100 150 C104 162 110 168 119 175" pathLength={1} />
          </g>

          {/* Grup sway — batang + ranting + daun bergoyang dari pangkal */}
          <g className="tree-sway">
            <g className="tree-part" style={partStyle(oTrunk, 6)}>
              <path className="tree-trunk" d="M100 150 C99.5 135 99 122 100 108" pathLength={1} />
            </g>
            <g className="tree-part" style={partStyle(oBc, 4)}>
              <path className="tree-branch tree-branch-c" d="M100 108 C99 98 101 90 100 79" pathLength={1} />
            </g>
            <g className="tree-part" style={partStyle(oBl1r1, 4)}>
              <path className="tree-branch tree-branch-l1" d="M100 108 C91 101 79 99 66 97" pathLength={1} />
              <path className="tree-branch tree-branch-r1" d="M100 108 C109 101 121 99 134 97" pathLength={1} />
            </g>
            <g className="tree-part" style={partStyle(oBl2r2, 4)}>
              <path className="tree-branch tree-branch-l2" d="M100 108 C96 100 89 94 82 86" pathLength={1} />
              <path className="tree-branch tree-branch-r2" d="M100 108 C104 100 111 94 118 86" pathLength={1} />
            </g>

            {/* Kipas daun — mekar bertahap tengah → luar */}
            <g className="tree-part" style={partStyle(oLc, 3)}>
              <LeafFan x={100} y={79} scale={1.05} cls="tree-leaves-c" />
            </g>
            <g className="tree-part" style={partStyle(oLl2r2, 3)}>
              <LeafFan x={82} y={86} scale={0.82} cls="tree-leaves-l2" />
              <LeafFan x={118} y={86} scale={0.82} cls="tree-leaves-r2" />
            </g>
            <g className="tree-part" style={partStyle(oLl1r1, 3)}>
              <LeafFan x={66} y={97} scale={0.88} cls="tree-leaves-l1" />
              <LeafFan x={134} y={97} scale={0.88} cls="tree-leaves-r1" />
            </g>
            <g className="tree-part" style={partStyle(oLm, 3)}>
              <StemLeaf x={92} y={98} rotate={-18} scale={0.6} cls="tree-leaves-m1" />
              <StemLeaf x={108} y={98} rotate={18} scale={0.6} cls="tree-leaves-m2" />
            </g>
          </g>

          {/* Daun melayang — hanya saat hari selesai (reward akhir) */}
          <g className="tree-part" style={partStyle(done ? oFloat : 0, 0)}>
            <g transform="translate(24 92)">
              <path className="tree-leaf tree-leaf-f1" d={TREE_LEAF_D} />
            </g>
            <g transform="translate(176 82)">
              <path className="tree-leaf tree-leaf-f2" d={TREE_LEAF_D} />
            </g>
            <g transform="translate(146 24)">
              <path className="tree-leaf tree-leaf-f3" d={TREE_LEAF_D} />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
