import { create } from 'zustand';
import { format, addHours } from 'date-fns';

// Jakarta is UTC+7 — use local date components adjusted for WIB
function jakartaDateString() {
  const d = addHours(new Date(), 7);
  return format(d, 'yyyy-MM-dd');
}
function jakartaMonthString() {
  const d = addHours(new Date(), 7);
  return format(d, 'yyyy-MM');
}

export type TabId =
  | 'dashboard'
  | 'tracker'
  | 'habits'
  | 'calendar'
  | 'goals'
  | 'challenges'
  | 'rewards'
  | 'badges'
  | 'finance'
  | 'settings';

interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  selectedDate: string; // yyyy-MM-dd
  setSelectedDate: (date: string) => void;
  selectedMonth: string; // yyyy-MM
  setSelectedMonth: (month: string) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  selectedDate: jakartaDateString(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  selectedMonth: jakartaMonthString(),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));