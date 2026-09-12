// components/habit-tracker/category-explorer-helpers.ts — helper kecil
// sub-tab Kategori/explorer. compactRupiahSafe & monthLabel delegasi ke
// finance-types (single source, dipakai juga area lain).

export { compactRupiahSafe, monthLabel } from './finance-types';

import { format, id as idLocale } from '@/lib/date-utils';

/** Label bulan panjang untuk opsi dropdown ("September 2026"). */
export function monthOptionLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  // Task 31 (bug "pilih September kok kosong"): format() membaca komponen UTC,
  // jadi tanggal WAJIB dibangun Date.UTC. Dulu dibangun lokal — bagi pengguna
  // UTC+ (Jakarta +7) tgl-1 lokal = akhir bulan sebelumnya di UTC → label
  // bergeser −1 bulan → memilih opsi "September" ternyata memilih bulan lain.
  return format(new Date(Date.UTC(y, m - 1, 1)), 'MMMM yyyy', { locale: idLocale });
}
