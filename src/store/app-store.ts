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

// Help modal section IDs — match the keys used in help-calculation.tsx.
// When opening the modal from an info icon on a specific section, pass
// the section ID so the modal auto-scrolls to that section.
export type HelpSectionId =
  | 'proyeksi'
  | 'insight'
  | 'gamifikasi'
  | 'cashflow'
  | 'patterns'
  | 'heatmap'
  | 'overview'
  | 'budget';

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
  // Help modal state — can be opened from anywhere (Daily Recap header,
  // Settings page, or info icons on section headers). defaultSection
  // controls which section the modal auto-scrolls to on open.
  helpOpen: boolean;
  helpDefaultSection: HelpSectionId | null;
  openHelp: (section?: HelpSectionId) => void;
  closeHelp: () => void;
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
  helpOpen: false,
  helpDefaultSection: null,
  openHelp: (section) => set({ helpOpen: true, helpDefaultSection: section ?? null }),
  closeHelp: () => set({ helpOpen: false, helpDefaultSection: null }),
}));