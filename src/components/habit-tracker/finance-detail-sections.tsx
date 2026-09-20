'use client';

// components/habit-tracker/finance-detail-sections.tsx — sektor detail
// "Perdetail Dashboard Finance" (Task 42, PERDETAIL-FIN). Root komposisi /
// barrel (Task 71-i): implementasi sektor diekstrak ke sibling —
//   1. CashflowTrendChart    → finance-detail-cashflow.tsx
//   2. MonthStatsGrid        → finance-detail-stats.tsx
//   3. CategoryTopList       → finance-detail-categories.tsx
//   4. BudgetDetailList      → finance-detail-budgets.tsx
//   5. UpcomingRecurringList → finance-detail-upcoming.tsx
// Util bersama (hari/bulan/frekuensi) → finance-detail-utils.ts.
//
// Ekspor nama dipertahankan persis (finance-overview.tsx mengimpor kelima
// sektor dari sini). Semua render defensif: data kosong/null → section
// disembunyikan atau empty-state kecil (bukan angka palsu). Deep-link
// 1-klik memakai store (openFinanceSubTab / openFinanceFocus — lihat
// store/app-store.ts).

export { CashflowTrendChart } from './finance-detail-cashflow';
export { MonthStatsGrid } from './finance-detail-stats';
export { CategoryTopList } from './finance-detail-categories';
export { BudgetDetailList } from './finance-detail-budgets';
export { UpcomingRecurringList } from './finance-detail-upcoming';
