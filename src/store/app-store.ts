import { create } from 'zustand';
import { jakartaDateString, jakartaMonthString } from '@/lib/timezone';

export type TabId =
  | 'dashboard'
  | 'tracker'
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
  // Default to closed — safer for mobile (no jarring overlay on first load).
  // Desktop auto-opens on first mount via useEffect in page.tsx.
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  selectedDate: jakartaDateString(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  selectedMonth: jakartaMonthString(),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));