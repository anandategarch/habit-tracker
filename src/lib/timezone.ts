// ---------------------------------------------------------------------------
// lib/timezone.ts — konvensi waktu Jakarta (UTC+7) untuk seluruh aplikasi.
//
// Pelajaran dari ronde bug-hunt sebelumnya: JANGAN memakai getFullYear()/
// getMonth() browser (TZ lokal user bisa beda). Semua hari logis dihitung
// lewat offset Jakarta murni, tanggal disimpan sebagai UTC-midnight, dan
// aritmetika hari dilakukan pada string YMD (shiftYmdKey ada di
// daily-tracker-helpers, dateFromYMD/YMD konversinya di sini).
// ---------------------------------------------------------------------------

export const JAKARTA_OFFSET_MINUTES = 7 * 60; // UTC+7, tanpa DST selamanya

/** Shift sebuah Date seolah-olah dilihat dari Jakarta. HANYA untuk pembacaan komponen YMD/H/M. */
export function toJakarta(date: Date): Date {
  return new Date(date.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
}

/** Komponen tanggal Jakarta {y, m, d} dari sebuah Date (aman di semua TZ). */
export function jakartaParts(date: Date = new Date()): { y: number; m: number; d: number } {
  const shifted = toJakarta(date);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 'yyyy-MM-dd' hari INI menurut Jakarta (bukan TZ browser). */
export function jakartaDateString(now: Date = new Date()): string {
  const { y, m, d } = jakartaParts(now);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Alias eksplisit: kunci YMD Jakarta dari sebuah Date. */
export function jakartaDateKey(date: Date = new Date()): string {
  return jakartaDateString(date);
}

/** 'yyyy-MM' bulan INI menurut Jakarta. */
export function jakartaMonthString(now: Date = new Date()): string {
  const { y, m } = jakartaParts(now);
  return `${y}-${pad2(m)}`;
}

/** Komponen jam:menit:detik Jakarta sekarang. */
export function jakartaNowParts(now: Date = new Date()): { hour: number; minute: number; second: number } {
  const shifted = toJakarta(now);
  return {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** ISO waktu Jakarta sekarang dengan offset eksplisit +07:00 (untuk completedAt). */
export function jakartaNowIso(now: Date = new Date()): string {
  const shifted = toJakarta(now);
  const { y, m, d } = jakartaParts(now);
  return (
    `${y}-${pad2(m)}-${pad2(d)}T` +
    `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}+07:00`
  );
}

/** Konversi 'yyyy-MM-dd' -> Date UTC-midnight (cara penyimpanan HabitLog/DailyLog). */
export function dateFromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

/** Konversi 'yyyy-MM-dd' -> Date tengah hari UTC (12:00Z) — aman untuk format() lokal browser mana pun. */
export function dateFromYMDNoon(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Validasi + normalisasi 'yyyy-MM-dd' ketat (tolak 2026-02-31 dsb. — guard ronde bug lama). */
export function isValidYMD(ymd: unknown): ymd is string {
  if (typeof ymd !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Validasi 'yyyy-MM' ketat (bulan 01..12). */
export function isValidMonth(ym: unknown): ym is string {
  if (typeof ymdGuard(ym) !== 'string') return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym as string);
}
function ymdGuard(v: unknown) {
  return typeof v === 'string' ? v : undefined;
}

/** Rentang DateTime UTC-midnight [awal, akhir] dari bulan Jakarta 'yyyy-MM' (akhir inklusif). */
export function monthRangeYMD(ym: string): { start: Date; end: Date } {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0)); // hari terakhir bulan
  return { start, end };
}

/** Timestamp UTC dari tengah malam Jakarta (00:00+07:00) untuk YMD tertentu.
 *  Dipakai untuk membedakan "selesai HARI INI" vs "selesai hari sebelumnya"
 *  berdasarkan completedAt — apa pun dayKey-nya (kapan saja / target depan). */
export function jakartaDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - JAKARTA_OFFSET_MINUTES * 60_000);
}
