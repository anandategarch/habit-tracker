// ── Finance overview for the dashboard API ───────────────────────────────
//
// Pure function: takes the month's transactions + budgets (already fetched
// by fetchDashboardBaseData) and returns the aggregated finance overview
// object embedded in the dashboard response.
//
// Logic is LIFTED VERBATIM from the original inline implementation in
// route.ts. The original wrapped the body in a try/catch (because the
// finance tables might not exist on a fresh DB); we preserve that
// resilience here — any unexpected error returns the zero-default overview
// rather than aborting the entire dashboard response.

import type {
  MonthTransactionRow,
  BudgetRow,
  FinanceOverview,
} from './types';

// Build the zero-default overview. Used as the starting point + as the
// fallback if anything throws.
function zeroOverview(): FinanceOverview {
  return {
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    transactionCount: 0,
    budgetWarning: 0,  // >80% used
    budgetExceeded: 0, // >100% used
  };
}

export function computeFinanceOverview(
  monthTransactions: MonthTransactionRow[],
  budgets: BudgetRow[],
): FinanceOverview {
  let financeOverview = zeroOverview();

  try {
    financeOverview.totalIncome = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    financeOverview.totalExpense = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    financeOverview.netBalance = financeOverview.totalIncome - financeOverview.totalExpense;
    financeOverview.transactionCount = monthTransactions.length;

    // Budget status
    const monthExpensesByCategory = new Map<string, number>();
    for (const t of monthTransactions) {
      if (t.type === 'expense') {
        monthExpensesByCategory.set(
          t.category,
          (monthExpensesByCategory.get(t.category) || 0) + t.amount,
        );
      }
    }
    for (const budget of budgets) {
      const spent = monthExpensesByCategory.get(budget.category) || 0;
      const usage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
      if (usage > 100) financeOverview.budgetExceeded++;
      else if (usage > 80) financeOverview.budgetWarning++;
    }
  } catch {
    // Finance tables might not exist; silently ignore — return zero overview
    financeOverview = zeroOverview();
  }

  return financeOverview;
}
