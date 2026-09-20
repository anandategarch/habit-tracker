// ---------------------------------------------------------------------------
// src/lib/muscle-map-program.ts — PROGRAM LATIHAN (Task 75, Fase 4 Gym Cerdas).
//
// Pustaka MURNI (tanpa I/O): tipe payload program, 4 template preset siap
// pakai (workout di rumah, dibangun di atas 7 zona otot yang sudah ada),
// validasi program (dipakai server & klien — aturan SAMA dua sisi), parser
// defensif daysJson, dan mesin payload mingguan (hari ini, strip minggu,
// statistik adherence, "Minggu ke-N").
//
// SEMANTIK PROGRES (prinsip Peta Otot "hanya membaca event"): hari latihan
// dianggap SELESAI bila SEMUA zona hari itu tercatat selesai pada ymd-nya
// lewat HabitLog habit zona (diteruskan API sebagai zoneDoneByYmd). Sesi
// Full Body selesai pada suatu hari menyumbang ke SEMUA zona hari itu —
// konsisten dengan fullBodyContrib di mesin misi mingguan. Tidak ada
// kalkulasi XP/streak baru di lapisan ini.
//
// Dipakai bersama lewat barrel '@/lib/muscle-map' oleh:
//   * Server: src/app/api/gym/program/route.ts (GET/POST/PUT/PATCH/DELETE)
//   * Klien : components/gym/program-* (picker, builder, kartu hari ini)
// ---------------------------------------------------------------------------

import { dayKeyShift } from './muscle-map-sets';
import { MUSCLE_ZONE_DEF_BY_KEY, type MuscleZoneKey } from './muscle-map-zones';

// ── Batas input (server & klien memakai konstanta yang sama) ───────────────

/** Panjang nama program. */
export const PROGRAM_NAME_MAX = 40;
/** Panjang judul hari latihan. */
export const PROGRAM_TITLE_MAX = 60;
/** Zona per hari latihan (1–3 — volume sehat workout rumah). */
export const PROGRAM_ZONES_PER_DAY_MIN = 1;
export const PROGRAM_ZONES_PER_DAY_MAX = 3;
/** Jumlah total hari latihan per minggu. */
export const PROGRAM_DAYS_MIN = 1;
export const PROGRAM_DAYS_MAX = 7;

// ── Tipe ───────────────────────────────────────────────────────────────────

/** Satu hari latihan dalam program (dow 0=Minggu..6=Sabtu, unik). */
export interface GymProgramDay {
  dow: number;
  /** Judul bebas ("Push — Dada & Bahu") — auto dari zona bila kosong. */
  title: string;
  /** Zona otot yang dilatih hari itu (1–3, unik). */
  zones: MuscleZoneKey[];
}

/** Baris program (bentuk serialisasi klien — daysJson sudah diparse). */
export interface GymProgramSaved {
  id: string;
  name: string;
  emoji: string;
  days: GymProgramDay[];
  isActive: boolean;
  /** ISO waktu aktivasi terakhir — dasar "Minggu ke-N". null = belum pernah. */
  startedAt: string | null;
  updatedAt: string;
}

/** Satu sel minggu di strip program (7 sel: latihan / istirahat). */
export interface GymProgramWeekEntry {
  ymd: string;
  dow: number;
  /** null = hari istirahat (bukan hari latihan program). */
  title: string | null;
  zones: MuscleZoneKey[];
  /** Zona hari itu yang tercatat selesai pada ymd-nya. */
  doneCount: number;
  /** true bila SEMUA zona selesai hari itu. */
  done: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  /** true bila tanggal ini SEBELUM program diaktifkan — bukan bagian
   *  periode berjalan (tidak dihitung terlewat; tampil redup di strip). */
  beforeStart: boolean;
}

/** Hari ini menurut program aktif. */
export interface GymProgramToday {
  ymd: string;
  dow: number;
  title: string;
  zones: MuscleZoneKey[];
  zoneDone: MuscleZoneKey[];
  done: boolean;
}

