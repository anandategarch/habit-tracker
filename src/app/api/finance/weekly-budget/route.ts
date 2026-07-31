import { db } from '@/lib/db';
import { weeklyBudgetSchema, parseOr400 } from '@/lib/validation';
import { dayToWeek, jakartaNowParts, jakartaDateKey } from '@/lib/timezone';
import { NextRequest, NextResponse } from 'next/server';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Get the date range (start, end) for a given week in a month. */
function weekDateRange(year: number, month: number, week: number): { start: Date; end: Date } {
  const startDay = week === 1 ? 1 : week === 2 ? 8 : week === 3 ? 15 : 22;
  const endDay = week === 4 ? new Date(year, month + 1, 0).getDate() : startDay + 6;
  const start = new Date(year, month, startDay, 0, 0, 0, 0);
  const end = new Date(year, month, endDay, 23, 59, 59, 999);
  return { start, end };
}

/** Calculate smart suggestion: average weekly spending from last 3 months. */
async function calculateSmartSuggestion(): Promise<number> {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  try {
    const transactions = await db.transaction.findMany({
      where: {
        type: 'expense',
        date: { gte: threeMonthsAgo, lte: now },
      },
      select: { amount: true, date: true },
    });

    if (transactions.length === 0) return 500000; // default 500k

    const totalSpending = transactions.reduce((sum, t) => sum + t.amount, 0);
    // 3 months ≈ 13 weeks → average per week
    const avgWeekly = Math.round(totalSpending / 13);
    // Round to nearest 50k for a clean number
    return Math.round(avgWeekly / 50000) * 50000;
  } catch {
    return 500000;
  }
}

