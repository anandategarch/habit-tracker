// ---------------------------------------------------------------------------
// src/lib/muscle-map-program-presets.ts — PRESET & FORMAT PROGRAM LATIHAN
// (Task 75 F4 — dipecah dari muscle-map-program.ts saat audit 77 supaya
// setiap modul tetap <400 baris, aturan modular no-god-file).
//
// Isi: label hari (Min..Sab), ringkasan jadwal satu baris, dan 4 template
// preset siap pakai (workout di rumah, dibangun di atas 7 zona otot yang
// sudah ada). Preset murni KODE — tidak disimpan ke DB; mengaktifkannya
// menyalin isinya menjadi baris program tersimpan.
//
// Public API tetap diekspor ulang lewat muscle-map-program.ts (barrel
// '@/lib/muscle-map' tidak berubah — konsumen lama resolve apa adanya).
// ---------------------------------------------------------------------------

import type { GymProgramDay } from './muscle-map-program';
import { MUSCLE_ZONE_DEF_BY_KEY } from './muscle-map-zones';

// ── Format tampilan ────────────────────────────────────────────────────────

/** Label pendek hari: Min Sen Sel Rab Kam Jum Sab. */
export const PROGRAM_DOW_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
/** Label penuh hari: Minggu Senin … Sabtu. */
export const PROGRAM_DOW_FULL = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
] as const;

export function dowLabelShort(dow: number): string {
  return PROGRAM_DOW_SHORT[((dow % 7) + 7) % 7];
}

export function dowLabelFull(dow: number): string {
  return PROGRAM_DOW_FULL[((dow % 7) + 7) % 7];
}

/** Ringkasan jadwal preset/program untuk satu baris picker ("Sen · Rab · Jum"). */
export function programScheduleSummary(days: GymProgramDay[]): string {
  if (days.length === 0) return '—';
  return days.map((d) => dowLabelShort(d.dow)).join(' · ');
}

/** Judul otomatis dari zona: "Dada", "Dada & Bahu", "Dada, Bahu & Perut".
 *  (Audit 77: ikut pindah ke modul format — dipakai builder/parser.) */
export function programTitleFromZones(zones: GymProgramDay['zones']): string {
  const labels = zones.map((z) => MUSCLE_ZONE_DEF_BY_KEY[z]?.label ?? z);
  if (labels.length <= 1) return labels[0] ?? 'Latihan';
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

// ── Template preset (murni kode — tak disimpan DB; aktivasi menyalin) ───────

export interface GymProgramPreset {
  /** id stabil untuk React key + identifikasi picker. */
  id: string;
  name: string;
  emoji: string;
  desc: string;
  days: GymProgramDay[];
}

export const PROGRAM_PRESETS: GymProgramPreset[] = [
  {
    id: 'preset-fullbody3',
    name: 'Full Body 3 Hari',
    emoji: '🏃',
    desc: 'Sirkuit menyeluruh 3× seminggu — paling ringan dijalankan, cocok pemula.',
    days: [
      { dow: 1, title: 'Sirkuit Full Body', zones: ['fullbody'] },
      { dow: 3, title: 'Sirkuit Full Body', zones: ['fullbody'] },
      { dow: 5, title: 'Sirkuit Full Body', zones: ['fullbody'] },
    ],
  },
  {
    id: 'preset-split3',
    name: 'Split 3 Hari',
    emoji: '🔥',
    desc: 'Semua 6 zona terbagi rapi ke Senin / Rabu / Jumat.',
    days: [
      { dow: 1, title: 'Push — Dada & Bahu', zones: ['dada', 'bahu'] },
      { dow: 3, title: 'Pull — Punggung & Lengan', zones: ['punggung', 'lengan'] },
      { dow: 5, title: 'Kaki & Perut', zones: ['kaki', 'perut'] },
    ],
  },
  {
    id: 'preset-split4',
    name: 'Split 4 Hari',
    emoji: '⚡',
    desc: 'Irama 2 hari latihan lalu istirahat — pas untuk rutinitas padat.',
    days: [
      { dow: 1, title: 'Dada & Perut', zones: ['dada', 'perut'] },
      { dow: 2, title: 'Punggung', zones: ['punggung'] },
      { dow: 4, title: 'Bahu & Lengan', zones: ['bahu', 'lengan'] },
      { dow: 6, title: 'Kaki', zones: ['kaki'] },
    ],
  },
  {
    id: 'preset-split5',
    name: 'Split 5 Hari',
    emoji: '🏋️',
    desc: 'Satu fokus per hari — untuk serius bangun otot, Sabtu–Minggu pulih.',
    days: [
      { dow: 1, title: 'Dada', zones: ['dada'] },
      { dow: 2, title: 'Punggung', zones: ['punggung'] },
      { dow: 3, title: 'Kaki', zones: ['kaki'] },
      { dow: 4, title: 'Bahu & Lengan', zones: ['bahu', 'lengan'] },
      { dow: 5, title: 'Perut', zones: ['perut'] },
    ],
  },
];
