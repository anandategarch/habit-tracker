// ── Chart builders for the dashboard API ─────────────────────────────────
//
// Four pure functions that produce the chart-shaped arrays consumed by the
// frontend dashboard:
//   - buildWeeklyChart: last 7 days (day-of-week + date + completed/total/rate)
//   - buildMonthlyChart: last `chartDays` days (date + completed/total/rate)
//   - buildStackedBarChart: last `chartDays` days (completed vs missed)
//   - buildWeeklyPatternChart: per-day-of-week aggregate over last 31 days
//
// All four share two inputs:
//   - dailyCompletionMap (dateStr → Set of completed habitIds), built once
//     by buildDailyCompletionMap in helpers.ts.
//   - habitCreatedDates (pre-sorted epoch-ms array), built once by
//     buildHabitCreatedDates in helpers.ts. Threaded through so each
//     builder can call habitsActiveOnDate() without re-sorting.
//
// All loops + format strings are LIFTED VERBATIM from the original inline
// implementation in route.ts — only the call site moved.

import { subDays, format } from '@/lib/date-utils';
import type { Period } from './types';
import type {
  WeeklyChartPoint,
  MonthlyChartPoint,
  StackedBarPoint,
  WeeklyPatternPoint,
} from './types';
import { habitsActiveOnDate } from './helpers';

// ── Weekly chart (last 7 days) ────────────────────────────────────────────
export function buildWeeklyChart(
  dailyCompletionMap: Map<string, Set<string>>,
  habitCreatedDates: number[],
  today: Date,
): WeeklyChartPoint[] {
  const out: WeeklyChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, 'yyyy-MM-dd');
    const activeOnDay = habitsActiveOnDate(d, habitCreatedDates);
    const done = dailyCompletionMap.get(key)?.size || 0;
    const rate = activeOnDay > 0 ? Math.round((done / activeOnDay) * 100) : 0;
    out.push({
      day: format(d, 'EEE'),
      date: format(d, 'MMM dd'),
      completed: done,
      total: activeOnDay,
      rate,
    });
  }
  return out;
}

// ── Monthly / period chart (last `chartDays` days) ────────────────────────
export function buildMonthlyChart(
  dailyCompletionMap: Map<string, Set<string>>,
  habitCreatedDates: number[],
  today: Date,
  chartDays: number,
): MonthlyChartPoint[] {
  const out: MonthlyChartPoint[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, 'yyyy-MM-dd');
    const activeOnDay = habitsActiveOnDate(d, habitCreatedDates);
    const done = dailyCompletionMap.get(key)?.size || 0;
    const rate = activeOnDay > 0 ? Math.round((done / activeOnDay) * 100) : 0;
    out.push({
      day: format(d, 'MMM dd'),
      completed: done,
      total: activeOnDay,
      rate,
    });
  }
  return out;
}

// ── Stacked bar chart (completed vs missed per day) ───────────────────────
// Uses `period` to decide day-label format: short weekday for 7d view,
// short month-day otherwise (matches the original inline implementation).
export function buildStackedBarChart(
  dailyCompletionMap: Map<string, Set<string>>,
  habitCreatedDates: number[],
  today: Date,
  chartDays: number,
  period: Period,
): StackedBarPoint[] {
  const out: StackedBarPoint[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, 'yyyy-MM-dd');
    const activeOnDay = habitsActiveOnDate(d, habitCreatedDates);
    const done = dailyCompletionMap.get(key)?.size || 0;
    const missed = Math.max(0, activeOnDay - done);
    const rate = activeOnDay > 0 ? Math.round((done / activeOnDay) * 100) : 0;
    out.push({
      day: period === '7d' ? format(d, 'EEE') : format(d, 'MMM dd'),
      completed: done,
      missed,
      total: activeOnDay,
      rate,
    });
  }
  return out;
}

// ── Weekly pattern (day-of-week aggregate over last 31 days) ──────────────
// For each day of week, calculate: total completed / total possible over
// the last 31 days. Returns 7 points (Mon..Sun) with the avg completed per
// instance of that day.
export function buildWeeklyPatternChart(
  dailyCompletionMap: Map<string, Set<string>>,
  habitCreatedDates: number[],
  today: Date,
): WeeklyPatternPoint[] {
  // For each day of week, calculate: total completed / total possible
  // over the last 30 days
  const dayOfWeekStats: Record<string, { completed: number; possible: number }> = {};
  for (let i = 30; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, 'yyyy-MM-dd');
    const dayName = format(d, 'EEEE');
    if (!dayOfWeekStats[dayName]) dayOfWeekStats[dayName] = { completed: 0, possible: 0 };
    const activeOnDay = habitsActiveOnDate(d, habitCreatedDates);
    const doneOnDay = dailyCompletionMap.get(key)?.size || 0;
    dayOfWeekStats[dayName].completed += doneOnDay;
    dayOfWeekStats[dayName].possible += activeOnDay;
  }
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
    const s = dayOfWeekStats[day] || { completed: 0, possible: 0 };
    // Count how many instances of this day in the last 31 days
    let instances = 0;
    for (let i = 30; i >= 0; i--) {
      const d = subDays(today, i);
      if (format(d, 'EEEE') === day) instances++;
    }
    return {
      day: day.substring(0, 3),
      fullDay: day,
      rate: s.possible > 0 ? Math.round((s.completed / s.possible) * 100) : 0,
      avgCompleted: instances > 0 ? (s.completed / instances).toFixed(1) : '0',
    };
  });
}
