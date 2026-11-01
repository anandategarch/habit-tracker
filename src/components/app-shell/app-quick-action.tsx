'use client';

// ── Quick-add menu (Task 71-a, split dari src/app/page.tsx) ────────────────
// Menu utilitas dengan surface solid, ikon semantik, dan animasi singkat.
// Backdrop, focus trap, keyboard navigation, dan close state dikelola oleh
// PremiumBottomNav agar satu komponen menjadi pemilik state menu.

import {
  Sprout,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  ClipboardList,
} from 'lucide-react';
import { useAppStore, type TabId } from '@/store/app-store';

export function QuickAddMenu({
  activeTab,
  onNavClick,
  onClose,
  menuRef,
  bottomOffset,
}: {
  activeTab: TabId;
  onNavClick: (id: TabId) => void;
  onClose: () => void;
  /** Ref kontainer role=menu — dipakai efek keyboard PremiumBottomNav
   *  (focus trap + roving focus antar role="menuitem"). */
  menuRef: React.RefObject<HTMLDivElement | null>;
  /** CSS offset relatif terhadap tinggi navigation bar agar menu aman
   *  dari seluruh safe area perangkat. */
  bottomOffset: number | string;
}) {
  // BUGHUNT-ROUND2 FAB-1: quick-add trigger lives in the store so this
  // deep nav component can fire it without prop-drilling from Home().
  const triggerQuickAdd = useAppStore((s) => s.triggerQuickAdd);
  // ONE-CLICK-2: sub-tab deep-link for the Transfer quick action.
  const openFinanceSubTab = useAppStore((s) => s.openFinanceSubTab);

  return (
    <div
      role="menu"
      aria-label="Menu tambah cepat"
      ref={menuRef}
      className="rutina-quick-menu absolute left-1/2 -translate-x-1/2 z-50 w-[min(236px,calc(100vw-24px))] rounded-2xl border border-border bg-card p-2 shadow-xl"
      style={{ bottom: bottomOffset }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tail pointer aimed at the FAB */}
      <div
        aria-hidden="true"
        className="rutina-quick-menu-tail absolute -bottom-[6px] left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 rounded-[2px] border-b border-r border-border bg-card"
      />
      {/* TASK 45: microcopy personal (bukan label utilitas) + Habit
          Baru diurutan pertama — habit adalah jantung aplikasi. */}
      <p className="px-2.5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Mau catat apa?
      </p>

      <button
        role="menuitem"
        className="rutina-quick-item"
        onClick={() => { triggerQuickAdd('habit', activeTab); onNavClick('settings'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl rutina-quick-icon rutina-quick-icon-primary">
          <Sprout className="h-[18px] w-[18px] text-current" strokeWidth={1.9} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">Habit Baru</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">Satu rutinitas kecil</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="rutina-quick-item"
        // BUGHUNT-ROUND2 FAB-1: was just onNavClick('finance') — the
        // dialog never opened. The quick-add action makes the
        // Finance tab open the expense dialog after mounting.
        onClick={() => { triggerQuickAdd('expense'); onNavClick('finance'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl rutina-quick-icon rutina-quick-icon-expense">
          <ArrowDownRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Pengeluaran</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Catat pengeluaran</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="rutina-quick-item"
        onClick={() => { triggerQuickAdd('income'); onNavClick('finance'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl rutina-quick-icon rutina-quick-icon-income">
          <ArrowUpRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Pemasukan</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Catat pemasukan</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="rutina-quick-item"
        // TASK 45: Tugas Kerja — aksi 'task' baru; Meja Kerja membuka
        // editor tugas kosong saat mount (pola consume-and-clear).
        onClick={() => { triggerQuickAdd('task'); onNavClick('work'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl rutina-quick-icon rutina-quick-icon-task">
          <ClipboardList className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Tugas Kerja</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Tambah tugas di Meja Kerja</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="rutina-quick-item"
        // ONE-CLICK-2: Transfer quick-add. Opens the transfer dialog on
        // the finance overview sub-tab (SourceBalance consumes the
        // 'transfer' action). Previously the transfer feature was
        // buried: Finance → Ringkasan → scroll to bottom → "Transfer".
        onClick={() => { triggerQuickAdd('transfer'); openFinanceSubTab('overview'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl rutina-quick-icon rutina-quick-icon-transfer">
          <ArrowLeftRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Transfer</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Pindahkan antar dompet</span>
        </span>
      </button>
    </div>
  );
}