// ── GET: Fetch all 4 weeks' targets + actual spending for a month ───────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    // Default to Jakarta wall-clock month when no param. Previously used
    // `new Date()` + LOCAL getFullYear/getMonth — wrong during Jakarta
    // midnight rollover on UTC servers.
    const jakartaParts = jakartaNowParts();
    const year = monthParam ? parseInt(monthParam.split('-')[0]) : jakartaParts.year;
    const month = monthParam ? parseInt(monthParam.split('-')[1]) - 1 : jakartaParts.month - 1;
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Fetch existing weekly budgets for this month
    const budgets = await db.weeklyBudget.findMany({
      where: { month: monthKey },
      orderBy: { week: 'asc' },
    });

    // Fetch all expense transactions for this month, with a 7h buffer on
    // each side to catch timezone-boundary transactions (Jakarta is UTC+7,
    // so 00:00-06:59 Jakarta on the 1st has a UTC epoch in the previous
    // month). Post-query, we filter by jakartaDateKey to get the exact month.
    const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const fetchStart = new Date(monthStart.getTime() - 7 * 60 * 60 * 1000);
    const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    const fetchEnd = new Date(monthEnd.getTime() + 7 * 60 * 60 * 1000);
    const allFetchedTx = await db.transaction.findMany({
      where: {
        type: 'expense',
        date: { gte: fetchStart, lte: fetchEnd },
      },
      select: { amount: true, date: true },
    });
    // Filter to exact Jakarta month
    const transactions = allFetchedTx.filter(
      (t) => jakartaDateKey(t.date).slice(0, 7) === monthKey
    );

    // Calculate actual spending per week
    // Use Jakarta timezone (UTC+7) for date extraction to match the user's
    // local day. We use the canonical `Intl.DateTimeFormat` with
    // `timeZone: 'Asia/Jakarta'` via `jakartaDateKey()` — this works on ANY
    // server timezone (Vercel UTC, local dev Asia/Jakarta, etc.). The
    // previous pattern (`new Date(tx.date.getTime() + JAKARTA_OFFSET_MS)`
    // then `getUTCDate()`) only worked on UTC servers.
    const weekSpending = [0, 0, 0, 0];
    for (const tx of transactions) {
      // jakartaDateKey returns 'yyyy-MM-dd'; extract day-of-month.
      const day = parseInt(jakartaDateKey(tx.date).slice(8, 10), 10);
      const week = dayToWeek(day);
      weekSpending[week - 1] += tx.amount;
    }

    // Determine current week using Jakarta wall-clock components (works on
    // any server TZ). Previously used `now.getFullYear()` / `now.getMonth()`
    // (LOCAL components) — on a UTC server this happened to match Jakarta,
    // but during Jakarta midnight rollover (UTC 17:00-23:59 = next day WIB)
    // the comparison was off by one day, marking the wrong week as "current".
    const jakartaNow = jakartaNowParts();
    const currentWeek = (year === jakartaNow.year && month === jakartaNow.month - 1)
      ? dayToWeek(jakartaNow.day)
      : 0; // 0 = not current month

    // Smart suggestion
    const suggestedTarget = await calculateSmartSuggestion();

    // Build response with rollover calculation
    // rolloverIn = the amount carried INTO this week from the previous week
    // effectiveTarget = this week's target + rolloverIn
    // remaining = effectiveTarget - spent (can be negative if over)
    // nextRolloverIn = remaining (if rollover enabled, carries to next week)
    interface WeekData {
      week: number;
      label: string;
      dateRange: string;
      target: number;
      effectiveTarget: number;
      spent: number;
      remaining: number;
      rollover: boolean;
      rolloverIn: number;
      percentage: number;
      status: string;
      isOverBudget: boolean;
      isCurrentWeek: boolean;
    }
    const weeks: WeekData[] = [];
    let prevRollover = 0; // rollover carried from previous week

    for (let w = 1; w <= 4; w++) {
      const budget = budgets.find((b) => b.week === w);
      const target = budget?.target ?? 0; // 0 = not set yet
      const rolloverEnabled = budget?.rollover ?? true;
      const spent = weekSpending[w - 1];

      // rolloverIn = what was carried from the previous week
      const rolloverIn = (w > 1 && rolloverEnabled && prevRollover !== 0) ? prevRollover : 0;

      // effectiveTarget = target + rolloverIn (only if target is set)
      const effectiveTarget = target > 0 ? target + rolloverIn : 0;

      // Remaining = effective target - spent
      const remaining = effectiveTarget > 0 ? effectiveTarget - spent : 0;

      // Update prevRollover for the next iteration
      prevRollover = (target > 0 && rolloverEnabled) ? remaining : 0;

      const { start, end } = weekDateRange(year, month, w);

      weeks.push({
        week: w,
        label: `Week ${w}`,
        dateRange: `${start.getDate()}-${end.getDate()}`,
        target,
        effectiveTarget,
        spent,
        remaining,
        rollover: rolloverEnabled,
        rolloverIn,
        percentage: effectiveTarget > 0 ? Math.round((spent / effectiveTarget) * 100) : 0,
        status: target === 0 ? 'unset' : currentWeek === w ? 'active' : w < currentWeek ? 'past' : 'future',
        isOverBudget: effectiveTarget > 0 && spent > effectiveTarget,
        isCurrentWeek: currentWeek === w,
      });
    }

    // Totals — only count weeks that have a target set (target > 0).
    // Previously summed ALL 4 weeks' targets (including unset weeks with
    // target=0), which made `totalPercentage` misleading: if only week 1 had
    // a target of 100k but the user spent 130k across all 4 weeks, the UI
    // showed "130% of total budget used" even though only week 1 was
    // budgeted. Now `totalSpent` is also restricted to budgeted weeks so the
    // percentage reflects "spent vs budgeted" rather than "spent vs everything".
    const budgetedWeeks = weeks.filter((w) => w.target > 0);
    const totalTarget = budgetedWeeks.reduce((s, w) => s + w.target, 0);
    const totalSpent = budgetedWeeks.reduce((s, w) => s + w.spent, 0);
    const totalPercentage = totalTarget > 0 ? Math.round((totalSpent / totalTarget) * 100) : 0;

    return NextResponse.json({
      month: monthKey,
      weeks,
      totalTarget,
      totalSpent,
      totalPercentage,
      suggestedTarget,
      currentWeek,
    });
  } catch (error) {
    console.error('GET /api/finance/weekly-budget error:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly budget' }, { status: 500 });
  }
}

// ── POST: Set or update a week's target ─────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = parseOr400(weeklyBudgetSchema, body);
    if (!parsed.success) return parsed.response;
    const { month, week, target, rollover } = parsed.data;

    const budget = await db.weeklyBudget.upsert({
      where: { month_week: { month, week } },
      update: { target, rollover },
      create: { month, week, target, rollover },
    });

    return NextResponse.json(budget);
  } catch (error) {
    console.error('POST /api/finance/weekly-budget error:', error);
    return NextResponse.json({ error: 'Failed to save weekly budget' }, { status: 500 });
  }
}
