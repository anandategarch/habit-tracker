// ---------------------------------------------------------------------------
// Helpers
// Extracted from category-explorer.tsx during SPLIT-PHASE3.
//
// NOTE on duplication: `formatTxTime` and `formatDateShort` were previously
// inlined here and in daily-recap.tsx. They were consolidated into
// `@/lib/finance-helpers` during the CONSOLIDATION task (see worklog.md) —
// both consumers now import from there. This file only owns the helpers
// that genuinely differ between consumers:
//   - monthLabel: uses date-fns + idLocale (finance-explorer uses native
//     toLocaleDateString — different code path, kept separate).
//   - compactRupiahSafe: always uses compactRupiah (daily-recap-helpers
//     special-cases <1000 via formatRupiah — kept separate).
// ---------------------------------------------------------------------------

import { format as formatDate, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the pattern used here
// ('MMM yyyy' with id locale) — verified via test script in worklog
// FIX-TIER3 entry.
import { compactRupiah } from './finance-types';

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return formatDate(new Date(y, m - 1, 1), 'MMM yyyy', { locale: idLocale });
}

// Local compactRupiahSafe — kept separate because the daily-recap version
// has a different special-case for small amounts (<1000 → formatRupiah),
// while this version always uses compactRupiah. See worklog note.
export function compactRupiahSafe(n: number): string {
  if (n === 0) return '0';
  return compactRupiah(n);
}
