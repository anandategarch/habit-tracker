// ---------------------------------------------------------------------------
// lib/date-utils.ts — pengganti date-fns berbasis Intl native (FIX-TIER3).
//
// Output identik dengan date-fns untuk SEMUA pola yang dipakai aplikasi:
// 'yyyy-MM-dd', 'yyyy-MM', 'MMMM yyyy', 'MMM d', 'EEE', 'EEEE', 'HH:mm'.
// Label hari/bulan memakai locale Indonesia (id) — konsisten keputusan
// integrasi i18n (worklog 6-integration): chart/kalender berbahasa Indonesia.
//
// PENTING TZ: fungsi komponen (getFullYear dsb.) memakai komponen UTC dari
// tanggal yang DIBANGUN UTC (storage konvensi). Untuk "hari ini" Jakarta
// gunakan jakartaDateString() dari lib/timezone.
// ---------------------------------------------------------------------------

import { jakartaDateString } from './timezone';

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

// --- Locale object (kompatibel pemakaian date-fns `locale: id`) -----------
export const id = {
  code: 'id',
  options: { weekStartsOn: 1 as const },
} as const;

// --- Formatter cache -------------------------------------------------------
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(pattern: string, locale = 'id'): Intl.DateTimeFormat {
  const key = `${locale}|${pattern}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('id-ID', buildOptions(pattern));
    cache.set(key, f);
  }
  return f;
}
function buildOptions(pattern: string): Intl.DateTimeFormatOptions {
  switch (pattern) {
    case 'EEEE':
      return { timeZone: 'UTC', weekday: 'long' };
    case 'EEE':
      return { timeZone: 'UTC', weekday: 'short' };
    case 'MMMM':
      return { timeZone: 'UTC', month: 'long' };
    case 'MMM':
      return { timeZone: 'UTC', month: 'short' };
    case 'MMMM yyyy':
      return { timeZone: 'UTC', month: 'long', year: 'numeric' };
    case 'MMM d':
      return { timeZone: 'UTC', month: 'short', day: 'numeric' };
    case 'MMMM d':
      return { timeZone: 'UTC', month: 'long', day: 'numeric' };
    case 'yyyy-MM-dd':
      return { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' };
    case 'yyyy-MM':
      return { timeZone: 'UTC', year: 'numeric', month: '2-digit' };
    case 'HH:mm':
      return { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false };
    case 'd':
      return { timeZone: 'UTC', day: 'numeric' };
    default:
      return { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' };
  }
}

/** date-fns `format` subset. Default locale 'id'. date HARUS dibangun UTC (konvensi app). */
export function format(date: Date, pattern: string, _opts?: { locale?: unknown }): string {
  if (Number.isNaN(date.getTime())) return '';
  switch (pattern) {
    case 'yyyy-MM-dd':
      return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
    case 'yyyy-MM':
      return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
    case 'HH:mm':
      return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
    case 'yyyy':
      return String(date.getUTCFullYear());
    default:
      return fmt(pattern).format(date);
  }
}

// --- akses komponen (UTC — konvensi storage) --------------------------------
export const getMonth = (d: Date) => d.getUTCMonth();
export const getDate = (d: Date) => d.getUTCDate();
export const getHours = (d: Date) => d.getUTCHours();
export const getMinutes = (d: Date) => d.getUTCMinutes();

// --- aritmetika --------------------------------------------------------------
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
export const subDays = (d: Date, n: number) => addDays(d, -n);
export const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
};
export const subMonths = (d: Date, n: number) => addMonths(d, -n);
export const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const endOfDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
export const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const endOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
export const startOfWeek = (d: Date, opts?: { weekStartsOn?: 0 | 1 }) => {
  const ws = opts?.weekStartsOn ?? 1;
  const day = d.getUTCDay();
  const diff = (day - ws + 7) % 7;
  return startOfDay(addDays(d, -diff));
};
export const endOfWeek = (d: Date, opts?: { weekStartsOn?: 0 | 1 }) => {
  const ws = opts?.weekStartsOn ?? 1;
  const day = d.getUTCDay();
  const diff = (day - ws + 7) % 7;
  return endOfDay(addDays(d, 6 - diff));
};
export function eachDayOfInterval(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) out.push(new Date(d));
  return out;
}
export const isToday = (d: Date) => format(d, 'yyyy-MM-dd') === todayYMD();
export const isSameMonth = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
export const isBefore = (a: Date, b: Date) => a.getTime() < b.getTime();
export const isFuture = (d: Date) => d.getTime() > Date.now();
export const getDaysInMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();

function todayYMD(): string {
  // BUGHUNT-54 (3-b #7): "hari ini" kini mengikuti Jakarta (konvensi seluruh
  // app — Asia/Jakarta). Dulu membaca tanggal BROWSER-lokal: user non-WIB
  // melihat ring "Hari Ini" kalender di tanggal kemarin (isToday membanding-
  // kan YMD browser vs tanggal UTC-midnight grid). timezone.ts tanpa import
  // apa pun → tidak ada import cycle dari sini.
  return jakartaDateString();
}

// --- formatter khusus chart (label pendek Indonesia) ------------------------
const EEE_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const EEEE_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MMM_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const eeeIdFormatter = (d: Date) => EEE_ID[d.getUTCDay()];
export const eeeeIdFormatter = (d: Date) => EEEE_ID[d.getUTCDay()];
export const mmmDdIdFormatter = (d: Date) => `${d.getUTCDate()} ${MMM_ID[d.getUTCMonth()]}`;