/** Statistik minggu berjalan (zona scheduled yang sudah lewat / hari ini). */
export interface GymProgramStats {
  /** Total hari latihan terjadwal minggu ini. */
  scheduled: number;
  /** Hari latihan terjadwal yang terlewati & selesai semua zona. */
  done: number;
  /** Hari latihan terjadwal yang sudah LEWAT tapi belum selesai. */
  missed: number;
  /** Hari latihan yang masih di depan (besok dst). */
  upcoming: number;
  /** done/(done+missed) dibulatkan; null bila belum ada yang terlewati. */
  adherencePct: number | null;
}

/** Program aktif + konteks minggu berjalan. */
export interface GymProgramActive {
  id: string;
  name: string;
  emoji: string;
  startedAt: string | null;
  /** "Minggu ke-N" sejak aktivasi terakhir (min 1). */
  weekNumber: number;
  /** null = hari ini hari istirahat menurut program. */
  today: GymProgramToday | null;
  /** 7 sel minggu (urut dari awal minggu pengaturan). */
  week: GymProgramWeekEntry[];
  stats: GymProgramStats;
}

/** Payload GET /api/gym/program. */
export interface GymProgramPayload {
  todayYmd: string;
  weekStartYmd: string;
  /** dow hari pertama minggu (0=Minggu, 1=Senin) — sesuai pengaturan. */
  weekStartDow: number;
  active: GymProgramActive | null;
  /** Semua program tersimpan (preset tidak disimpan ke DB — di kode). */
  saved: GymProgramSaved[];
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

/** Judul otomatis dari zona: "Dada", "Dada & Bahu", "Dada, Bahu & Perut". */
export function programTitleFromZones(zones: MuscleZoneKey[]): string {
  const labels = zones.map((z) => MUSCLE_ZONE_DEF_BY_KEY[z]?.label ?? z);
  if (labels.length <= 1) return labels[0] ?? 'Latihan';
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

/** Ringkasan jadwal preset/program untuk satu baris picker ("Sen · Rab · Jum"). */
export function programScheduleSummary(days: GymProgramDay[]): string {
  if (days.length === 0) return '—';
  return days.map((d) => dowLabelShort(d.dow)).join(' · ');
}

// ── Parser defensif (server GET — baris lama/rusak tak boleh bikin 500) ─────

/** Parse + validasi BENTUK daysJson. null bila rusak (baris di-skip API). */
export function parseProgramDays(json: string): GymProgramDay[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length < PROGRAM_DAYS_MIN || raw.length > PROGRAM_DAYS_MAX) {
    return null;
  }
  const days: GymProgramDay[] = [];
  const seenDow = new Set<number>();
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const d = item as Record<string, unknown>;
    const dow = d.dow;
    if (typeof dow !== 'number' || !Number.isInteger(dow) || dow < 0 || dow > 6) return null;
    if (seenDow.has(dow)) return null;
    seenDow.add(dow);
    const title = typeof d.title === 'string' ? d.title.trim() : '';
    if (title.length > PROGRAM_TITLE_MAX) return null;
    const zonesRaw = d.zones;
    if (!Array.isArray(zonesRaw)) return null;
    if (zonesRaw.length < PROGRAM_ZONES_PER_DAY_MIN || zonesRaw.length > PROGRAM_ZONES_PER_DAY_MAX) {
      return null;
    }
    const zones: MuscleZoneKey[] = [];
    for (const z of zonesRaw) {
      if (typeof z !== 'string' || !MUSCLE_ZONE_DEF_BY_KEY[z as MuscleZoneKey]) return null;
      if (zones.includes(z as MuscleZoneKey)) return null;
      zones.push(z as MuscleZoneKey);
    }
    days.push({ dow, title: title || programTitleFromZones(zones), zones });
  }
  days.sort((a, b) => a.dow - b.dow);
  return days;
}

// ── Validasi input (dipakai server & klien — dua sisi aturan sama) ──────────

/** Bentuk klien hari (zona masih string — belum divalidasi). */
export interface ProgramDayInput {
  dow: number;
  title?: string;
  zones: string[];
}

export interface ProgramInput {
  name: string;
  emoji?: string;
  days: ProgramDayInput[];
}

export type ProgramValidation =
  | { ok: true; name: string; emoji: string; days: GymProgramDay[] }
  | { ok: false; error: string };

