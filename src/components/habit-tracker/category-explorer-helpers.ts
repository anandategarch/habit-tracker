// components/habit-tracker/category-explorer-helpers.ts — helper kecil
// sub-tab Kategori/explorer. compactRupiahSafe & monthLabel delegasi ke
// finance-types (single source, dipakai juga area lain).

export { compactRupiahSafe, monthLabel } from './finance-types';

import { format, id as idLocale } from '@/lib/date-utils';

/** Label bulan panjang untuk opsi dropdown ("September 2026"). */
export function monthOptionLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: idLocale });
}
