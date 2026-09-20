'use client';

// ── FinanceSubTabNav ───────────────────────────────────────────────────────
// Extracted from finance.tsx (Task 71-d — split god files).
// Sub-tab navigation bar for the Finance tab (the <TabsList> inside the
// <Tabs> owned by finance.tsx). Value/onValueChange/reset-on-leave logic
// stays in finance.tsx — this is a pure presentational TabsList that reads
// the active value from Radix Tabs context.

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  Wallet,
  Target,
  Compass,
  Repeat,
  Wand2,
  PiggyBank,
} from 'lucide-react';

// Sub Tabs — icon-only on mobile, icon+label on desktop
// 61-g (audit 61-a P2): label sub-tab kini sr-only sm:not-sr-only
// (dulu hidden sm:inline) — di <640px label keluar dari accessibility
// tree sehingga 7 trigger icon-only tanpa nama (WCAG 4.1.2). Mobile
// kini membaca nama via sr-only; desktop tetap menampilkan label.
export function FinanceSubTabNav() {
  return (
    <TabsList className="flex w-full gap-0.5 overflow-x-auto scrollbar-hide rounded-xl bg-muted/60 p-1 h-auto">
      <TabsTrigger value="overview" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><BarChart3 className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Ringkasan</span></TabsTrigger>
      <TabsTrigger value="transactions" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Wallet className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Transaksi</span></TabsTrigger>
      <TabsTrigger value="budgets" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Target className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Budget</span></TabsTrigger>
      <TabsTrigger value="analysis" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Compass className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Analisis</span></TabsTrigger>
      <TabsTrigger value="recurring" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Repeat className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Recurring</span></TabsTrigger>
      <TabsTrigger value="rules" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><Wand2 className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Aturan</span></TabsTrigger>
      <TabsTrigger value="savings" className="flex-1 text-xs sm:text-sm whitespace-nowrap gap-1 rounded-lg py-1.5 px-3 data-[state=active]:shadow-md"><PiggyBank className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Tabungan</span></TabsTrigger>
    </TabsList>
  );
}
