// ── Per-category deep stats for the daily-recap API ──────────────────────
//
// For each category that has transactions today, computes three windows
// of stats (30-day / current-month / all-time) across two dimensions
// (per-transaction and per-day). All-time fields are returned as 0 here
// — they're lazy-loaded via a separate endpoint when the user clicks the
// "All-time" tab in the Insight UI (see /api/finance/category-alltime).

import { jakartaDateKey } from '@/lib/timezone';
import type { CategoryStats, DailyRecapContext } from './types';

export function buildCategoryStats(
  ctx: DailyRecapContext,
  catDayTotals: Map<string, Map<string, number>>
): CategoryStats[] {
  const { todayCategoryMap, allRecentTx, monthTx, metaFor } = ctx;

  // ── Per-tx amount arrays (30-day window) ─────────────────────────
  const catTxAmounts = new Map<string, number[]>(); // category -> [amount, amount, ...]
  for (const tx of allRecentTx) {
    if (tx.type !== 'expense') continue;
    if (!catTxAmounts.has(tx.category)) catTxAmounts.set(tx.category, []);
    catTxAmounts.get(tx.category)!.push(tx.amount);
  }

  // ── Current-month per-category stats ─────────────────────────────
  // Reuse `monthTx` (already filtered to this Jakarta month). Build
  // per-category tx-amount arrays + day-total maps, same structure as
  // the 30-day maps above. Only expense txs are counted.
  const monthCatTxAmounts = new Map<string, number[]>();
  const monthCatDayTotals = new Map<string, Map<string, number>>();
  for (const tx of monthTx) {
    if (tx.type !== 'expense') continue;
    if (!monthCatTxAmounts.has(tx.category)) {
      monthCatTxAmounts.set(tx.category, []);
      monthCatDayTotals.set(tx.category, new Map());
    }
    monthCatTxAmounts.get(tx.category)!.push(tx.amount);
    const dk = jakartaDateKey(tx.date);
    const dm = monthCatDayTotals.get(tx.category)!;
    dm.set(dk, (dm.get(dk) ?? 0) + tx.amount);
  }

  // ── All-time per-category stats — LAZY LOADED ────────────────────
  // Performance fix: the all-time query (fetches ALL expense transactions
  // ever recorded) was causing slow initial page load on mobile/production
  // (Turso remote DB round-trip for potentially thousands of rows).
  // Now the all-time stats are loaded LAZILY via a separate endpoint
  // (/api/finance/category-alltime) ONLY when the user clicks the
  // "All-time" tab in the Insight section. Initial daily-recap load
  // returns 0 for all-time fields — the UI merges the lazy data when
  // it arrives.
  // The month fields are still computed here (cheap — reuses monthTx
  // which is already fetched by the orchestrator).

  const categoryStats: CategoryStats[] = [];
  for (const [cat, dayMap] of catDayTotals.entries()) {
    const todayEntry = todayCategoryMap.get(cat);
    if (!todayEntry) continue; // only categories with tx today
    const txAmounts = catTxAmounts.get(cat) ?? [];
    const dailyTotals = Array.from(dayMap.values());

    const maxTransaction = txAmounts.length > 0 ? Math.max(...txAmounts) : 0;
    const avgTransaction = txAmounts.length > 0
      ? Math.round(txAmounts.reduce((a, b) => a + b, 0) / txAmounts.length)
      : 0;
    const maxDaily = dailyTotals.length > 0 ? Math.max(...dailyTotals) : 0;
    const avgDaily = dailyTotals.length > 0
      ? Math.round(dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length)
      : 0;

    // Current-month stats
    const monthTxAmts = monthCatTxAmounts.get(cat) ?? [];
    const monthDayTots = Array.from((monthCatDayTotals.get(cat) ?? new Map()).values());
    const monthMaxTransaction = monthTxAmts.length > 0 ? Math.max(...monthTxAmts) : 0;
    const monthAvgTransaction = monthTxAmts.length > 0
      ? Math.round(monthTxAmts.reduce((a, b) => a + b, 0) / monthTxAmts.length)
      : 0;
    const monthMaxDaily = monthDayTots.length > 0 ? Math.max(...monthDayTots) : 0;
    const monthAvgDaily = monthDayTots.length > 0
      ? Math.round(monthDayTots.reduce((a, b) => a + b, 0) / monthDayTots.length)
      : 0;

    // All-time stats: set to 0 here — loaded LAZILY via separate endpoint
    // when user switches to "All-time" tab. See category-alltime/route.ts.
    // The UI merges the lazy data into categoryStats when it arrives.
    categoryStats.push({
      name: cat,
      todayAmount: todayEntry.amount,
      todayCount: todayEntry.count,
      maxTransaction,
      avgTransaction,
      maxDaily,
      avgDaily,
      deltaVsAvgDaily: todayEntry.amount - avgDaily,
      emoji: metaFor(cat).emoji,
      color: metaFor(cat).color,
      monthMaxTransaction,
      monthAvgTransaction,
      monthMaxDaily,
      monthAvgDaily,
      allTimeMaxTransaction: 0,
      allTimeAvgTransaction: 0,
      allTimeMaxDaily: 0,
      allTimeAvgDaily: 0,
    });
  }
  // Sort by todayAmount desc — biggest spending today first.
  categoryStats.sort((a, b) => b.todayAmount - a.todayAmount);

  return categoryStats;
}
