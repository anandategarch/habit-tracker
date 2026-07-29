import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Get the week number (1-4) for a given day of month. */
function dayToWeek(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

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

    const now = new Date();
    const year = monthParam ? parseInt(monthParam.split('-')[0]) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam.split('-')[1]) - 1 : now.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Fetch existing weekly budgets for this month
    const budgets = await db.weeklyBudget.findMany({
      where: { month: monthKey },
      orderBy: { week: 'asc' },
    });

    // Fetch all expense transactions for this month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const transactions = await db.transaction.findMany({
      where: {
        type: 'expense',
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { amount: true, date: true },
    });

    // Calculate actual spending per week
    const weekSpending = [0, 0, 0, 0];
    for (const tx of transactions) {
      const txDate = new Date(tx.date);
      const day = txDate.getDate();
      const week = dayToWeek(day);
      weekSpending[week - 1] += tx.amount;
    }

    // Determine current week
    const today = now.getDate();
    const currentWeek = (year === now.getFullYear() && month === now.getMonth())
      ? dayToWeek(today)
      : 0; // 0 = not current month

    // Smart suggestion
    const suggestedTarget = await calculateSmartSuggestion();

    // Build response with rollover calculation
    const weeks = [];
    let cumulativeRollover = 0;

    for (let w = 1; w <= 4; w++) {
      const budget = budgets.find((b) => b.week === w);
      const target = budget?.target ?? 0; // 0 = not set yet
      const rolloverEnabled = budget?.rollover ?? true;
      const spent = weekSpending[w - 1];

      // Calculate effective target (with rollover from previous weeks)
      let effectiveTarget = target;
      if (target > 0 && rolloverEnabled) {
        effectiveTarget = target + cumulativeRollover;
      }

      // Remaining = effective target - spent
      const remaining = effectiveTarget > 0 ? effectiveTarget - spent : 0;

      // Update cumulative rollover for next week
      if (target > 0 && rolloverEnabled) {
        cumulativeRollover = remaining; // can be negative if over budget
      } else if (target > 0 && !rolloverEnabled) {
        cumulativeRollover = 0; // no rollover
      }

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
        rolloverIn: w > 1 && rolloverEnabled ? (cumulativeRollover - remaining + target) : 0,
        percentage: effectiveTarget > 0 ? Math.round((spent / effectiveTarget) * 100) : 0,
        status: target === 0 ? 'unset' : currentWeek === w ? 'active' : w < currentWeek ? 'past' : 'future',
        isOverBudget: effectiveTarget > 0 && spent > effectiveTarget,
        isCurrentWeek: currentWeek === w,
      });
    }

    // Totals
    const totalTarget = weeks.reduce((s, w) => s + w.target, 0);
    const totalSpent = weeks.reduce((s, w) => s + w.spent, 0);
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
    const { month, week, target, rollover } = body;

    // Validate
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }
    if (!week || week < 1 || week > 4) {
      return NextResponse.json({ error: 'Week must be 1-4' }, { status: 400 });
    }
    if (typeof target !== 'number' || target < 0) {
      return NextResponse.json({ error: 'Target must be a non-negative number' }, { status: 400 });
    }

    const budget = await db.weeklyBudget.upsert({
      where: { month_week: { month, week } },
      update: { target, rollover: rollover ?? true },
      create: { month, week, target, rollover: rollover ?? true },
    });

    return NextResponse.json(budget);
  } catch (error) {
    console.error('POST /api/finance/weekly-budget error:', error);
    return NextResponse.json({ error: 'Failed to save weekly budget' }, { status: 500 });
  }
}
