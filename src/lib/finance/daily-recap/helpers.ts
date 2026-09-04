// ── Pure helpers for the daily-recap API ─────────────────────────────────
//
// Stateless utility functions extracted from the original route.ts so the
// route handler stays focused on orchestration. None of these touch the
// DB — they're all pure transformations over already-fetched data.

export const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Compute linear regression slope of daily amounts. Positive = uptrend. */
export function trendSlope(values: number[]): { slope: number; direction: 'up' | 'down' | 'flat' } {
  if (values.length < 2) return { slope: 0, direction: 'flat' };
  const n = values.length;
  const xs = values.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  // Threshold: slope > 1% of mean = significant
  const threshold = Math.max(1000, meanY * 0.01);
  return {
    slope,
    direction: slope > threshold ? 'up' : slope < -threshold ? 'down' : 'flat',
  };
}

/** Compute z-score for anomaly detection. */
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/** Standard deviation (population). */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Fallback emoji/color for default-named categories that still have the
 * placeholder 📦 emoji in the DB. Mirrors the FALLBACK_EXPENSE list in
 * finance-types.ts so the API and the client resolveEmoji() helper stay
 * in sync. (We don't import from finance-types to keep the API module
 * server-only — finance-types is a client-shared file.)
 */
export const FALLBACK_CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  'Makanan & Minuman': { emoji: '🍽️', color: '#ef4444' },
  'Transportasi': { emoji: '🚗', color: '#f97316' },
  'Belanja': { emoji: '🛍️', color: '#eab308' },
  'Hiburan': { emoji: '🎮', color: '#a855f7' },
  'Kesehatan': { emoji: '🏥', color: '#ec4899' },
  'Pendidikan': { emoji: '📚', color: '#8b5cf6' },
  'Tagihan & Utilitas': { emoji: '📋', color: '#a855f7' },
  'Tabungan & Investasi': { emoji: '🏦', color: '#14b8a6' },
  'Gaji': { emoji: '💰', color: '#22c55e' },
  'Freelance': { emoji: '💻', color: '#06b6d4' },
  'Investasi': { emoji: '📈', color: '#f59e0b' },
  'Bisnis': { emoji: '🏢', color: '#8b5cf6' },
  // Adjustment transaction category (created by PATCH /sources/[id]/balance)
  'Penyesuaian Saldo': { emoji: '🔧', color: '#64748b' },
  // Transfer between fund sources (created by POST /api/finance/transfer)
  'Transfer Antar Sumber': { emoji: '🔄', color: '#14b8a6' },
};

export const DEFAULT_EMOJI = '📦';
export const DEFAULT_COLOR = '#78716c';

/**
 * Resolve a category's display emoji/color.
 * - If the FinanceCategory row has a non-default emoji, use it.
 * - Else, look up the fallback map by name (covers default-named categories
 *   that the user never customized).
 * - Else, fall back to 📦 / #78716c.
 */
export function resolveCategoryMeta(
  name: string,
  dbRow?: { emoji: string; color: string }
): { emoji: string; color: string } {
  if (dbRow && dbRow.emoji !== DEFAULT_EMOJI) {
    return { emoji: dbRow.emoji, color: dbRow.color || DEFAULT_COLOR };
  }
  const fallback = FALLBACK_CATEGORY_META[name];
  if (fallback) return fallback;
  if (dbRow) return { emoji: dbRow.emoji || DEFAULT_EMOJI, color: dbRow.color || DEFAULT_COLOR };
  return { emoji: DEFAULT_EMOJI, color: DEFAULT_COLOR };
}

/**
 * Parse the projectionCategoryIds JSON string from AppSettings into an
 * array of category names. Returns [] on any failure — empty means
 * "use all expense categories" (the default, pre-feature behaviour).
 * Duplicates are removed so downstream Set lookups stay cheap.
 *
 * BUG-1 fix: Truncate to AT MOST ONE category. Fase 1 was originally
 * multi-select chips (could store ["A","B","C"]), but the UI is now a
 * single-select dropdown. Without truncation, legacy multi-category data
 * would make the dropdown show only the first category while the API
 * silently filtered by all of them — inconsistent and confusing. We
 * truncate to [first] so the dropdown always reflects the actual filter.
 * Empty array (all categories) passes through unchanged.
 */
export function parseProjectionCategoryNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const names = parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
    const unique = Array.from(new Set(names));
    return unique.length > 0 ? [unique[0]] : [];
  } catch {
    return [];
  }
}

/**
 * Compact Rupiah formatter for alert messages — "1.2jt" / "68k" / "500".
 * Kept local to the daily-recap domain (not added to money.ts) because the
 * recap UI uses a different compact format than the rest of the app.
 */
export function formatRupiahShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
