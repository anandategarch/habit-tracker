// ── Alerts builder for the daily-recap API ───────────────────────────────
//
// Encapsulates the 7 alert types the daily recap can surface:
//   - over_budget / nearing_budget — daily budget status checks
//   - big_ticket — single tx ≥ 30% of today's spend
//   - unusual_activity — tx count ≥ 2× the 7-day avg
//   - late_night — expense tx between 22:00–04:59 Jakarta time
//   - first_tx_nudge — no tx by 14:00
//   - recurring — same description + similar amount (±10%) in ≥3 months
//
// Recurring detection needs a wider 95-day history than the rest of the
// recap (which only fetches 30 days), so it issues its own DB query here.

import { db } from '@/lib/db';
import { jakartaDateKey } from '@/lib/timezone';
import type { Alert, DailyRecapContext } from './types';
import { formatRupiahShort } from './helpers';

export async function buildAlerts(ctx: DailyRecapContext): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const {
    dailyBudget,
    topTransaction,
    todayExpense,
    daily7d,
    txByDate,
    todayTx,
    todayTransactions,
    todayParts,
    todayTxCount,
  } = ctx;

  // ── Over / nearing daily budget ──────────────────────────────────
  if (dailyBudget) {
    if (dailyBudget.status === 'over') {
      alerts.push({
        type: 'over_budget',
        severity: 'danger',
        message: `Over budget harian ${formatRupiahShort(Math.abs(dailyBudget.remaining))}`,
        data: { over: Math.abs(dailyBudget.remaining) },
      });
    } else if (dailyBudget.status === 'nearing') {
      alerts.push({
        type: 'nearing_budget',
        severity: 'warning',
        message: `Hampir habis budget — sisa ${formatRupiahShort(dailyBudget.remaining)}`,
        data: { remaining: dailyBudget.remaining },
      });
    }
  }

  // ── Big-ticket purchase (single tx ≥ 30% of today's spend) ───────
  if (topTransaction && todayExpense > 0 && topTransaction.amount / todayExpense >= 0.3) {
    alerts.push({
      type: 'big_ticket',
      severity: 'info',
      message: `${topTransaction.category} ${formatRupiahShort(topTransaction.amount)} = ${Math.round((topTransaction.amount / todayExpense) * 100)}% spending hari ini`,
      data: { amount: topTransaction.amount, category: topTransaction.category },
    });
  }

  // ── Unusual activity: 2× normal transaction count ────────────────
  const avgTxCount7d = daily7d.reduce((s, d) => {
    const dayTx = txByDate.get(d.date) ?? [];
    return s + dayTx.filter((t) => t.type === 'expense').length;
  }, 0) / 7;
  if (avgTxCount7d > 0 && todayTxCount >= avgTxCount7d * 2 && todayTxCount >= 4) {
    alerts.push({
      type: 'unusual_activity',
      severity: 'info',
      message: `Aktivitas ${Math.round(todayTxCount / avgTxCount7d)}× normal — ${todayTxCount} transaksi vs rata-rata ${avgTxCount7d.toFixed(1)}`,
      data: { count: todayTxCount, avg: avgTxCount7d },
    });
  }

  // ── Late night spending: tx between 22:00-04:00 Jakarta time ─────
  // We need to re-extract the hour from the ISO date string since the
  // `TodayTransaction` type no longer carries an `hour` field (it now
  // carries the full ISO date for accurate minute-precision display).
  const lateNightTx = todayTransactions.filter((t) => {
    if (t.type !== 'expense') return false;
    const h = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        hour12: false,
      }).format(new Date(t.date)),
      10
    ) % 24;
    return h >= 22 || h < 5; // aligned with heatmap coloring (h < 5)
  });
  if (lateNightTx.length > 0) {
    const lateNightTotal = lateNightTx.reduce((s, t) => s + t.amount, 0);
    // Format the first late-night tx's time as "HH.MM" (Indonesian).
    const firstTime = new Date(lateNightTx[0].date).toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
    alerts.push({
      type: 'late_night',
      severity: 'info',
      message: `🌙 Late night spending: ${formatRupiahShort(lateNightTotal)} jam ${firstTime}`,
      data: { total: lateNightTotal, count: lateNightTx.length },
    });
  }

  // ── First transaction nudge: no tx by 14:00 ──────────────────────
  if (todayTxCount === 0 && todayParts.hours >= 14) {
    alerts.push({
      type: 'first_tx_nudge',
      severity: 'info',
      message: `Belum ada transaksi hari ini — catat pengeluaran pertamamu`,
    });
  }

  // ── Recurring detected: same description + similar amount (±10%) ──
  // in ≥3 different months.
  //
  // Two bugs fixed here:
  //   1. `allRecentTx` only covers 30 days, so a 30-day window can span at
  //      most 3 calendar months (and only when today is day 1-2 of a month
  //      following a 28-31 day month). For ~93% of the month, ≥3 months was
  //      unreachable — feature was dead code. Fix: fetch a wider 95-day
  //      window specifically for recurring detection.
  //   2. The comment promised "similar amount (±10%)" but the code only
  //      checked description equality. Fix: add the ±10% amount check.
  if (todayTransactions.length > 0) {
    // Fetch 95 days of history for recurring detection (3+ months coverage).
    // Separate query — small payload since we only need description+amount+date.
    const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
    const recurringHistoryTx = await db.transaction.findMany({
      where: {
        date: { gte: ninetyFiveDaysAgo },
        type: 'expense',
        // BUG-14 fix: exclude internal movements from recurring detection
        category: { notIn: ['Penyesuaian Saldo', 'Transfer Antar Sumber'] },
      },
      select: { description: true, amount: true, date: true, category: true },
    });

    for (const tx of todayTransactions) {
      if (tx.type !== 'expense' || !tx.description) continue;
      const matchingMonths = new Set<string>();
      for (const old of recurringHistoryTx) {
        if (!old.description) continue;
        if (old.description !== tx.description) continue;
        // ±10% amount similarity check (was missing — comment promised it).
        // Skip if amounts differ by more than 10% of today's amount.
        if (tx.amount > 0 && Math.abs(old.amount - tx.amount) / tx.amount > 0.1) continue;
        const oldKey = jakartaDateKey(old.date);
        matchingMonths.add(oldKey.slice(0, 7));
      }
      if (matchingMonths.size >= 3) {
        alerts.push({
          type: 'recurring',
          severity: 'info',
          message: `🔄 "${tx.description}" muncul ${matchingMonths.size} bulan — tagihan berulang?`,
          data: { description: tx.description, months: matchingMonths.size },
        });
        break; // only show one recurring alert
      }
    }
  }

  return alerts;
}
