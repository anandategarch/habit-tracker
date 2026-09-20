'use client';

// ── Quick-add popup / launcher (Task 71-a, split dari src/app/page.tsx) ───
// Popup FAB tambah cepat: frosted glass card, spring-staggered items, tail
// pointer, dimmed backdrop (tap/Escape to close — backdrop & keyboard
// ditangani PremiumBottomNav pemilik fabOpen).

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
  /** Jarak popup dari tepi bawah dock (dock height + FAB protrusion + 10px
   *  gap — nav sudah duduk di atas safe-area inset). */
  bottomOffset: number;
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
      className="absolute left-1/2 -translate-x-1/2 z-40 w-[212px] rounded-[22px] bg-white/90 dark:bg-slate-800/90 backdrop-blur-2xl backdrop-saturate-150 border border-slate-900/[0.07] dark:border-white/10 premium-pop-shadow p-2"
      style={{ bottom: bottomOffset }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tail pointer aimed at the FAB */}
      <div
        aria-hidden="true"
        className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 rounded-[3px] bg-white/90 dark:bg-slate-800/90 backdrop-blur-2xl border-b border-r border-slate-900/[0.07] dark:border-white/10"
      />
      {/* TASK 45: microcopy personal (bukan label utilitas) + Habit
          Baru diurutan pertama — habit adalah jantung aplikasi. */}
      <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500">
        Mau catat apa?
      </p>

      <button
        role="menuitem"
        className="anim-fab-item anim-fab-item-1 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
        onClick={() => { triggerQuickAdd('habit', activeTab); onNavClick('settings'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_4px_10px_-2px_rgba(245,158,11,0.5)]">
          <Sprout className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Habit Baru</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Satu rutinitas kecil</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="anim-fab-item anim-fab-item-2 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
        // BUGHUNT-ROUND2 FAB-1: was just onNavClick('finance') — the
        // dialog never opened. The quick-add action makes the
        // Finance tab open the expense dialog after mounting.
        onClick={() => { triggerQuickAdd('expense'); onNavClick('finance'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-[0_4px_10px_-2px_rgba(244,63,94,0.5)]">
          <ArrowDownRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Pengeluaran</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Catat pengeluaran</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="anim-fab-item anim-fab-item-3 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
        onClick={() => { triggerQuickAdd('income'); onNavClick('finance'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 shadow-[0_4px_10px_-2px_rgba(16,185,129,0.5)]">
          <ArrowUpRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Pemasukan</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Catat pemasukan</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="anim-fab-item anim-fab-item-4 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
        // TASK 45: Tugas Kerja — aksi 'task' baru; Meja Kerja membuka
        // editor tugas kosong saat mount (pola consume-and-clear).
        onClick={() => { triggerQuickAdd('task'); onNavClick('work'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-teal-500 shadow-[0_4px_10px_-2px_rgba(14,165,233,0.45)]">
          <ClipboardList className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Tugas Kerja</span>
          <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Tambah tugas di Meja Kerja</span>
        </span>
      </button>

      <button
        role="menuitem"
        className="anim-fab-item anim-fab-item-5 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
        // ONE-CLICK-2: Transfer quick-add. Opens the transfer dialog on
        // the finance overview sub-tab (SourceBalance consumes the
        // 'transfer' action). Previously the transfer feature was
        // buried: Finance → Ringkasan → scroll to bottom → "Transfer".
        onClick={() => { triggerQuickAdd('transfer'); openFinanceSubTab('overview'); onClose(); }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 shadow-[0_4px_10px_-2px_rgba(139,92,246,0.5)]">
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
