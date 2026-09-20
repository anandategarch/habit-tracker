// ---------------------------------------------------------------------------
// lib/habit-schedule.ts — Jadwal Tampil habit (Task 37).
//
// Habit tidak harus muncul setiap hari:
//  * daily    → tampil setiap hari (default; null di DB = kompatibel mundur)
//  * weekly   → tampil hanya di hari-hari tertentu (mis. Sen & Rab)
//  * monthly  → tampil hanya di tanggal tertentu (mis. tgl 1 & 15)
//
// Disimpan sebagai JSON string di Habit.scheduleJson. Modul ini sengaja TIDAK
// meng-import modul lain (dashboard-helpers meng-import file ini — harus
// bebas siklus). Semua tanggal = kunci YMD 'yyyy-MM-dd' (konvensi app).
// ---------------------------------------------------------------------------

export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'weekly'; days: number[] } // 0=Minggu .. 6=Sabtu (getUTCDay)
  | { kind: 'monthly'; dates: number[] }; // 1..31 (tanggal dalam bulan)

const DAILY: HabitSchedule = { kind: 'daily' };

/** Label hari pendek Indonesia, indeks = getUTCDay() (0=Minggu). */
export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Min',
  1: 'Sen',
  2: 'Sel',
  3: 'Rab',
  4: 'Kam',
  5: 'Jum',
  6: 'Sab',
};

/** Urutan tampil hari di form (Senin dulu — konvensi Indonesia). */
export const WEEKDAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];

/** Aritmetika YMD lokal (duplikat kecil dari dashboard-helpers — bebas siklus). */
function shiftYmdLocal(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + delta * 86_400_000);
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`;
}

function toUniqueInts(raw: unknown, min: number, max: number): number[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<number>();
  for (const v of raw) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isInteger(n) && n >= min && n <= max) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Normalisasi input jadwal (objek apa adanya / hasil JSON.parse).
 * Return null bila bentuknya tidak valid atau kosong (mis. weekly tanpa hari).
 * {kind:'daily'} / kind kosong → daily.
 */
export function normalizeSchedule(raw: unknown): HabitSchedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (kind === undefined || kind === null || kind === 'daily') return DAILY;
  if (kind === 'weekly') {
    const days = toUniqueInts(r.days, 0, 6);
    return days.length > 0 ? { kind: 'weekly', days } : null;
  }
  if (kind === 'monthly') {
    const dates = toUniqueInts(r.dates, 1, 31);
    return dates.length > 0 ? { kind: 'monthly', dates } : null;
  }
  return null;
}

/** Parse kolom Habit.scheduleJson → jadwal (toleran; apapun yang rusak = daily). */
export function parseSchedule(json: string | null | undefined): HabitSchedule {
  if (!json) return DAILY;
  try {
    return normalizeSchedule(JSON.parse(json)) ?? DAILY;
  } catch {
    return DAILY;
  }
}

/** Jadwal → string JSON untuk disimpan (daily → null). */
export function serializeSchedule(s: HabitSchedule): string | null {
  if (s.kind === 'daily') return null;
  return JSON.stringify(s);
}

/** Apakah habit tampil pada hari `ymd`? Bentuk YMD aneh → true (jangan sembunyikan). */
export function isScheduledOn(s: HabitSchedule, ymd: string): boolean {
  if (s.kind === 'daily') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return true;
  if (s.kind === 'weekly') {
    const [y, m, d] = ymd.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return s.days.includes(dow);
  }
  return s.dates.includes(Number(ymd.slice(8, 10)));
}

/**
 * Kemunculan terjadwal BERIKUTNYA setelah `fromYmd` (eksklusif) — dipakai
 * empty-state tracker ("Olahraga kembali Rab ini"). Scan maks 400 hari
 * (cukup untuk jadwal bulanan tgl 31 pun). null = tidak ketemu / daily.
 */
export function nextScheduledYmd(s: HabitSchedule, fromYmd: string): string | null {
  if (s.kind === 'daily') return null;
  let cursor = shiftYmdLocal(fromYmd, 1);
  for (let i = 0; i < 400; i++) {
    if (isScheduledOn(s, cursor)) return cursor;
    cursor = shiftYmdLocal(cursor, 1);
  }
  return null;
}

/** Label pendek: 'Sen, Rab' / 'tgl 1, 15'. */
export function scheduleLabel(s: HabitSchedule): string {
  if (s.kind === 'daily') return 'Setiap hari';
  if (s.kind === 'weekly') return s.days.map((d) => WEEKDAY_LABELS[d] ?? String(d)).join(', ');
  return `tgl ${s.dates.join(', ')}`;
}

/** Label sangat pendek untuk kemunculan berikutnya: 'Rab' / 'tgl 15'. */
export function nextOccurrenceLabel(s: HabitSchedule, ymd: string): string | null {
  if (s.kind === 'daily') return null;
  if (s.kind === 'weekly') {
    const [y, m, d] = ymd.split('-').map(Number);
    return WEEKDAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? null;
  }
  return `tgl ${Number(ymd.slice(8, 10))}`;
}
