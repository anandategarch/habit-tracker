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

export type TabId = 'dashboard' | 'tracker' | 'finance' | 'goals' | 'settings';
export type FinanceSubTab =
  | 'overview'
  | 'transactions'
  | 'budgets'
  | 'explorer'
  | 'categories'
  | 'recurring'
  | 'rules'
  | 'savings';
export type FinanceFocus = { category?: string; sourceId?: string };
export type QuickAddAction = 'expense' | 'income' | 'habit' | 'transfer';
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
  setFinanceSubTab: (sub) => set({ financeSubTab: sub }),
  openFinanceSubTab: (sub) => set({ activeTab: 'finance', financeSubTab: sub }),
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
