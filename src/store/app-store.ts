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

// BUGHUNT-OTHER-1 BUG-L8: persistence note — `activeTab` is intentionally
// NOT persisted via zustand persist middleware. Instead, the page.tsx
// component syncs `activeTab` to the URL `?tab=` query param (deep
// linking), which survives reloads AND makes tabs shareable. The other
// state below (`selectedDate`, `selectedMonth`, `sidebarOpen`) is ephemeral
// — `selectedDate`/`selectedMonth` defaulting to "today" on reload is the
// intended UX (not a bug). `sidebarOpen` defaults to closed for mobile
// safety and auto-opens on desktop via a resize listener in page.tsx.
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