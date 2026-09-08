import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [
      habits,
      habitLogs,
      dailyLogs,
      goals,
      transactions,
      budgets,
      financeCategories,
      settings,
      // Added 6 missing tables so backup/restore is complete. Without these,
      // a reset+restore cycle silently destroyed fund-source balances,
      // weekly budgets, habit groups, learning topics, and habit options.
      fundSources,
      weeklyBudgets,
      budgetSnapshots,
      habitGroups,
      habitOptions,
      // BUGHUNT-ROUND2 EXPORT-1: 3 missing tables — savings goals, recurring
      // templates, and auto-categorization rules were silently dropped by
      // export, so a backup→reset→import cycle lost them permanently.
      savingsGoals,
      recurringTransactions,
      transactionRules,
    ] = await Promise.all([
      db.habit.findMany(),
      db.habitLog.findMany(),
      db.dailyLog.findMany(),
      db.goal.findMany(),
      db.transaction.findMany(),
      db.budget.findMany(),
      db.financeCategory.findMany(),
      db.appSettings.findMany(),
      db.fundSource.findMany(),
      db.weeklyBudget.findMany(),
      db.budgetSnapshot.findMany(),
      db.habitGroup.findMany(),
      db.habitOption.findMany(),
      db.savingsGoal.findMany(),
      db.recurringTransaction.findMany(),
      db.transactionRule.findMany(),
    ]);

    const data = {
      habits,
      habitLogs,
      dailyLogs,
      goals,
      transactions,
      budgets,
      financeCategories,
      settings,
      fundSources,
      weeklyBudgets,
      budgetSnapshots,
      habitGroups,
      habitOptions,
      savingsGoals,
      recurringTransactions,
      transactionRules,
    };

    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="habit-tracker-backup-${today}.json"`,
      },
    });
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}