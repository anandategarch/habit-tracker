'use client';

// ── Tab registry app shell (Task 71-a, split dari src/app/page.tsx) ──────
// SATU sumber kebenaran untuk konfigurasi tab: dynamic loader per tab,
// daftar navigasi sidebar (NAV_SECTIONS / NAV_ITEMS), daftar tab dock
// mobile (NAV_LEFT_ITEMS / NAV_RIGHT_ITEMS), dan mapping TabId →
// komponen (TAB_COMPONENTS).

import dynamic from 'next/dynamic';
import {
  Sunrise,
  ListChecks,
  Wallet,
  Settings as SettingsIcon,
  Briefcase,
  LineChart,
  TreePine,
  Dumbbell,
} from 'lucide-react';
import { TreeGrowSplash } from '@/components/ui/loaders';
import type { TabId } from '@/store/app-store';

// FIX-TRANSITION-1: Each tab is dynamically imported (ssr: false) to keep the
// initial bundle small + avoid SSR for components that use browser-only APIs.
// Previously these had NO `loading` fallback — when the user switched to a
// tab whose chunk wasn't yet loaded, the dynamic component returned `null`
// during the ~300ms chunk-fetch/parse window, producing a blank white screen
// ("transisi antar tab hanya putih aja").
//
// Now each dynamic() provides a `loading` render-prop that shows
// TreeGrowSplash varian inline (TASK 59: "animasi loading antar tab juga
// ganti icon nya" — pohon TUMBUH Tunas→Berbunga versi kilat: delay
// 0/0.2/0.4/0.6s, fade 0.26s, tanpa halo/ring; identitas sama dengan splash
// pembuka Task 58) for consistent branding across app load + tab
// transitions. The loader
// mounts immediately when the dynamic wrapper
// renders, then swaps out atomically once the chunk resolves — no blank
// frame in between. The PageTransition's motion.div still animates the
// surrounding fade, so the loader itself enters with the same fade-in.
const tabLoading = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-8">
    <TreeGrowSplash size={84} variant="inline" />
    <p className="text-xs text-muted-foreground">Memuat...</p>
  </div>
);

const Dashboard = dynamic(() => import('@/components/habit-tracker/dashboard'), { ssr: false, loading: tabLoading });
const DailyTracker = dynamic(() => import('@/components/habit-tracker/daily-tracker'), { ssr: false, loading: tabLoading });
// TASK 45: tab PROGRES — seluruh analitik "Your Journey" dipindah dari
// Beranda ke tab sendiri (brief: "Don't put all the analytics on Home").
// Komponen memakai query key ['dashboard', period, …] yang SAMA dengan
// Beranda → cache terbagih, berpindah tab tidak memicu fetch ulang.
const ProgressTab = dynamic(() => import('@/components/habit-tracker/progress'), { ssr: false, loading: tabLoading });

// TASK 66: tab TUJUAN DIHAPUS atas permintaan user ("aku gak perlu itu").

// TAB MESA KERJA (Task 17-a): catatan kerjaan — rutinitas berulang + tugas
// lepas + catatan kilat + Asisten AI. Loader sama (TreeGrowSplash inline)
// seperti tab lain.
const WorkDesk = dynamic(() => import('@/components/work/work-desk'), { ssr: false, loading: tabLoading });

// TASK 55 (POHON TAB): tab pohon interaktif — rumah baru pohon Rutina
// (panggung yang bisa disapa + disiram + panen buah emas). Key dashboard
// keluarga sama dgn Beranda → cache terbagih.
const PohonScreen = dynamic(() => import('@/components/tree/pohon-screen'), { ssr: false, loading: tabLoading });

// TASK 64 (GYM TAB): tab Peta Otot — siluet tubuh dengan zona otot
// samar-samar + misi mingguan; berdiri di atas data habit zona (Muscle
// Engine turunan — kalkulasi XP inti tidak tersentuh).
const GymScreen = dynamic(() => import('@/components/gym/gym-screen'), { ssr: false, loading: tabLoading });

const Finance = dynamic(() => import('@/components/habit-tracker/finance'), { ssr: false, loading: tabLoading });
const SettingsTab = dynamic(() => import('@/components/habit-tracker/settings'), { ssr: false, loading: tabLoading });

// TASK 45 — NAVIGATION REBUILD (destructive redesign):
// IA lama (flat 6 item, label "Beranda" → rasa dashboard) diganti arsitektur
// pengelompokan FEEL→DO→GROW:
//   MAIN (daily journey): Today (greeting+tree+check-in) → Tracker (DO)
//     → Progress (GROW analytics) → Pohon → Gym → Finance.
//   OTHER SPACES (low frequency): Work Desk, Settings — sidebar drawer /
//     hamburger, TIDAK lagi di dock mobile (Pengaturan keluar dari dock,
//     digantikan Progress yang jauh lebih sering dibuka).
// TASK 66: Goals/Tujuan dihapus dari IA (permintaan user); data tujuan &
//   API /api/goals tetap utuh (read-only) — buah emas pohon masih membacanya.
export const NAV_SECTIONS: {
  label: string;
  items: { id: TabId; label: string; icon: React.ElementType }[];
}[] = [
  {
    label: 'Utama',
    items: [
      { id: 'dashboard', label: 'Hari Ini', icon: Sunrise },
      { id: 'tracker', label: 'Tracker', icon: ListChecks },
      { id: 'progress', label: 'Progres', icon: LineChart },
      // TASK 55: Pohon — tujuan GROW baru di antara Progres & Tujuan
      // (drawer mobile + sidebar desktop; dock mobile sengaja TIDAK — 5
      // label tak muat di 320px, gerbang utamanya kartu "Pohonmu" Beranda).
      { id: 'pohon', label: 'Pohon', icon: TreePine },
      // TASK 64: Gym / Peta Otot — pasangan tubuh bagi pohon (GROW):
      // workout di rumah dengan reaksi visual per zona otot.
      { id: 'gym', label: 'Gym', icon: Dumbbell },
      { id: 'finance', label: 'Keuangan', icon: Wallet },
    ],
  },
  {
    label: 'Ruang lain',
    items: [
      { id: 'work', label: 'Meja Kerja', icon: Briefcase },
      { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
    ],
  },
];

// Flat lookup — dipakai header title & mapping lama.
export const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] =
  NAV_SECTIONS.flatMap((s) => s.items);

// PREMIUM DOCK PATTERN (TASK 45 v2 → TASK 54): Bottom nav = 2 left + FAB
// center + 2 right — Hari Ini + Tracker | FAB | Progres + Keuangan.
// TASK 54: "Tujuan" DIHAPUS dari dock atas permintaan user (dock kini
// simetris). TASK 66: Tujuan kini dihapus SEPENUHNYA dari navigasi —
// deep-link lama ?tab=goals jatuh ke fallback dashboard (VALID_TAB_IDS
// di app-url-sync.ts).
export const NAV_LEFT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Hari Ini', icon: Sunrise },
  { id: 'tracker', label: 'Tracker', icon: ListChecks },
];

export const NAV_RIGHT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'progress', label: 'Progres', icon: LineChart },
  { id: 'finance', label: 'Keuangan', icon: Wallet },
];

export const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  dashboard: Dashboard,
  tracker: DailyTracker,
  progress: ProgressTab,
  work: WorkDesk,
  pohon: PohonScreen,
  gym: GymScreen,

  finance: Finance,
  settings: SettingsTab,
};
