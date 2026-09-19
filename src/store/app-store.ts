// ---------------------------------------------------------------------------
// store/app-store.ts — Zustand store global.
//
// API NAVIGASI 1-KLIK (WAJIB dipakai oleh semua komponen — jangan bikin
// mekanisme navigasi sendiri; pola consume-and-clear untuk deep-link):
//   setActiveTab(tab)              -> pindah tab utama
//   openTrackerDate('yyyy-MM-dd')  -> tab tracker grid + tanggal terpilih
//                                     (bulan kalender ikut disinkronkan)
//   openTrackerHistory('yyyy-MM')? -> tab tracker mode Riwayat/kalender
//   openHabitFocus(habitId)        -> tab tracker + dialog Analisis Waktu habit
//   openGoalFocus(goalId)          -> tab Tujuan + sorot tujuan terkait
//   openFinanceSubTab(sub)         -> tab finance + sub-tab target
//   openFinanceFocus({category?, sourceId?, date?})
//                                  -> tab finance sub-tab transactions + filter
//   triggerQuickAdd(action, returnTab?)
//                                  -> quick-add FAB action + tab asal yang
//                                     dikembalikan setelah aksi selesai
//
// State yang diangkat ke store supaya survive pergantian tab:
//   trackerViewMode, selectedDate, trackerMonth (kalender habit — TERPISAH
//   dari selectedMonth finance), financeSubTab, selectedMonth, settingsSection,
//   progressPeriod.
//
// CONNECTED-APP (Task 46): setiap objek penting punya jalur ke konteksnya —
// lihat komentar per primitive di bawah.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { jakartaDateString } from '@/lib/timezone';

// TASK 64 (PETA OTOT): tab 'gym' — rumah Peta Otot (siluet zona + misi
// mingguan + sheet fokus). Dock mobile tetap 5 tab (penuh — keputusan Task
// 55); gerbang utamanya kartu "Peta Otot" Beranda + drawer/sidebar.
export type TabId = 'dashboard' | 'tracker' | 'progress' | 'work' | 'finance' | 'goals' | 'settings' | 'pohon' | 'gym';
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
export const FINANCE_SUB_TABS: ReadonlySet<string> = new Set<FinanceSubTab>([
  'overview', 'transactions', 'budgets', 'analysis', 'recurring', 'rules', 'savings',
]);
const LEGACY_FINANCE_SUB_TAB: Record<string, FinanceSubTab> = {
  explorer: 'analysis',
  categories: 'analysis',
};
const normalizeFinanceSubTab = (sub: FinanceSubTab): FinanceSubTab =>
  LEGACY_FINANCE_SUB_TAB[sub] ?? sub;

/** Filter transaksi yang dibawa saat drill-down (chart → transaksi). */
export interface FinanceFocus {
  category?: string;
  sourceId?: string;
  /** 'yyyy-MM-dd' — filter tanggal (heatmap / pengeluaran hari ini). */
  date?: string;
  /** Type transaksi untuk drill-down yang hanya relevan satu arah
   *  (mis. "pengeluaran hari ini" → expense). */
  txType?: 'all' | 'expense' | 'income';
}

// TASK 45: 'task' — quick-add tugas kerja (FAB → Meja Kerja buka editor
// tugas baru). Aksi lama tidak berubah.
export type QuickAddAction = 'expense' | 'income' | 'habit' | 'transfer' | 'task';
export type TrackerViewMode = 'today' | 'history';
export type SettingsSection = 'umum' | 'habits' | 'data';
/** Periode filter tab Progres — diangkat ke store supaya deep-link/KPI
 *  bisa mengganti periode tanpa context hilang saat pindah tab. */
