// components/tree/pohon-content.ts — konten statis + helper murni tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// konten/tipe/nilai TIDAK berubah, hanya pindah rumah supaya layar utama
// menjadi akar komposisi. Konsumen: pohon-screen.tsx, use-pohon-play.ts,
// pohon-stage.tsx, pohon-watering.tsx, pohon-fruits.tsx.

// ── Data types (bentuk field minimal yang dipakai layar ini) ────────────

export interface HabitRowForPohon {
  id: string;
  name: string;
  emoji?: string;
  vacationMode?: boolean;
  graduatedAt?: string | null;
}

export interface GoalRowForPohon {
  id: string;
  title: string;
  status: string;
  deadline?: string | null;
  updatedAt?: string;
}

export interface FruitItem {
  id: string;
  title: string;
  kind: 'goal' | 'habit';
  /** ISO/YMD terakhir relevan — untuk urutan & label. */
  date: string | null;
  emoji?: string;
}

// ── Konten menyenangkan (fun copy) ──────────────────────────────────────

/** Bisik-bisik pohon saat disapa — rotasi (bukan tiap tap, anti-spam). */
export const TREE_WHISPERS: readonly string[] = [
  'Pohonmu bergoyang senang 🌿',
  'Daun-daunnya berbisik: terima kasih sudah konsisten',
  'Rantingnya melambai ke arahmu',
  'Akarnya makin dalam setiap hari',
  'Kunang-kunang ikut menonton dari jauh',
  'Pohon ini tumbuh dari XP-mu, bukan dari kebetulan',
  'Satu hari baik tetap dihitung, sekecil apa pun',
  'Pohonmu tidak buru-buru — dan tidak pernah berhenti',
];

/** Kebijaksanaan Pohon — kutipan pertumbuhan, deterministik per hari. */
export const TREE_WISDOM: readonly string[] = [
  'Pohon apa pun yang pernah meneduhkanmu, dulunya cuma sebutir biji yang tekun.',
  'Akar yang dalam tidak takut badai. Konsistensimu adalah akar itu.',
  'Tumbuh itu lambat, lalu tiba-tiba — seperti musim.',
  'Kamu tidak perlu mengejar siapa pun. Pohon tidak berlari, tapi sampai ke langit.',
  'Hari yang kamu mulai setengah hati pun tetap menyiram sesuatu.',
  'Buah paling manis adalah yang paling lama dijaga di dahan.',
  'Ranting yang patah bukan akhir cerita — pohon tumbuh dua tunas baru.',
  'Musim dingin bukan diabaikan pohon; ia dipakai untuk berakar.',
  'Sebesar apa pun pohonnya, ia tetap minum setetes demi setetes.',
  'Kebiasaan kecil hari ini adalah bayangan pohon besar di masa depan.',
  'Pohon tidak membandingkan tingginya dengan tetangganya.',
  'Yang kamu rawat, itu yang tumbuh. Pilih dengan bijak apa yang kamu siram.',
  'Istirahat itu bagian dari tumbuh — dedaunan pun gugur untuk pulih.',
  'Level boleh naik perlahan; kuncinya jangan pernah nol hari dua kali.',
  'Setiap sunrise adalah tap persediaan air baru untuk pohonmu.',
  'Pohon dewasa bukan yang tumbuh paling cepat, tapi yang paling jarang berhenti.',
];

/** Partikel daun gugur saat pohon disapa. */
export interface LeafParticle {
  id: number;
  leftPct: number;
  dx: number;
  durMs: number;
  delayMs: number;
  amber: boolean;
}

/** Tetes penyiraman maksimum yang digambar (sisanya angka x/y). */
export const MAX_DROPLETS = 10;

// ── Helpers murni ───────────────────────────────────────────────────────

export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

export function todayWisdom(now: Date): string {
  return TREE_WISDOM[dayOfYear(now) % TREE_WISDOM.length];
}

export function shortDateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ymd = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d} ${bulan[m - 1]} ${y}`;
}
