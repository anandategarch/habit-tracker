// ── Today's aggregates for the daily-recap API ────────────────────────────
//
// Pure module: computes all "today" aggregates from the bucket of today's
// transactions (already fetched + filtered by the route). No DB calls.
//
// Returns:
//   - todayIncome, todayExpense: sums of income/expense amounts
//   - hourlyBreakdown: 48-element array (30-min buckets) of expense per bucket.
//     Index = hour*2 + (minute >= 30 ? 1 : 0). Previously used 24 buckets
//     (per hour), which rounded 08.30 down to "08:00" in the heatmap —
//     misleading. 30-minute granularity gives the user a more accurate
//     picture of when they actually spent (a 08.30 coffee now shows in its
//     own bar, not lumped into "08:00").
//   - todayCategoryMap: Map<categoryName, {amount, count}> (expense only)
//   - todaySourceMap: Map<sourceName, amount> (expense only)
//   - todayCategories: sorted CategoryBreakdown[] (derived from todayCategoryMap)
//   - todaySources: sorted SourceBreakdown[] (derived from todaySourceMap)
//   - peakHour: 30-min bucket with highest spend, derived to hour
//   - topTransaction: largest single expense today (or null)
//   - todayTransactions: all today's tx as TodayTransaction[]
//   - todayTxCount: count of expense transactions today

import type {
  CategoryBreakdown,
  SourceBreakdown,
  TodayTransaction,
  TransactionRow,
} from './types';

export interface TodayAggregates {
  todayIncome: number;
  todayExpense: number;
  hourlyBreakdown: number[];
  todayCategoryMap: Map<string, { amount: number; count: number }>;
  todaySourceMap: Map<string, number>;
  todayCategories: CategoryBreakdown[];
  todaySources: SourceBreakdown[];
  peakHour: { hour: number; amount: number } | null;
  topTransaction: TodayTransaction | null;
  todayTransactions: TodayTransaction[];
  todayTxCount: number;
}

/**
 * Compute every "today" aggregate from the bucket of today's transactions.
 *
 * @param todayTx The bucket of today's transactions (already filtered to
 *   exclude transfer/adjustment tx, already bucketed by Jakarta date key).
 * @param metaFor Resolver that returns { emoji, color } for a category name.
 *   Used to populate CategoryBreakdown.emoji / .color.
 */
export function computeTodayAggregates(
  todayTx: TransactionRow[],
  metaFor: (name: string) => { emoji: string; color: string }
): TodayAggregates {
  let todayIncome = 0, todayExpense = 0;
  const todayCategoryMap = new Map<string, { amount: number; count: number }>();
  const todaySourceMap = new Map<string, number>();
  // 48-element array: each bucket = 30 minutes.
  //   index 0  = 00:00–00:29
  //   index 1  = 00:30–00:59
  //   index 2  = 01:00–01:29
  //   ...
  //   index 47 = 23:30–23:59
  // Bucket = hour*2 + (minute >= 30 ? 1 : 0).
  // Previously used 24 buckets (per hour), which rounded 08.30 down to
  // "08:00" in the heatmap — misleading. 30-minute granularity gives the
  // user a more accurate picture of when they actually spent (a 08.30
  // coffee now shows in its own bar, not lumped into "08:00").
  const hourlyBreakdown = new Array(48).fill(0);
  const todayTransactions: TodayTransaction[] = [];
  let todayTxCount = 0;

  for (const tx of todayTx) {
    // Extract Jakarta hour + minute for the 30-min heatmap bucket.
    // We use Intl.DateTimeFormat to get timezone-correct components
    // (Asia/Jakarta), then compute bucket = hour*2 + (minute >= 30 ? 1 : 0).
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(tx.date);
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
    const minStr = parts.find((p) => p.type === 'minute')?.value ?? '0';
    const hour = parseInt(hourStr, 10) % 24;
    const minute = parseInt(minStr, 10);
    const bucket = hour * 2 + (minute >= 30 ? 1 : 0);

    if (tx.type === 'income') {
      todayIncome += tx.amount;
    } else {
      todayExpense += tx.amount;
      todayTxCount++;
      hourlyBreakdown[bucket] += tx.amount;
      const cat = todayCategoryMap.get(tx.category) ?? { amount: 0, count: 0 };
      cat.amount += tx.amount;
      cat.count += 1;
      todayCategoryMap.set(tx.category, cat);
      todaySourceMap.set(tx.source, (todaySourceMap.get(tx.source) ?? 0) + tx.amount);
    }

    todayTransactions.push({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      date: tx.date.toISOString(),
      source: tx.source,
    });
  }

  // Sort today's transactions by actual timestamp descending (newest first).
  // Previously sorted by integer hour only, which made transactions in the
  // same hour appear in nondeterministic order.
  todayTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const todayCategories: CategoryBreakdown[] = Array.from(todayCategoryMap.entries())
    .map(([name, v]) => {
      const meta = metaFor(name);
      return { name, amount: v.amount, count: v.count, emoji: meta.emoji, color: meta.color };
    })
    .sort((a, b) => b.amount - a.amount);

  const todaySources: SourceBreakdown[] = Array.from(todaySourceMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Peak hour — find the 30-min bucket with the highest spend, then
  // derive the actual hour (0-23) from it. `peakHour` is not currently
  // displayed in the UI (the heatmap visualizes peak activity), but we
  // keep it in the response for potential future use. Now scans all 48
  // buckets (was 24) since hourlyBreakdown is 48-element.
  let peakHour: { hour: number; amount: number } | null = null;
  for (let b = 0; b < 48; b++) {
    if (hourlyBreakdown[b] > 0 && (!peakHour || hourlyBreakdown[b] > peakHour.amount)) {
      peakHour = { hour: Math.floor(b / 2), amount: hourlyBreakdown[b] };
    }
  }

  // Top transaction (largest single expense today)
  const topTransaction = todayTransactions
    .filter((t) => t.type === 'expense')
    .sort((a, b) => b.amount - a.amount)[0] ?? null;

  return {
    todayIncome,
    todayExpense,
    hourlyBreakdown,
    todayCategoryMap,
    todaySourceMap,
    todayCategories,
    todaySources,
    peakHour,
    topTransaction,
    todayTransactions,
    todayTxCount,
  };
}