export type ProgressPeriod = '7d' | '1m' | '3m' | 'all';

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
  /** Buka tracker mode hari ini pada tanggal tertentu. Bulan kalender
   *  (trackerMonth) ikut disinkronkan supaya toggle Riwayat menampilkan
   *  bulan yang benar — dulu openTrackerDate tidak menyentuh bulan. */
  openTrackerDate: (date: string) => void;
  /** VERIFY-48 (48-c F7): "Tulis jurnal" dari Beranda mendarat di KARTU
   *  CATATAN tracker (anchor #daily-notes-card), bukan puncak halaman.
   *  Flag konsumsi-sekali — digulir setelah tracker terpasang. */
  trackerFocusNotes: boolean;
  openTrackerNotes: (date: string) => void;
  clearTrackerNotesFocus: () => void;
  /** Bulan kalender Riwayat (TERPISAH dari selectedMonth finance — dulu
   *  satu state dibagi dua domain: ganti bulan di Keuangan diam-diam
   *  menggeser kalender habit, dan sebaliknya). */
  trackerMonth: string; // 'yyyy-MM' Jakarta
  setTrackerMonth: (month: string) => void;
  /** Buka tracker langsung di mode Riwayat (kalender) — tujuan drill-down
   *  dari Progress (streak, mood, pola mingguan) dan check-in history. */
  openTrackerHistory: (month?: string) => void;
  focusHabitId: string | null;
  openHabitFocus: (habitId: string) => void;
  clearHabitFocus: () => void;

  // goals (CONNECTED-APP: Habit ↔ Tujuan dua arah)
  focusGoalId: string | null;
  /** Buka tab Tujuan dengan tujuan tertentu disorot + ter-expand —
   *  tujuan drill-down dari chip "Tujuan" pada kartu habit tracker. */
  openGoalFocus: (goalId: string) => void;
  clearGoalFocus: () => void;

  // finance
  financeSubTab: FinanceSubTab;
  setFinanceSubTab: (sub: FinanceSubTab) => void;
  openFinanceSubTab: (sub: FinanceSubTab) => void;
  selectedMonth: string; // 'yyyy-MM' Jakarta (domain finance)
  setSelectedMonth: (month: string) => void;
  financeFocus: FinanceFocus | null;
  openFinanceFocus: (focus: FinanceFocus) => void;
  clearFinanceFocus: () => void;

  // progress
  progressPeriod: ProgressPeriod;
  setProgressPeriod: (period: ProgressPeriod) => void;
  /** POHON (Task 53): kartu "Pohonmu" Beranda → seksi "Jalan Pertumbuhan"
   *  tab Progres (anchor #jalan-pertumbuhan). Flag konsumsi-sekali —
   *  digulir setelah Progres terpasang (pola trackerFocusNotes). */
  progressFocusTree: boolean;
  openProgressTree: () => void;
  clearProgressTreeFocus: () => void;

  // settings
  settingsSection: SettingsSection;
  setSettingsSection: (section: SettingsSection) => void;

  // quick add (FAB)
  quickAddAction: QuickAddAction | null;
  /** Tab asal quick-add habit — setelah habit baru tersimpan, user
   *  dikembalikan ke konteks asal (dulu terdampar di Pengaturan). */
  quickAddReturnTab: TabId | null;
  triggerQuickAdd: (action: QuickAddAction, returnTab?: TabId) => void;
  clearQuickAdd: () => void;
  clearQuickAddReturn: () => void;

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
  // VERIFY-48 (48-c F2): navigasi tanggal (‹ › / "Hari ini") ikut
  // menyinkronkan bulan kalender — kontrak komentar openTrackerDate kini
  // berlaku untuk SEMUA jalur ganti tanggal. Dulu: buka 30 Sep via kalender
  // → tekan › (1 Okt) → toggle Riwayat masih menampilkan September.
  setSelectedDate: (date) =>
    set((s) => ({
      selectedDate: date,
      trackerMonth: date.slice(0, 7) !== s.trackerMonth ? date.slice(0, 7) : s.trackerMonth,
    })),
  openTrackerDate: (date) =>
    set({
      activeTab: 'tracker',
      trackerViewMode: 'today',
      selectedDate: date,
      // Sinkronkan bulan kalender supaya toggle Riwayat konsisten dengan
      // tanggal yang barusaja dibuka (CONNECTED-APP #6).
      trackerMonth: date.slice(0, 7),
    }),
  trackerFocusNotes: false,
  openTrackerNotes: (date) =>
    set({
      activeTab: 'tracker',
      trackerViewMode: 'today',
      selectedDate: date,
      trackerMonth: date.slice(0, 7),
      trackerFocusNotes: true,
    }),
  clearTrackerNotesFocus: () => set({ trackerFocusNotes: false }),
  trackerMonth: jakartaDateString().slice(0, 7),
  setTrackerMonth: (month) => set({ trackerMonth: month }),
  openTrackerHistory: (month) =>
    set((s) => ({
      activeTab: 'tracker',
      trackerViewMode: 'history',
      trackerMonth: month ?? s.trackerMonth,
    })),
  focusHabitId: null,
  // BUGHUNT-47 (47-e #5): semua pemanggil openHabitFocus berkonteks HARI INI
  // (baris Beranda, baris "Rutinitas Pendukung" goal, widget dashboard) —
  // dulu selectedDate basi dari sesi tracker sebelumnya ikut terbawa,jadi
  // "Selesai (hari ini)" di goal mendarat di tracker tanggal MINGGU LALU.
  // Sinkronkan ke hari ini + bulannya (pola openTrackerDate).
  openHabitFocus: (habitId) =>
    set({
      activeTab: 'tracker',
      trackerViewMode: 'today',
      focusHabitId: habitId,
      selectedDate: jakartaDateString(),
      trackerMonth: jakartaDateString().slice(0, 7),
    }),
  clearHabitFocus: () => set({ focusHabitId: null }),

  focusGoalId: null,
  openGoalFocus: (goalId) => set({ activeTab: 'goals', focusGoalId: goalId }),
  clearGoalFocus: () => set({ focusGoalId: null }),

  financeSubTab: 'overview',
  setFinanceSubTab: (sub) => set({ financeSubTab: normalizeFinanceSubTab(sub) }),
  openFinanceSubTab: (sub) => set({ activeTab: 'finance', financeSubTab: normalizeFinanceSubTab(sub) }),
  selectedMonth: jakartaDateString().slice(0, 7),
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  financeFocus: null,
  openFinanceFocus: (focus) =>
    set({ activeTab: 'finance', financeSubTab: 'transactions', financeFocus: focus }),
  clearFinanceFocus: () => set({ financeFocus: null }),

  progressPeriod: 'all',
  setProgressPeriod: (period) => set({ progressPeriod: period }),
  progressFocusTree: false,
  openProgressTree: () => set({ activeTab: 'progress', progressFocusTree: true }),
  clearProgressTreeFocus: () => set({ progressFocusTree: false }),

  settingsSection: 'umum',
  setSettingsSection: (section) => set({ settingsSection: section }),

  quickAddAction: null,
  quickAddReturnTab: null,
  triggerQuickAdd: (action, returnTab) =>
    set({ quickAddAction: action, quickAddReturnTab: returnTab ?? null }),
  clearQuickAdd: () => set({ quickAddAction: null }),
  clearQuickAddReturn: () => set({ quickAddReturnTab: null }),

  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
