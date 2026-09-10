// lib/finance-helpers.ts — helper tampilan transaksi (dipakai overview, recap, explorer).
import { format } from '@/lib/date-utils';

/** Waktu transaksi 'HH.mm' (format Indonesia). */
export function formatTxTime(isoDate: string | Date): string {
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'HH:mm').replace(':', '.');
}

/** '8 Sep' — tanggal pendek Indonesia. */
export function formatDateShort(isoDate: string | Date): string {
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS_ID[d.getUTCMonth()]}`;
}

export const MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/** Warna tint kategori dari warna hex (untuk avatar emoji squircle). */
export function tintFromColor(hex: string, alpha = 0.12): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgba(20,184,166,0.12)';
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