/** Validasi + normalisasi program (POST buat / PUT ubah). */
export function validateProgramInput(input: ProgramInput): ProgramValidation {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Nama program tidak boleh kosong' };
  if (name.length > PROGRAM_NAME_MAX) {
    return { ok: false, error: `Nama program maksimal ${PROGRAM_NAME_MAX} karakter` };
  }
  let emoji = String(input.emoji ?? '').trim();
  if (emoji.length > 8) return { ok: false, error: 'Emoji maksimal 8 karakter' };
  if (!emoji) emoji = '📋';

  if (!Array.isArray(input.days) || input.days.length < PROGRAM_DAYS_MIN) {
    return { ok: false, error: `Program perlu minimal ${PROGRAM_DAYS_MIN} hari latihan` };
  }
  if (input.days.length > PROGRAM_DAYS_MAX) {
    return { ok: false, error: `Maksimal ${PROGRAM_DAYS_MAX} hari latihan per minggu` };
  }

  const days: GymProgramDay[] = [];
  const seenDow = new Set<number>();
  for (const raw of input.days) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, error: 'Data hari latihan tidak valid' };
    }
    const day = raw as ProgramDayInput;
    const dow = day.dow;
    if (typeof dow !== 'number' || !Number.isInteger(dow) || dow < 0 || dow > 6) {
      return { ok: false, error: 'Hari dalam seminggu tidak valid' };
    }
    if (seenDow.has(dow)) {
      return { ok: false, error: `${dowLabelFull(dow)} terpasang dua kali — satu hari cukup sekali` };
    }
    seenDow.add(dow);

    const title = String(day.title ?? '').trim().replace(/\s+/g, ' ');
    if (title.length > PROGRAM_TITLE_MAX) {
      return { ok: false, error: `Judul hari maksimal ${PROGRAM_TITLE_MAX} karakter` };
    }

    const zonesRaw = Array.isArray(day.zones) ? day.zones : [];
    if (zonesRaw.length < PROGRAM_ZONES_PER_DAY_MIN) {
      return { ok: false, error: `${dowLabelFull(dow)}: pilih minimal ${PROGRAM_ZONES_PER_DAY_MIN} zona` };
    }
    if (zonesRaw.length > PROGRAM_ZONES_PER_DAY_MAX) {
      return { ok: false, error: `${dowLabelFull(dow)}: maksimal ${PROGRAM_ZONES_PER_DAY_MAX} zona per hari` };
    }
    const zones: MuscleZoneKey[] = [];
    for (const z of zonesRaw) {
      if (typeof z !== 'string' || !MUSCLE_ZONE_DEF_BY_KEY[z as MuscleZoneKey]) {
        return { ok: false, error: `Zona otot tidak dikenal (${String(z)})` };
      }
      if (zones.includes(z as MuscleZoneKey)) {
        return { ok: false, error: `${dowLabelFull(dow)}: zona tidak boleh dobel` };
      }
      zones.push(z as MuscleZoneKey);
    }
    days.push({ dow, title: title || programTitleFromZones(zones), zones });
  }
  days.sort((a, b) => a.dow - b.dow);
  return { ok: true, name, emoji, days };
}

// ── Mesin payload mingguan (murni) ─────────────────────────────────────────

/** dow (0–6) dari 'yyyy-MM-dd' — UTC supaya deterministik. */
function dowOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** ymd awal minggu yang memuat `ymd` (minggu mulai weekStartDow). */
function weekStartOfYmd(ymd: string, weekStartDow: number): string {
  const diff = (dowOfYmd(ymd) - weekStartDow + 7) % 7;
  return dayKeyShift(ymd, -diff);
}

/** Selisih hari antar dua ymd (a − b). */
function ymdDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000,
  );
}

/** "Minggu ke-N" sejak aktivasi (min 1); tanpa startedAt → 1. */
export function weekNumberOf(startedYmd: string | null, weekStartYmd: string, weekStartDow: number): number {
  if (!startedYmd) return 1;
  const start = weekStartOfYmd(startedYmd, weekStartDow);
  const weeks = Math.floor(ymdDiffDays(weekStartYmd, start) / 7) + 1;
  return Math.max(1, weeks);
}

