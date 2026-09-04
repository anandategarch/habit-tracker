// ── Shared Finance Helpers ───────────────────────────────────────────────
// Consolidated from daily-recap-helpers.ts and category-explorer.tsx during
// the CONSOLIDATION task (see worklog.md). Only helpers with identical (or
// functionally equivalent) implementations across both files were moved here.
//
// NOT consolidated (kept local in each consumer):
//   - compactRupiahSafe: implementations differ significantly
//     (daily-recap-helpers handles <1000 specially via formatRupiah;
//      category-explorer always uses compactRupiah). See worklog note.
//   - monthLabel: implementations use different libraries
//     (category-explorer uses date-fns + idLocale; finance-explorer uses
//      native toLocaleDateString). Output is similar but consolidation
//     would change the code path — kept separate per "be conservative" rule.

/**
 * Format a transaction's ISO date string to a Jakarta wall-clock time.
 * Uses `toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })` — the
 * SAME code path as the Transactions tab (`finance-transactions.tsx`).
 *
 * Returns "HH.MM" (Indonesian format uses dot separator) or empty string.
 */
export function formatTxTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Format a YYYY-MM-DD date string as "DD Mon" (e.g. "31 Jul") using the
 * Indonesian locale. Used by the daily recap and category explorer views.
 */
export function formatDateShort(d: string): string {
  const [y, m, day] = d.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
