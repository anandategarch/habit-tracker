// ---------------------------------------------------------------------------
// store/app-store.ts — Zustand store global.
//
// API NAVIGASI 1-KLIK (WAJIB dipakai oleh semua komponen — jangan bikin
// mekanisme navigasi sendiri; pola consume-and-clear untuk deep-link):
//   openHabitFocus(habitId)      -> tab tracker + dialog Analisis Waktu habit
//   openTrackerDate('yyyy-MM-dd')-> tab tracker grid, tanggal terpilih
//   openFinanceSubTab(sub)       -> tab finance + sub-tab target
//   openFinanceFocus({category}) -> tab finance sub-tab transactions + filter
//   triggerQuickAdd(action)      -> quick-add FAB action
//   setActiveTab(tab)            -> pindah tab utama
// State yang diangkat ke store supaya survive pergantian tab:
//   trackerViewMode, selectedDate, financeSubTab, selectedMonth, settingsSection.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { jakartaDateString } from '@/lib/timezone';

export type TabId = 'dashboard' | 'tracker' | 'progress' | 'work' | 'finance' | 'goals' | 'settings';
// MERGE Task 32 (Opsi A): sub-tab 'explorer' (Eksplorasi) dan 'categories'
// (Kategori) digabung menjadi satu sub-tab 'analysis' (Analisis) — keduanya
// 70% kembar. Nilai lama bisa tersisa sesaat pada hot-reload (state module
// lama); dinormalisasi di kedua setter sebagai asuransi.
export type FinanceSubTab =
  | 'overview'
  | 'transactions'
  | 'budgets'
  | 'analysis'
  | 'recurring'
  | 'rules'
  | 'savings';
const LEGACY_FINANCE_SUB_TAB: Record<string, FinanceSubTab> = {
  explorer: 'analysis',
  categories: 'analysis',
};
const normalizeFinanceSubTab = (sub: FinanceSubTab): FinanceSubTab =>
  LEGACY_FINANCE_SUB_TAB[sub] ?? sub;
export type FinanceFocus = { category?: string; sourceId?: string };
// TASK 45: 'task' — quick-add tugas kerja (FAB → Meja Kerja buka editor
// tugas baru). Aksi lama tidak berubah.
export type QuickAddAction = 'expense' | 'income' | 'habit' | 'transfer' | 'task';
export type TrackerViewMode = 'today' | 'history';
export type SettingsSection = 'umum' | 'habits' | 'data';

interface AppState {
  // tab utama
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // tracker
  trackerViewMode: TrackerViewMode;
  setTrackerViewMode: (mode: TrackerViewMode) => void;
  selectedDate: string; // 'yyyy-MM-dd' Jakarta
  setSelectedDate: (date: string) => void;
  openTrackerDate: (date: string) => void;
  focusHabitId: string | null;
  openHabitFocus: (habitId: string) => void;
  clearHabitFocus: () => void;

  // finance
  financeSubTab: FinanceSubTab;
  setFinanceSubTab: (sub: FinanceSubTab) => void;
  openFinanceSubTab: (sub: FinanceSubTab) => void;
  selectedMonth: string; // 'yyyy-MM' Jakarta
  setSelectedMonth: (month: string) => void;
  financeFocus: FinanceFocus | null;
  openFinanceFocus: (focus: FinanceFocus) => void;
  clearFinanceFocus: () => void;

  // settings
  settingsSection: SettingsSection;
  setSettingsSection: (section: SettingsSection) => void;

  // quick add (FAB)
  quickAddAction: QuickAddAction | null;
  triggerQuickAdd: (action: QuickAddAction) => void;
  clearQuickAdd: () => void;

  // refresh global (dashboard refresh button)
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  trackerViewMode: 'today',
  setTrackerViewMode: (mode) => set({ trackerViewMode: mode }),
  selectedDate: jakartaDateString(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  openTrackerDate: (date) =>
    set({ activeTab: 'tracker', trackerViewMode: 'today', selectedDate: date }),
  focusHabitId: null,
  openHabitFocus: (habitId) =>
    set({ activeTab: 'tracker', trackerViewMode: 'today', focusHabitId: habitId }),
  clearHabitFocus: () => set({ focusHabitId: null }),

  financeSubTab: 'overview',
  setFinanceSubTab: (sub) => set({ financeSubTab: normalizeFinanceSubTab(sub) }),
  openFinanceSubTab: (sub) => set({ activeTab: 'finance', financeSubTab: normalizeFinanceSubTab(sub) }),
  selectedMonth: jakartaDateString().slice(0, 7),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  financeFocus: null,
  openFinanceFocus: (focus) =>
    set({ activeTab: 'finance', financeSubTab: 'transactions', financeFocus: focus }),
  clearFinanceFocus: () => set({ financeFocus: null }),

  settingsSection: 'umum',
  setSettingsSection: (section) => set({ settingsSection: section }),

  quickAddAction: null,
  triggerQuickAdd: (action) => set({ quickAddAction: action }),
  clearQuickAdd: () => set({ quickAddAction: null }),

  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