/**
 * Bangun payload penuh. `zoneDoneByYmd` = peta ymd → set zona yang tercatat
 * selesai hari itu (API memasukkan sesi Full Body sebagai "semua zona" —
 * konsisten fullBodyContrib). Baris saved dengan daysJson rusak sudah
 * difilter PEMANGGIL API.
 */
export function computeProgramPayload(args: {
  saved: GymProgramSaved[];
  zoneDoneByYmd: Map<string, Set<MuscleZoneKey>>;
  todayYmd: string;
  weekStartYmd: string;
  weekStartDow: number;
}): GymProgramPayload {
  const { saved, zoneDoneByYmd, todayYmd, weekStartYmd, weekStartDow } = args;

  const zoneDone = (ymd: string, zone: MuscleZoneKey): boolean =>
    zoneDoneByYmd.get(ymd)?.has(zone) ?? false;

  const activeRow = saved.find((p) => p.isActive) ?? null;

  let active: GymProgramActive | null = null;
  if (activeRow) {
    const daysByDow = new Map(activeRow.days.map((d) => [d.dow, d]));
    // Batas periode: hari sebelum aktivasi program bukan bagian minggu
    // berjalan (tidak boleh dihitung "terlewat" — program baru aktif
    // pertengahan minggu tetap mulai bersih).
    const startedYmd = activeRow.startedAt ? activeRow.startedAt.slice(0, 10) : null;

    // 7 sel minggu (awal minggu pengaturan → 6 hari berikutnya).
    const week: GymProgramWeekEntry[] = [];
    for (let i = 0; i < 7; i++) {
      const ymd = dayKeyShift(weekStartYmd, i);
      const dow = dowOfYmd(ymd);
      const day = daysByDow.get(dow) ?? null;
      const zones = day?.zones ?? [];
      const doneCount = zones.filter((z) => zoneDone(ymd, z)).length;
      week.push({
        ymd,
        dow,
        title: day?.title ?? null,
        zones,
        doneCount,
        done: zones.length > 0 && doneCount === zones.length,
        isToday: ymd === todayYmd,
        isPast: ymd < todayYmd,
        isFuture: ymd > todayYmd,
        beforeStart: startedYmd !== null && ymd < startedYmd,
      });
    }

    // Statistik: hari terjadwal = punya zona DAN dalam periode program
    // (sejak aktivasi). "Missed" hanya hari yang SUDAH LEWAT; hari ini yang
    // belum tuntas tidak dihitung (masih berjalan).
    let scheduled = 0;
    let done = 0;
    let missed = 0;
    let upcoming = 0;
    for (const e of week) {
      if (e.zones.length === 0 || e.beforeStart) continue;
      scheduled += 1;
      if (e.isPast) {
        if (e.done) done += 1;
        else missed += 1;
      } else if (e.isFuture) {
        upcoming += 1;
      }
      // hari ini: belum dihitung (done hanya dihitung bila tuntas — di bawah).
      if (e.isToday && e.done) done += 1;
    }
    const adherenceBase = done + missed;
    const adherencePct =
      adherenceBase > 0 ? Math.round((done / adherenceBase) * 100) : null;

    // Hari ini (null bila istirahat).
    const todayDow = dowOfYmd(todayYmd);
    const todayDay = daysByDow.get(todayDow) ?? null;
    const today: GymProgramToday | null = todayDay
      ? {
          ymd: todayYmd,
          dow: todayDow,
          title: todayDay.title,
          zones: todayDay.zones,
          zoneDone: todayDay.zones.filter((z) => zoneDone(todayYmd, z)),
          done: todayDay.zones.length > 0 && todayDay.zones.every((z) => zoneDone(todayYmd, z)),
        }
      : null;

    active = {
      id: activeRow.id,
      name: activeRow.name,
      emoji: activeRow.emoji,
      startedAt: activeRow.startedAt,
      weekNumber: weekNumberOf(startedYmd, weekStartYmd, weekStartDow),
      today,
      week,
      stats: { scheduled, done, missed, upcoming, adherencePct },
    };
  }

  return {
    todayYmd,
    weekStartYmd,
    weekStartDow,
    active,
    saved,
  };
}
