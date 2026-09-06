// ---------------------------------------------------------------------------
// Helpers
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
//
// NOTE on duplication: `monthLabel` here uses native `toLocaleDateString`
// (id-ID), while category-explorer-helpers uses date-fns + idLocale. The
// @/lib/finance-helpers comment explicitly notes these are intentionally
// NOT consolidated because consolidation would change the code path
// ("be conservative" rule). Keeping local.
// ---------------------------------------------------------------------------

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
}

export function fullMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/** Build last 6 months options for the picker */
export function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    opts.push({ value: key, label });
  }
  return opts;
}

// JAKARTA_OFFSET_MS removed — all timezone conversions now use
// jakartaDateKey() from @/lib/timezone which works on any server TZ.
