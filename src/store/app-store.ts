import { create } from 'zustand';
import { jakartaDateString, jakartaMonthString } from '@/lib/timezone';

export type TabId =
  | 'dashboard'
  | 'tracker'
  | 'goals'
  | 'finance'
  | 'settings';

// BUGHUNT-ROUND2 FAB-1: the mobile FAB quick-add menu previously only
// navigated to a tab ("Pengeluaran" → finance tab) without ever opening the
// add-transaction / add-habit dialog — the buttons did nothing "quick".
// quickAddAction is the cross-component trigger that makes the target tab
// open the real dialog after mounting. Ephemeral (not persisted) by design:
// if the navigation is interrupted, the stale action dies on next reload.
export type QuickAddAction = 'expense' | 'income' | 'habit';

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
  // FAB quick-add trigger (see QuickAddAction above).
  quickAddAction: QuickAddAction | null;
  triggerQuickAdd: (action: QuickAddAction) => void;
  clearQuickAdd: () => void;
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
  quickAddAction: null,
  triggerQuickAdd: (action) => set({ quickAddAction: action }),
  clearQuickAdd: () => set({ quickAddAction: null }),
}));