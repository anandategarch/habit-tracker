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
// ONE-CLICK-2: 'transfer' added — FAB opens the transfer dialog on the
// finance overview (consumed by source-balance.tsx).
export type QuickAddAction = 'expense' | 'income' | 'habit' | 'transfer';

// Sub-tabs of the Finance tab. Lifted from finance.tsx local useState into
// the global store (ONE-CLICK-3) so that (a) the sub-tab survives switching
// to another main tab and back, and (b) any component in the app can
// deep-link straight to a finance sub-tab (e.g. dashboard budget-overview
// card → Budgets sub-tab) with a single call.
export type FinanceSubTab =
  | 'overview'
  | 'transactions'
  | 'budgets'
  | 'explorer'
  | 'categories'
  | 'recurring'
  | 'rules'
  | 'savings';

// BUGHUNT-ROUND3 SETTINGS-SECTION-1: sub-section of the Settings tab
// ("Umum" / "Habit Master" / "Data"), lifted from settings.tsx local useState
// into the global store — same rationale as financeSubTab (ONE-CLICK-3):
// (a) the section now SURVIVES switching to another main tab and back
//     (previously it always reset to 'umum', inconsistent with the finance
//     sub-tab + trackerViewMode which were both lifted for exactly this),
// and (b) deep-links (FAB "Habit Baru" → quickAddAction 'habit') can target
//     the 'habits' section directly. Defined here (not in settings-types.ts)
// so the store stays the single source of truth; settings-types re-exports it.
export type SettingsSection = 'umum' | 'habits' | 'data';

// ONE-CLICK-4: focus payload for 1-click jumps into the finance
// transactions list (e.g. a budget card → "see this category's expenses").
// `category` is the category NAME (matches txFilter.category semantics).
export interface FinanceFocus {
  category?: string;
}

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
  // ── ONE-CLICK NAVIGATION (1-klik nyambung) ─────────────────────────────
  // Generalizes the proven quickAddAction pattern ("set ephemeral focus +
  // switch tab; the target tab consumes & clears on mount") into three
  // reusable deep-link primitives:
  //
  // 1) focusHabitId — any card/row anywhere in the app (dashboard rows,
  //    calendar, future goal→habit links) can open a habit's time-analysis
  //    dialog on the tracker in ONE click via openHabitFocus(id).
  //    Consumed by daily-tracker.tsx on mount/effect.
  focusHabitId: string | null;
  openHabitFocus: (id: string) => void;
  clearHabitFocus: () => void;
  // 2) trackerViewMode — 'today' (habit grid) vs 'history' (calendar).
  //    Lifted from daily-tracker local state so it survives tab switches
  //    AND so calendar-day taps can switch the tracker INTO grid mode.
  //    openTrackerDate(date) = the calendar 1-click: jump to the tracker
  //    grid with that date preselected.
  trackerViewMode: 'today' | 'history';
  setTrackerViewMode: (mode: 'today' | 'history') => void;
  openTrackerDate: (date: string) => void;
  // 3) financeSubTab + financeFocus — deep-link into a finance sub-tab,
  //    optionally with a pre-applied transactions filter. openFinanceSubTab
  //    switches the main tab to finance too (single call from anywhere).
  financeSubTab: FinanceSubTab;
  setFinanceSubTab: (sub: FinanceSubTab) => void;
  openFinanceSubTab: (sub: FinanceSubTab) => void;
  financeFocus: FinanceFocus | null;
  openFinanceFocus: (focus: FinanceFocus, sub?: FinanceSubTab) => void;
  clearFinanceFocus: () => void;
  // ── SETTINGS SUB-SECTION (see SettingsSection above) ──────────────
  settingsSection: SettingsSection;
  setSettingsSection: (section: SettingsSection) => void;
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

  // ── ONE-CLICK NAV implementations ──────────────────────────────────────
  // openHabitFocus: switch to tracker (grid mode) + set the focus; the
  // daily-tracker consumes focusHabitId and opens TimeAnalysisDialog.
  focusHabitId: null,
  openHabitFocus: (id) =>
    set({ focusHabitId: id, activeTab: 'tracker', trackerViewMode: 'today' }),
  clearHabitFocus: () => set({ focusHabitId: null }),

  trackerViewMode: 'today',
  setTrackerViewMode: (mode) => set({ trackerViewMode: mode }),
  // Calendar day tap → tracker grid with the tapped date preselected.
  openTrackerDate: (date) =>
    set({ selectedDate: date, activeTab: 'tracker', trackerViewMode: 'today' }),

  financeSubTab: 'overview',
  setFinanceSubTab: (sub) => set({ financeSubTab: sub }),
  // Single call from anywhere → finance tab + target sub-tab.
  openFinanceSubTab: (sub) => set({ financeSubTab: sub, activeTab: 'finance' }),

  financeFocus: null,
  // e.g. openFinanceFocus({ category: 'Makanan' }) → finance tab,
  // transactions sub-tab, filter pre-applied (consumed & cleared by
  // finance.tsx so it stays ephemeral like quickAddAction).
  openFinanceFocus: (focus, sub = 'transactions') =>
    set({ financeFocus: focus, financeSubTab: sub, activeTab: 'finance' }),
  clearFinanceFocus: () => set({ financeFocus: null }),

  settingsSection: 'umum',
  setSettingsSection: (section) => set({ settingsSection: section }),
}));
