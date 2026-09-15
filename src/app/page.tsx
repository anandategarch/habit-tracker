'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type TabId, type FinanceSubTab, FINANCE_SUB_TABS } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
 Sunrise,
 ListChecks,
 Target,
 Wallet,
 Settings as SettingsIcon,
 PanelLeftClose,
 PanelLeftOpen,
 Sprout,
 Plus,
 ArrowDownRight,
 ArrowUpRight,
 ArrowLeftRight,
 Briefcase,
 LineChart,
 ClipboardList,
 TreePine,
} from 'lucide-react';
import { jakartaDateString } from '@/lib/jakarta-date';

// BUGHUNT-54 (3-d #2): gerbang Kunci Aplikasi — PIN perangkat (hash di
// localStorage 'rutina_app_lock', kelola di Pengaturan) kini benar-benar
// mengunci shell saat sesi baru. Komponen baru, app-lock-settings.tsx
// (READ-ONLY) tetap sumber kebenaran isAppLockSet/verifyAppLockPin.
import { AppLockGate } from '@/components/app-lock-gate';

import dynamic from 'next/dynamic';
import { PageTransition, ParallaxBackground } from '@/components/habit-tracker/page-transition';
import { PullToRefresh } from '@/components/habit-tracker/pull-to-refresh';
import { TreeGrowSplash } from '@/components/ui/loaders';

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
const Goals = dynamic(() => import('@/components/habit-tracker/goals'), { ssr: false, loading: tabLoading });

// TAB MESA KERJA (Task 17-a): catatan kerjaan — rutinitas berulang + tugas
// lepas + catatan kilat + Asisten AI. Loader sama (TreeGrowSplash inline)
// seperti tab lain.
const WorkDesk = dynamic(() => import('@/components/work/work-desk'), { ssr: false, loading: tabLoading });

// TASK 55 (POHON TAB): tab pohon interaktif — rumah baru pohon Rutina
// (panggung yang bisa disapa + disiram + panen buah emas). Key dashboard
// keluarga sama dgn Beranda → cache terbagih.
const PohonScreen = dynamic(() => import('@/components/tree/pohon-screen'), { ssr: false, loading: tabLoading });

const Finance = dynamic(() => import('@/components/habit-tracker/finance'), { ssr: false, loading: tabLoading });
const SettingsTab = dynamic(() => import('@/components/habit-tracker/settings'), { ssr: false, loading: tabLoading });

// TASK 45 — NAVIGATION REBUILD (destructive redesign):
// IA lama (flat 6 item, label "Beranda" → rasa dashboard) diganti arsitektur
// pengelompokan FEEL→DO→GROW:
//   MAIN (daily journey): Today (greeting+tree+check-in) → Tracker (DO)
//     → Progress (GROW analytics) → Goals (aspiration) → Finance.
//   OTHER SPACES (low frequency): Work Desk, Settings — sidebar drawer /
//     hamburger, TIDAK lagi di dock mobile (Pengaturan keluar dari dock,
//     digantikan Progress yang jauh lebih sering dibuka).
const NAV_SECTIONS: {
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
      { id: 'goals', label: 'Tujuan', icon: Target },
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
const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] =
  NAV_SECTIONS.flatMap((s) => s.items);

// PREMIUM DOCK PATTERN (TASK 45 v2 → TASK 54): Bottom nav = 2 left + FAB
// center + 2 right — Hari Ini + Tracker | FAB | Progres + Keuangan.
// TASK 54: "Tujuan" DIHAPUS dari dock atas permintaan user (dock kini
// simetris). Tujuan tetap terjangkau: drawer hamburger mobile + sidebar
// desktop (NAV_SECTIONS) + deep-link ?tab=goals + openGoalFocus().

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
 dashboard: Dashboard,
 tracker: DailyTracker,
 progress: ProgressTab,
 work: WorkDesk,
 goals: Goals,
 pohon: PohonScreen,

 finance: Finance,
 settings: SettingsTab,
};

// BUGHUNT-OTHER-1 BUG-M14: lookup set for validating the `?tab=` query param.
const VALID_TAB_IDS = new Set<string>([
 'dashboard', 'tracker', 'progress', 'work', 'goals',
 'finance', 'settings', 'pohon',
]);

// ── CONNECTED-APP (Task 46): URL = konteks yang shareable ─────────────────
// Deep-link yang didukung (hanya konteks yang memang layak dibagikan —
// bukan seluruh transient state):
//   ?tab=tracker|progress|work|finance|goals|settings|pohon
//   ?date=yyyy-MM-dd   → tanggal tracker terpilih (bila ≠ hari ini)
//   ?sub=transactions|budgets|… → sub-tab Keuangan (bila ≠ overview)
// Browser Back kini bersejarah: pergantian tab membuat entry history baru
// (pushState) sehingga perjalanan Hari Ini → Tujuan → Habit bisa mundur
// alami (dulu replaceState → tombol Back langsung keluar aplikasi).
const URL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** BUGHUNT-47 (47-d #5): ?date= harus tanggal kalender NYATA — regex saja
 *  menerima '9999-99-99'/'2026-02-31' lalu Date.UTC me-roll-over ke tanggal
 *  mustahil di tracker. Validasi komponen UTC balik sama persis. */
function isValidCalendarDate(ymd: string): boolean {
 const [y, m, d] = ymd.split('-').map(Number);
 if (!y || !m || !d) return false;
 const dt = new Date(Date.UTC(y, m - 1, d));
 return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Terapkan parameter URL → store (dipakai saat mount awal & popstate).
 * BUGHUNT-47 (47-d #1 — tombol Back "macet"): param konteks yang TIDAK ada
 * di entry history kini me-RESET konteks store (URL = sumber kebenaran saat
 * Back/deep-link). Dulu `?tab=finance` tanpa `?sub=` masih memegang
 * sub-tab lama → efek sinkron pushState BARU saat mundur → entry maju
 * dihancurkan & Back tampak mati. */
function applyUrlToStore() {
 const params = new URLSearchParams(window.location.search);
 const s = useAppStore.getState();
 const tab = params.get('tab');
 const nextTab = tab && VALID_TAB_IDS.has(tab) ? (tab as TabId) : 'dashboard';
 if (nextTab !== s.activeTab) s.setActiveTab(nextTab);
 // ?date= hanya relevan di konteks tracker (47-d #5) — di tab lain param
 // ini justru menempel sebagai konteks basi.
 const date = params.get('date');
 const dateOk = !!date && URL_DATE_RE.test(date) && isValidCalendarDate(date);
 if (nextTab === 'tracker') {
  if (dateOk) {
   if (date !== s.selectedDate) {
    s.setSelectedDate(date);
    if (date.slice(0, 7) !== s.trackerMonth) s.setTrackerMonth(date.slice(0, 7));
   }
   // VERIFY-48 (48-b): entry ?date=X menjanjikan TAMPILAN HARI itu — reset
   // viewMode KE SETIAP popstate/mount bertanggal (dulu hanya saat tanggal
   // berbeda: Back dari tab lain dengan tanggal SAMA masih bisa mendarat di
   // kalender Riwayat yang basi).
   if (s.trackerViewMode !== 'today') s.setTrackerViewMode('today');
  } else if (!dateOk) {
   // Entry tanpa konteks tanggal = hari ini (mencegah tanggal basi menempel
   // saat Back ke entry pra-konteks).
   const today = jakartaDateString();
   if (s.selectedDate !== today) {
    s.setSelectedDate(today);
    if (today.slice(0, 7) !== s.trackerMonth) s.setTrackerMonth(today.slice(0, 7));
   }
   // TASK 60-a #4b (temuan 59-b1 — paritas VERIFY-48): entry TANPA ?date juga
   // menjanjikan TAMPILAN DEFAULT (hari ini), bukan view-mode basi. Semantik
   // cabang ber-date (VERIFY-48 48-b): "entry ?date=X menjanjikan TAMPILAN
   // HARI itu — reset viewMode ke setiap popstate/mount bertanggal"; dulu
   // hanya cabang itu yang me-reset — Back dari tab lain ke entry tracker
   // TANPA ?date (tanggal = hari ini) masih bisa mendarat di kalender
   // Riwayat yang basi. Kedua cabang kini konsisten: URL = sumber kebenaran
   // saat Back/deep-link; view-mode hanya "survive pergantian tab" lewat
   // klik nav (jalur pushState tidak memanggil fungsi ini).
   if (s.trackerViewMode !== 'today') s.setTrackerViewMode('today');
  }
 }
 const sub = params.get('sub');
 if (nextTab === 'finance') {
  if (
   sub &&
   FINANCE_SUB_TABS.has(sub) &&
   sub !== s.financeSubTab
  ) {
   s.setFinanceSubTab(sub as FinanceSubTab);
  } else if (!sub && s.financeSubTab !== 'overview') {
   s.setFinanceSubTab('overview');
  }
 }
}

/** Susun URL konteks untuk state saat ini (tab aktif + konteksnya).
 * BUGHUNT-47 (47-d #6): param tak dikenal (?goal=/?category=/… hasil URL
 * manual) dibersihkan supaya URL tetap kanonik dan tidak menempel abadi
 * di semua pushState berikutnya. */
function buildContextUrl(tab: TabId): URL {
 const url = new URL(window.location.href);
 const known = new Set(['tab', 'date', 'sub']);
 for (const key of Array.from(url.searchParams.keys())) {
  if (!known.has(key)) url.searchParams.delete(key);
 }
 url.searchParams.delete('tab');
 url.searchParams.delete('date');
 url.searchParams.delete('sub');
 if (tab !== 'dashboard') url.searchParams.set('tab', tab);
 const s = useAppStore.getState();
 if (tab === 'tracker' && s.selectedDate !== jakartaDateString()) {
  url.searchParams.set('date', s.selectedDate);
 }
 if (tab === 'finance' && s.financeSubTab !== 'overview') {
  url.searchParams.set('sub', s.financeSubTab);
 }
 return url;
}

export default function Home() {
 const activeTab = useAppStore(s => s.activeTab);
 const setActiveTab = useAppStore(s => s.setActiveTab);
 // CONNECTED-APP: konteks URL — tanggal tracker & sub-tab keuangan ikut
 // diserialisasi ke ?date= / ?sub= (deep-link + tombol Back).
 const selectedDate = useAppStore(s => s.selectedDate);
 const financeSubTab = useAppStore(s => s.financeSubTab);
 const sidebarOpen = useAppStore(s => s.sidebarOpen);
 const setSidebarOpen = useAppStore(s => s.setSidebarOpen);
 const triggerRefresh = useAppStore(s => s.triggerRefresh);
 const triggerQuickAdd = useAppStore(s => s.triggerQuickAdd);
 const queryClient = useQueryClient();

 // Splash screen on initial app load — TASK 58: TreeGrowSplash — pohon
// TUMBUH dari Tunas → Pohon Muda → Pohon Dewasa → Berbunga (4 artwork
// botanical pengguna, crossfade bertumpuk dari tanah yang sama) + halo
// teal bernapas + progress ring mengakselerasi, selama 2.0s while dynamic
// imports + React Query fetch data. Makes first load feel premium +
// branded — pengganti TreeMark statis (Task 56/57).
// TASK-58 timing: 1.6s → 2.0s — narasi 4 tahap butuh ruang (tahap terakhir
// penuh di 1.76s); masih dalam rentang riset Task 27 (ideal 1.5-2s, exit
// reveal 400ms). Ring 1.62s selesai ~saat berbunga penuh.
// FEAT-SPLASH-REVEAL: Exit animation (fade + scale + slide up, 400ms)
// instead of hard cut. Uses splashExiting state to delay unmount until
// animation completes.
const [showSplash, setShowSplash] = useState(true);
 const [splashExiting, setSplashExiting] = useState(false);
 useEffect(() => {
   // BUGFIX POST-2 #2: Hoist unmountTimer ke outer scope supaya outer
   // cleanup bisa clear both timers. Sebelumnya inner return adalah dead
   // code (setTimeout ignores callback return values) → timer leak +
   // setState-after-unmount risk.
   let unmountTimer: ReturnType<typeof setTimeout>;
   const exitTimer = setTimeout(() => {
     setSplashExiting(true);
     // Unmount after exit animation completes (400ms)
     unmountTimer = setTimeout(() => setShowSplash(false), 400);
   }, 2000);
   return () => {
     clearTimeout(exitTimer);
     if (unmountTimer) clearTimeout(unmountTimer);
   };
 }, []);

 // ANIM-3 / Feature 5: Pull-to-refresh handler. Called by PullToRefresh
 // when the user pulls past the threshold on a touch device. Invalidates
 // all React Query caches (active queries refetch immediately) AND bumps
 // `refreshKey` for components that use the non-React-Query refresh
 // pattern (e.g. daily-tracker's month-cache useEffect). Wrapped in
 // Promise.resolve so the caller can always `await` even if the inner
 // work is sync.
 // BUGHUNT-54 (3-d #6): urutan PENTING — triggerRefresh() DULU, baru
 // invalidateQueries(). triggerRefresh sinkron mengganti refreshKey dalam
 // queryKey 5 keluarga query → query KUNCI BARU mulai fetch; query kunci
 // LAMA otomatis jadi inactive. invalidateQueries() tanpa filter menandai
 // semua query untuk refetch, tapi query inactive (kunci lama) tidak
 // di-refetch, dan query kunci BARU yang sedang in-flight ter-dedupe
 // React Query. Dulu urutannya terbalik → endpoint berat kena 2×
 // (refetch kunci lama + fetch kunci baru).
 const handleRefresh = useCallback(async () => {
   triggerRefresh();
   await queryClient.invalidateQueries();
 }, [queryClient, triggerRefresh]);

 // BUGHUNT-OTHER-1 BUG-L9: header date string should use Jakarta wall-clock
 // date, not the browser-local date, so it stays consistent for users in
 // non-WIB timezones.
 // FIX DATE-HEADER: state awal SELALU '' (jangan cabang typeof window —
 // init beda server/client memicu mismatch hydration; React mempertahankan
 // DOM server kosong lalu bailout karena nilai effect sama dgn state
 // client → tanggal TIDAK PERNAH tampil). Effect di bawah mengisi nilai.
 const [dateString, setDateString] = useState('');

 // Refresh date string every minute so it stays accurate past midnight
 // (Jakarta midnight, not browser-local midnight).
 useEffect(() => {
   const update = () => {
     setDateString(
       new Date(`${jakartaDateString()}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
     );
   };
   update();
   const id = setInterval(update, 60_000);
   return () => clearInterval(id);
 }, []);

 // CONNECTED-APP: deep-link URL saat mount pertama (?tab= + ?date= + ?sub=,
 // validasi ketat — konteks dipulihkan tanpa reload).
 useEffect(() => {
  if (typeof window === 'undefined') return;
  applyUrlToStore();
 }, []);

 // CONNECTED-APP: sinkronisasi store → URL. Pergantian TAB membuat entry
 // history baru (pushState → tombol Back mundur antar tab secara alami);
 // perubahan param konteks saja (tanggal tracker / sub-tab keuangan) memakai
 // replaceState supaya history tidak dibanjiri entry kecil. popstate sudah
 // meng-update store, jadi cabang ini jadi no-op saat Back (URL sama).
 const prevTabRef = useRef<TabId | null>(null);
 // BUGHUNT-47 (47-d #1): popstate tidak boleh mem-push entry history baru —
 // pushState saat mundur menghancurkan riwayat maju & membuat Back tampak
 // mati. Flag ini memaksa replaceState untuk siklus sinkron yang dipicu
 // popstate (dibersihkan setelah efek jalan / macrotask berikutnya).
 const isPopstateRef = useRef(false);
 useEffect(() => {
  if (typeof window === 'undefined') return;
  // VERIFY-48 (48-b): eksekusi PERTAMA efek (mount) menutup mata memakai
  // state render-1 (pra-deep-link, activeTab='dashboard') → replaceState
  // MENGHAPUS entry deep-link asli lalu pushState membuat duplikat —
  // Back dari tab deep-link mendarat di dashboard kosong, bukan keluar app.
  // Mount: applyUrlToStore (efek di atasnya) sudah menyelaraskan store ↔
  // URL; cukup kanonikalisasi IN-PLACE (param sampah dibersihkan tanpa
  // mengganti entry) + catat tab sebagai titik awal riwayat.
  if (prevTabRef.current === null) {
   const mountedTab = useAppStore.getState().activeTab;
   prevTabRef.current = mountedTab;
   const canonical = buildContextUrl(mountedTab);
   if (canonical.search !== window.location.search) {
    window.history.replaceState({ rutinaTab: mountedTab }, '', canonical.toString());
   }
   return;
  }
  const url = buildContextUrl(activeTab);
  const isTabSwitch = prevTabRef.current !== null && prevTabRef.current !== activeTab;
  if (url.search !== window.location.search) {
   if (isTabSwitch && !isPopstateRef.current) {
    window.history.pushState({ rutinaTab: activeTab }, '', url.toString());
   } else {
    window.history.replaceState({ rutinaTab: activeTab }, '', url.toString());
   }
  }
  prevTabRef.current = activeTab;
  isPopstateRef.current = false;
 }, [activeTab, selectedDate, financeSubTab]);

 // CONNECTED-APP: tombol Back browser → pulihkan konteks dari URL ke store
 // (mundur antar tab tanpa reload — dulu Back selalu keluar aplikasi).
 useEffect(() => {
  const onPop = () => {
   isPopstateRef.current = true;
   // BUGHUNT-54 (3-d #5): aksi quick-add yang BELUM terkonsumsi saat user
   // menekan Back = user membatalkan (Back terjadi sebelum chunk tab target
   // termount & efek konsumennya jalan) — bersihkan supaya tab yang
   // dikunjungi manual belakangan tidak mendadak membuka dialog tambah.
   // Bila aksi sudah dikonsumsi nilainya null → clearQuickAdd() no-op.
   useAppStore.getState().clearQuickAdd();
   applyUrlToStore();
   // Guard: bila popstate tidak mengubah store (efek sinkron tidak jalan),
   // flag tetap harus bersih sebelum klik tab berikutnya — jika tidak, klik
   // tab berikutnya akan replaceState (entry history tidak dibuat).
   setTimeout(() => { isPopstateRef.current = false; }, 0);
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
 }, []);

 // Auto-open sidebar on desktop (≥768px) on first mount.
 // Default is closed to avoid jarring overlay on mobile first load.
 // BUGHUNT-OTHER-1 BUG-L16: also react to window resize — previously the
 // sidebar only opened if the user happened to be on desktop at first
 // mount, and never re-opened when resizing from mobile to desktop.
 // BUGHUNT-ROUND2 SIDEBAR-1: the resize listener only ever OPENED the
 // sidebar (>=768px) — shrinking the window back to mobile left the
 // sidebar drawer open, covering ~2/3 of a phone screen with the dark
 // overlay. Now resize sets the state to match the viewport: open on
 // desktop, closed on mobile. A deliberately-opened mobile drawer is
 // unaffected until the user actually resizes/rotates the device.
 // TASK 59-b1 #4: resize kini hanya bereaksi saat BREAKPOINT CROSSING.
 // Sebelumnya ANY resize event memaksa setSidebarOpen(matchViewport):
 // sidebar desktop yang sengaja ditutup user diam-diam terbuka lagi oleh
 // zoom-devtools/resize jendela, dan drawer mobile terbuka dipaksa tutup.
 // Perilaku asli mount (auto-open desktop) dan crossing (BUGHUNT-ROUND2
 // SIDEBAR-1) tetap utuh.
 useEffect(() => {
   if (typeof window === 'undefined') return;
   let wasDesktop = window.innerWidth >= 768;
   setSidebarOpen(wasDesktop); // perilaku mount asli: auto-open di desktop
   const apply = () => {
     const isDesktop = window.innerWidth >= 768;
     if (isDesktop !== wasDesktop) {
       wasDesktop = isDesktop;
       setSidebarOpen(isDesktop);
     }
   };
   window.addEventListener('resize', apply);
   return () => window.removeEventListener('resize', apply);
 }, [setSidebarOpen]);

 // BUGHUNT-54 (3-d #3): deteksi mobile via matchMedia dulu dipakai kondisi
 // `inert` sidebar. TASK 59-b1 #2: state itu dihapus saat kondisi inert
 // disederhanakan. TASK 60-a #4a (temuan 59-b1): matchMedia DIBUAT KEMBALI
 // — kini untuk semantik MODAL drawer mobile: focus trap + inert konten di
 // belakang overlay hanya berlaku saat drawer terbuka di viewport mobile
 // (<768px — overlay dim terlihat). Di desktop sidebar adalah panel docked
 // (bukan modal): Tab harus tetap mengalir normal antara sidebar & konten.
 // Listener matchMedia independen — tidak menyentuh listener resize
 // breakpoint-crossing di atas.
 const [isMobileViewport, setIsMobileViewport] = useState(false);
 useEffect(() => {
   const mq = window.matchMedia('(min-width: 768px)');
   const update = () => setIsMobileViewport(!mq.matches);
   update();
   mq.addEventListener('change', update);
   return () => mq.removeEventListener('change', update);
 }, []);

 // BUGHUNT-54 (3-d #3b): Escape menutup drawer saat terbuka — paritas a11y
 // dengan pola Escape menu FAB (PremiumBottomNav) yang sudah ada.
 // TASK 60-a #4a (temuan 59-b1): drawer mobile kini MODAL penuh (pola
 // WAI-ARIA dialog): saat terbuka di viewport mobile — simpan
 // document.activeElement, pindahkan fokus ke elemen focusable pertama di
 // drawer, Tab/Shift+Tab berputar DI DALAM drawer (focus trap), Escape
 // menutup, dan fokus dikembalikan ke elemen tersimpan saat tertutup
 // (fallback: tombol toggle header — saat drawer dibuka via klik,
 // browser Safari tidak memfokuskan tombol; dan saat inert main aktif,
 // browser mem-blur tombol). SATU handler terpadu menggantikan listener
 // Escape lama — tidak ada handler dobel/close ganda. Di desktop hanya
 // perilaku Escape lama yang berlaku (panel docked, bukan modal).
 const drawerRef = useRef<HTMLElement>(null);
 const sidebarToggleRef = useRef<HTMLButtonElement>(null);
 const drawerReturnFocusRef = useRef<HTMLElement | null>(null);
 useEffect(() => {
   if (!sidebarOpen) return;
   const drawer = drawerRef.current;
   if (!drawer) return;
   const focusables = () =>
     Array.from(
       drawer.querySelectorAll<HTMLElement>(
         'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
       ),
     );
   const isModalDrawer = isMobileViewport;
   if (isModalDrawer) {
     const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
     drawerReturnFocusRef.current =
       active && active !== document.body ? active : sidebarToggleRef.current;
     focusables()[0]?.focus();
   }
   const onKey = (e: KeyboardEvent) => {
     if (e.key === 'Escape') {
       setSidebarOpen(false);
       return;
     }
     if (!isModalDrawer || e.key !== 'Tab') return;
     const list = focusables();
     if (list.length === 0) return;
     const first = list[0];
     const last = list[list.length - 1];
     const activeEl = document.activeElement;
     if (e.shiftKey) {
       if (activeEl === first || !drawer.contains(activeEl)) {
         e.preventDefault();
         last.focus();
       }
     } else if (activeEl === last || !drawer.contains(activeEl)) {
       e.preventDefault();
       first.focus();
     }
   };
   window.addEventListener('keydown', onKey);
   return () => {
     window.removeEventListener('keydown', onKey);
     if (isModalDrawer) {
       drawerReturnFocusRef.current?.focus?.();
       drawerReturnFocusRef.current = null;
     }
   };
 }, [sidebarOpen, isMobileViewport, setSidebarOpen]);

 const handleNavClick = useCallback((id: TabId) => {
   setActiveTab(id);
   // Auto-close sidebar on mobile after clicking a nav item
   if (typeof window !== 'undefined' && window.innerWidth < 768) {
     setSidebarOpen(false);
   }
 }, [setActiveTab, setSidebarOpen]);

 const toggleSidebar = useCallback(() => {
   setSidebarOpen(!sidebarOpen);
 }, [sidebarOpen, setSidebarOpen]);

 const ActiveComponent = TAB_COMPONENTS[activeTab];

 return (
   <TooltipProvider delayDuration={300}>     {/* Splash screen — TASK 58: TreeGrowSplash — animasi pohon TUMBUH
         Tunas → Pohon Muda → Pohon Dewasa → Berbunga (artwork botanical
         pengguna, mark transparan — fix kotak Task 57 dipertahankan) on
         initial app load (2.0s). Premium branded loading: sekuens tumbuh
         + halo bernapas + progress ring mengakselerasi (riset CMU: terasa
         lebih cepat). FEAT-SPLASH-REVEAL: exit animation (fade + scale +
         slide up) instead of hard cut; content entrance (fade + slide up). */}
     {showSplash && (
       <div
         className={cn(
           'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background app-ambience gap-6',
           splashExiting ? 'anim-splash-exit' : 'anim-splash-enter'
         )}
         key="splash"
       >
         <TreeGrowSplash size={180} ring />
         <div className="text-center">
           <p className="text-lg font-semibold text-primary tracking-tight">Rutina</p>
           <p className="text-xs text-muted-foreground mt-1">Menumbuhkan habit harian</p>
         </div>
       </div>
     )}
     {/* BUGFIX SCROLL-2: h-dvh + overflow-hidden bounds the layout to the
         viewport so the inner PullToRefresh (content area) becomes a REAL
         scroll container. Previously min-h-dvh (no max height) let the
         wrapper grow to fit content, making overflow-y-auto inert and
         forcing the document (html) to scroll — which on mobile Chrome/
         iOS Safari intermittently fails to respond to touch after DnD
         sensors or CSS animations intercept touch events. With the layout
         bounded, PullToRefresh owns the scroll, document doesn't scroll. */}
     {/* BUGHUNT-54 (3-d #2): AppLockGate membungkus SELURUH shell (header,
         konten tab, sidebar/drawer, PremiumBottomNav) — saat PIN diset dan
         sesi belum dibuka, hanya layar kunci yang dirender (shell tidak
         termount sama sekali). Splash screen tetap di luar gerbang
         (branding dulu → layar kunci → aplikasi). Tanpa PIN: pass-through. */}
     <AppLockGate>
     <div className={cn('h-dvh flex bg-background overflow-hidden', splashExiting && 'anim-content-reveal')}>
       {/* ANIM-2 / Feature 4: Parallax background layer — subtle decorative
           gradient that drifts opposite to scroll direction. Fixed-positioned,
           behind all content (-z-10), pointer-events-none. Renders as a static
           layer when prefers-reduced-motion is set. */}
       <ParallaxBackground className="app-ambience" />

       {/* Mobile dark overlay */}
       {sidebarOpen && (
         <div
           className="fixed inset-0 bg-black/40 z-40 md:hidden"
           onClick={() => setSidebarOpen(false)}
         />
       )}

       {/* Sidebar - fixed position, slides in/out.
           PREMIUM-UI: glass panel + gradient logo + active pill gradien.
           TASK 59-b1 #2: `inert` setiap kali drawer TERTUTUP (dulu hanya di
           viewport mobile — di desktop, sidebar tertutup tetap off-screen
           di -translate-x-full TAPI tetap focusable: Tab mendarat di tombol
           nav tak terlihat & Enter mengganti tab diam-diam — pelanggaran
           WCAG 2.4.3/2.4.7). Tombol toggle di header tetap aktif untuk
           membuka kembali. */}
       <aside
         ref={drawerRef}
         {...(!sidebarOpen ? { inert: true } : {})}
         className={cn(
           'fixed top-0 left-0 z-50 h-dvh w-64 flex flex-col',
           'bg-card/95 backdrop-blur-xl border-r border-border',
           'transition-transform duration-300 ease-in-out',
           sidebarOpen ? 'translate-x-0' : '-translate-x-full'
         )}
       >
         {/* Logo — TASK 45: tagline "Tumbuh setiap hari" (bukan spesifikasi
             fitur) — identitas Personal Life Companion. */}
         <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
           <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary/85 to-emerald-500 text-white premium-fab-shadow">
             <Sprout className="h-5 w-5" strokeWidth={2.2} />
           </div>
           <div className="leading-tight">
             <span className="font-bold text-sm tracking-tight">Rutina</span>
             <p className="text-[10px] text-muted-foreground/70">Tumbuh setiap hari</p>
           </div>
         </div>

         {/* Navigation — TASK 45: dikelompokkan (Utama / Ruang lain) supaya
             hirarki IA terbaca: perjalanan harian dulu, ruang pendukung kemudian. */}
         <ScrollArea className="flex-1 py-3 custom-scrollbar">
           <nav className="px-2.5 space-y-4" aria-label="Navigasi utama">
             {NAV_SECTIONS.map((section) => (
               <div key={section.label}>
                 <p className="premium-label px-3 pb-1.5">{section.label}</p>
                 <div className="space-y-1">
                   {section.items.map((item) => {
                     const Icon = item.icon;
                     const isActive = activeTab === item.id;
                     return (
                       <button
                         key={item.id}
                         onClick={() => handleNavClick(item.id)}
                         // BUGHUNT-54 (3-d #8): aria-current untuk nav
                         // sidebar/drawer (paritas dgn tombol dock).
                         aria-current={isActive ? 'page' : undefined}
                         className={cn(
                           'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                           'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                           isActive
                             ? 'btn-primary-gradient text-primary-foreground shadow-md'
                             : 'text-muted-foreground hover:text-foreground hover:bg-accent/70 active:scale-[0.98]',
                         )}
                       >
                         <Icon className={cn('h-4 w-4 shrink-0', isActive && 'anim-nav-icon-pop')} />
                         <span>{item.label}</span>
                       </button>
                     );
                   })}
                 </div>
               </div>
             ))}
           </nav>
         </ScrollArea>

         <Separator />

         {/* Footer */}
         <div className="px-4 py-3 shrink-0">
           <p className="text-[10px] text-muted-foreground/60">by Ananda Tegar</p>
         </div>
       </aside>

       {/* Main content - shifts right on desktop when sidebar is open.
           min-h-0 (BUGFIX SCROLL-1) lets flex-1 children shrink below content
           height so a future bounded-height layout produces a real scroll
           container instead of growing to fit content. */}
       <main
         {...(sidebarOpen && isMobileViewport ? { inert: true } : {})}
         className={cn(
           'flex-1 min-w-0 min-h-0 flex flex-col transition-[margin] duration-300 ease-in-out',
           sidebarOpen ? 'md:ml-64' : 'md:ml-0'
         )}
       >
         {/* Top bar — PREMIUM-UI: kaca blur + hairline bawah fade */}
         <header className="sticky top-0 z-30 h-14 bg-background/75 backdrop-blur-xl flex items-center px-4 md:px-6 gap-3 border-b border-border/70">
           <Tooltip>
             <TooltipTrigger asChild>
               <Button
                 ref={sidebarToggleRef}
                 variant="ghost"
                 size="icon"
                 onClick={toggleSidebar}
                 aria-label={sidebarOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}
               >
                 {sidebarOpen
                   ? <PanelLeftClose className="h-5 w-5" />
                   : <PanelLeftOpen className="h-5 w-5" />
                 }
               </Button>
             </TooltipTrigger>
             <TooltipContent side="right">
               {sidebarOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}
             </TooltipContent>
           </Tooltip>
           <h1 className="text-lg font-semibold truncate">
             {NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Rutina'}
           </h1>
           {/* TASK 45: tanggal kini tampil mulai 420px (di bawah itu space
               header sempit — tanggal sudah hadir dalam kartu hero Hari Ini). */}
           <div className="ml-auto text-xs text-muted-foreground hidden min-[420px]:block" suppressHydrationWarning>
             {dateString}
           </div>
         </header>

         {/* Content area — extra bottom padding on mobile so content
             doesn't get hidden behind the floating glass dock.
             Dock stack: 62px bar + 10px bottom margin + 16px breathing
             gap = 88px (excluding safe-area inset).

             overflow-y-auto + overscroll-y-contain for smooth touch scroll
             on mobile (prevents scroll chaining to body / stuck scroll
             after DnD sensors or CSS animations intercept touch events).
             WebkitOverflowScrolling: 'touch' enables iOS momentum scrolling.

             ANIM-3 / Feature 5: PullToRefresh wraps the content area.
             On touch devices, the user can pull down at the top of the
             scroll area to trigger a full data refresh (a 🌱 sprout
             grows as they pull, then spins while refreshing). On
             desktop (no touch), it's a pass-through wrapper — no
             behaviour change. */}
         <PullToRefresh
           data-slot="app-scroller"
           className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 md:p-6 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-6"
           onRefresh={handleRefresh}
         >
           {/* ANIM-2 / Feature 4: PageTransition wraps the active tab
               content with a smooth enter/exit (fade + slide x).
               Replaces the previous `anim-tab-enter` CSS-only transition
               with framer-motion's AnimatePresence for crossfade-aware
               enter/exit (no overlap). `tabId={activeTab}` triggers a
               re-mount on tab change. */}
           <PageTransition tabId={activeTab}>
             <ActiveComponent />
           </PageTransition>
         </PullToRefresh>
       </main>

       {/* ── Mobile bottom navigation (Premium Floating Glass Dock) ────
           Design: floating frosted-glass dock (mx-3, rounded-[26px]) with
           2 tabs left + FAB center + 2 tabs right. A gradient "liquid"
           indicator slides between tabs with spring easing (passes behind
           the FAB). FAB = quick-add (glass popup: Pengeluaran/Pemasukan/
           Habit) with staggered spring item entrance + dimmed backdrop. */}
       <PremiumBottomNav
         activeTab={activeTab}
         onNavClick={handleNavClick}
         inertBehindDrawer={sidebarOpen && isMobileViewport}
       />
     </div>
     </AppLockGate>
   </TooltipProvider>
 );
}


// ── PremiumBottomNav ───────────────────────────────────────────────────
// PREMIUM REDESIGN (replaces the old Flutter notched bar):
// "Floating Glass Dock" — iOS-18 / modern-fintech design language.
//  • Floating frosted-glass bar (mx-3, rounded-[26px], backdrop-blur-2xl)
//    with layered teal-tinted depth shadows + top hairline highlight.
//  • Gradient "liquid" indicator that slides between tabs with a spring
//    curve (cubic-bezier overshoot) and passes BEHIND the FAB.
//  • Center FAB: teal→emerald gradient, glow, socket ring illusion,
//    rotates 45° into an X when the menu is open.
//  • Quick-add popup: frosted glass card, spring-staggered items, tail
//    pointer, dimmed backdrop (tap/Escape to close).
//  • Mobile-only (md:hidden). a11y: aria-current, aria-expanded,
//    role=menu, focus-visible rings, prefers-reduced-motion respected.

const DOCK_H = 62; // dock height (px)
// TASK 54: Tujuan keluar dari dock (permintaan user) — dock simetris:
// 2 tab kiri + FAB tengah + 2 tab kanan. dockTabMetrics() data-driven
// jadi geometri indikator menyesuaikan otomatis; aktifTab 'goals' (via
// drawer/deep-link) membiarkan indikator tersembunyi — sama perilakunya
// seperti tab 'work'/'settings' yang memang tak pernah ada di dock.
// BUGHUNT-54 (3-d #4): 0.43 → 0.40. Zona tengah (1 − 2×DOCK_SIDE) kini 20%
// ≈ 59px @dock 296px (viewport 320px) ≥ FAB 56px — dulu 14% ≈ 41px < 56px,
// sudut dalam tombol Tracker/Progres ketimpa FAB (elementFromPoint = FAB).
// Lebar tab @320px = 0.40×296/2 ≈ 59px masih muat untuk label terpanjang
// "Keuangan" (~47px).
const DOCK_SIDE = 0.40; // width share of each tab group (left/right)
const IND_INSET = 3; // indicator horizontal inset inside a tab
const FAB_SIZE = 56; // FAB diameter (px)
const FAB_PROTRUDE = 22; // px of FAB protruding above the dock top edge

const NAV_LEFT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
 { id: 'dashboard', label: 'Hari Ini', icon: Sunrise },
 { id: 'tracker', label: 'Tracker', icon: ListChecks },
];

const NAV_RIGHT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
 { id: 'progress', label: 'Progres', icon: LineChart },
 { id: 'finance', label: 'Keuangan', icon: Wallet },
];

// Geometri indikator per tab (fraksi lebar dock) — data-driven dari daftar
// di atas, jadi menambah/menggeser tab tidak perlu menyentuh konstanta
// posisi manual. Setiap tab punya {left, width} dalam fraksi dockW.
function dockTabMetrics(id: TabId): { left: number; width: number } | undefined {
 const li = NAV_LEFT_ITEMS.findIndex((n) => n.id === id);
 if (li >= 0) {
   const w = DOCK_SIDE / NAV_LEFT_ITEMS.length;
   return { left: w * li, width: w };
 }
 const ri = NAV_RIGHT_ITEMS.findIndex((n) => n.id === id);
 if (ri >= 0) {
   const w = DOCK_SIDE / NAV_RIGHT_ITEMS.length;
   return { left: 1 - DOCK_SIDE + w * ri, width: w };
 }
 return undefined;
}

function PremiumBottomNav({
 activeTab,
 onNavClick,
 inertBehindDrawer,
}: {
 activeTab: TabId;
 onNavClick: (id: TabId) => void;
 /** TASK 60-a #4a: dock ikut non-interactive saat drawer mobile terbuka
     (modal penuh — konten di belakang overlay tidak boleh tersentuh
     pointer/keyboard; fokus dikembalikan trap drawer). Desktop tidak
     terpengaruh (prop hanya true saat viewport <768px). */
 inertBehindDrawer?: boolean;
}) {
 const dockRef = useRef<HTMLDivElement>(null);
 const [dockW, setDockW] = useState(0);
 const [fabOpen, setFabOpen] = useState(false);
 // BUGHUNT-ROUND2 FAB-1: quick-add trigger lives in the store so this
 // deep nav component can fire it without prop-drilling from Home().
 const triggerQuickAdd = useAppStore((s) => s.triggerQuickAdd);
 // ONE-CLICK-2: sub-tab deep-link for the Transfer quick action.
 const openFinanceSubTab = useAppStore((s) => s.openFinanceSubTab);

 useLayoutEffect(() => {
   if (!dockRef.current) return;
   const update = () => setDockW(dockRef.current?.offsetWidth ?? 0);
   update();
   const observer = new ResizeObserver(update);
   observer.observe(dockRef.current);
   return () => observer.disconnect();
 }, []);

 // FIX FAB-FOCUS: menu role=menu kini menerima fokus keyboard — item
 // pertama difokuskan saat buka, fokus kembali ke FAB saat tutup
 // (guard wasOpenRef supaya tidak mencuri fokus saat mount awal).
 // TASK 60-a #4a (temuan 59-b1): menu kini patuh pola WAI-ARIA Menu penuh
 // — SATU handler terpadu (menggabungkan listener Escape lama + efek
 // FIX FAB-FOCUS, tanpa handler dobel): Escape menutup; Tab/Shift+Tab
 // BERPUTAR di antara item menu (focus trap — konten di belakang
 // backdrop tidak menerima fokus keyboard); ArrowDown/ArrowUp/Home/End
 // memindahkan fokus antar role="menuitem" (roving focus pola APG).
 const menuRef = useRef<HTMLDivElement | null>(null);
 const fabBtnRef = useRef<HTMLButtonElement | null>(null);
 const wasOpenRef = useRef(false);
 useEffect(() => {
   if (!fabOpen) {
     if (wasOpenRef.current) {
       wasOpenRef.current = false;
       fabBtnRef.current?.focus();
     }
     return;
   }
   wasOpenRef.current = true;
   const items = () =>
     Array.from(
       menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [],
     );
   items()[0]?.focus();
   const onKey = (e: KeyboardEvent) => {
     if (e.key === 'Escape') {
       setFabOpen(false);
       return;
     }
     const list = items();
     if (list.length === 0) return;
     const idx = list.findIndex((el) => el === document.activeElement);
     if (e.key === 'Tab') {
       // Trap: berputar di antara item menu saja (preventDefault — tanpa
       // ini Tab melompat ke tombol dock di belakang backdrop dim).
       e.preventDefault();
       const nextIdx = e.shiftKey
         ? idx <= 0
           ? list.length - 1
           : idx - 1
         : idx < 0 || idx >= list.length - 1
           ? 0
           : idx + 1;
       list[nextIdx]?.focus();
       return;
     }
     let next = -1;
     if (e.key === 'ArrowDown') next = idx < 0 ? 0 : (idx + 1) % list.length;
     else if (e.key === 'ArrowUp') next = idx < 0 ? list.length - 1 : (idx - 1 + list.length) % list.length;
     else if (e.key === 'Home') next = 0;
     else if (e.key === 'End') next = list.length - 1;
     else return;
     e.preventDefault();
     list[next]?.focus();
   };
   window.addEventListener('keydown', onKey);
   return () => window.removeEventListener('keydown', onKey);
 }, [fabOpen]);

 // Liquid indicator geometry. GPU-friendly: fixed width per tab +
 // translateX transition with a spring (overshoot) easing curve.
 const metrics = dockTabMetrics(activeTab);
 const indVisible = metrics !== undefined && dockW > 0;
 const indX = metrics ? metrics.left * dockW + IND_INSET : 0;
 const indW = metrics ? Math.max(0, metrics.width * dockW - IND_INSET * 2) : 0;

 const renderTab = (item: { id: TabId; label: string; icon: React.ElementType }) => {
   const Icon = item.icon;
   const isActive = activeTab === item.id;
   return (
     <button
       key={item.id}
       onClick={() => onNavClick(item.id)}
       aria-label={item.label}
       aria-current={isActive ? 'page' : undefined}
       className={cn(
         'relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px]',
         'whitespace-nowrap',
         'transition-transform duration-150 motion-reduce:transition-none active:scale-[0.94]',
         'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70',
         'focus-visible:ring-offset-1 focus-visible:rounded-2xl'
       )}
     >
       <span
         aria-hidden="true"
         className={cn('grid place-items-center', isActive && 'anim-nav-icon-pop')}
       >
         <Icon
           className={cn(
             'h-[21px] w-[21px] shrink-0 transition-colors duration-300 motion-reduce:transition-none',
             isActive
               ? 'text-white drop-shadow-[0_1px_1px_rgba(0,66,55,0.25)]'
               : 'text-slate-500 dark:text-slate-400'
           )}
           strokeWidth={isActive ? 2.4 : 1.7}
         />
       </span>
       <span
         className={cn(
           'premium-dock-label transition-colors duration-300 motion-reduce:transition-none',
           isActive
             ? 'font-bold text-white'
             : 'font-medium text-slate-500 dark:text-slate-400'
         )}
       >
         {item.label}
       </span>
     </button>
   );
 };

 return (
   <div
     {...(inertBehindDrawer ? { inert: true } : {})}
     className="fixed bottom-0 inset-x-0 z-40 md:hidden"
   >
     {/* Dimmed backdrop while the quick-add popup is open — tap to close.
         Rendered OUTSIDE the animated nav element (no transformed
         ancestor) so position:fixed is always viewport-correct. */}
     {fabOpen && (
       <div
         className="fixed inset-0 z-30 bg-slate-950/25 dark:bg-black/40 backdrop-blur-[2px] anim-fab-backdrop"
         onClick={() => setFabOpen(false)}
         aria-hidden="true"
       />
     )}

     <nav
       ref={dockRef}
       aria-label="Navigasi utama"
       className={cn(
         'relative z-40 mx-3 mb-[calc(env(safe-area-inset-bottom)+10px)]',
         'anim-nav-dock-enter',
         'rounded-[26px]',
         'bg-white/80 dark:bg-slate-900/80',
         'backdrop-blur-2xl backdrop-saturate-150',
         'border border-slate-900/[0.07] dark:border-white/10',
         'premium-dock-shadow'
       )}
       style={{ height: DOCK_H }}
     >
       {/* Glass hairline highlight along the top edge (light refraction) */}
       <div
         aria-hidden="true"
         className="absolute inset-x-[16px] top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/15 pointer-events-none"
       />

       {/* Liquid gradient indicator — slides between tabs, passes behind
           the FAB (z-0 vs z-20). */}
       <div
         aria-hidden="true"
         className="nav-liquid-indicator absolute left-0 top-[7px] z-0 rounded-full"
         style={{
           height: DOCK_H - 14,
           width: indW,
           transform: `translateX(${indX}px)`,
           opacity: indVisible ? 1 : 0,
         }}
       />

       {/* Soft teal halo behind the FAB — glows through the glass dock */}
       <div
         aria-hidden="true"
         className="absolute left-1/2 -top-[46px] -translate-x-1/2 w-[104px] h-[104px] rounded-full bg-teal-400/20 dark:bg-teal-400/25 blur-3xl pointer-events-none"
       />

       {/* Tab groups — 40% each side; the center 20% is the FAB zone
           (BUGHUNT-54 3-d #4/#9a: zona tengah ±59px @320px ≥ FAB 56px;
           geometri indikator tetap data-driven via dockTabMetrics()). */}
       <div className="absolute left-0 top-0 h-full flex items-stretch" style={{ width: `${DOCK_SIDE * 100}%` }}>
         {NAV_LEFT_ITEMS.map(renderTab)}
       </div>
       <div className="absolute right-0 top-0 h-full flex items-stretch" style={{ width: `${DOCK_SIDE * 100}%` }}>
         {NAV_RIGHT_ITEMS.map(renderTab)}
       </div>

       {/* Quick-add popup — frosted glass card, spring-staggered items.
           bottom is nav-relative: dock height + FAB protrusion + 10px gap
           (the nav already sits above the safe-area inset). */}
       {fabOpen && (
         <div
           role="menu"
           aria-label="Menu tambah cepat"
           ref={menuRef}
           className="absolute left-1/2 -translate-x-1/2 z-40 w-[212px] rounded-[22px] bg-white/90 dark:bg-slate-800/90 backdrop-blur-2xl backdrop-saturate-150 border border-slate-900/[0.07] dark:border-white/10 premium-pop-shadow p-2"
           style={{ bottom: DOCK_H + FAB_PROTRUDE + 10 }}
           onClick={(e) => e.stopPropagation()}
         >
           {/* Tail pointer aimed at the FAB */}
           <div
             aria-hidden="true"
             className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 rounded-[3px] bg-white/90 dark:bg-slate-800/90 backdrop-blur-2xl border-b border-r border-slate-900/[0.07] dark:border-white/10"
           />
           {/* TASK 45: microcopy personal (bukan label utilitas) + Habit
               Baru diurutan pertama — habit adalah jantung aplikasi. */}
           <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500">
             Mau catat apa?
           </p>

           <button
             role="menuitem"
             className="anim-fab-item anim-fab-item-1 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
             onClick={() => { triggerQuickAdd('habit', activeTab); onNavClick('settings'); setFabOpen(false); }}
           >
             <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_4px_10px_-2px_rgba(245,158,11,0.5)]">
               <Sprout className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
             </span>
             <span className="min-w-0">
               <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Habit Baru</span>
               <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Satu rutinitas kecil</span>
             </span>
           </button>

           <button
             role="menuitem"
             className="anim-fab-item anim-fab-item-2 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
             // BUGHUNT-ROUND2 FAB-1: was just onNavClick('finance') — the
             // dialog never opened. The quick-add action makes the
             // Finance tab open the expense dialog after mounting.
             onClick={() => { triggerQuickAdd('expense'); onNavClick('finance'); setFabOpen(false); }}
           >
             <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow-[0_4px_10px_-2px_rgba(244,63,94,0.5)]">
               <ArrowDownRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
             </span>
             <span className="min-w-0">
               <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Pengeluaran</span>
               <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Catat pengeluaran</span>
             </span>
           </button>

           <button
             role="menuitem"
             className="anim-fab-item anim-fab-item-3 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
             onClick={() => { triggerQuickAdd('income'); onNavClick('finance'); setFabOpen(false); }}
           >
             <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 shadow-[0_4px_10px_-2px_rgba(16,185,129,0.5)]">
               <ArrowUpRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
             </span>
             <span className="min-w-0">
               <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Pemasukan</span>
               <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Catat pemasukan</span>
             </span>
           </button>

           <button
             role="menuitem"
             className="anim-fab-item anim-fab-item-4 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
             // TASK 45: Tugas Kerja — aksi 'task' baru; Meja Kerja membuka
             // editor tugas kosong saat mount (pola consume-and-clear).
             onClick={() => { triggerQuickAdd('task'); onNavClick('work'); setFabOpen(false); }}
           >
             <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-teal-500 shadow-[0_4px_10px_-2px_rgba(14,165,233,0.45)]">
               <ClipboardList className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
             </span>
             <span className="min-w-0">
               <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Tugas Kerja</span>
               <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Tambah tugas di Meja Kerja</span>
             </span>
           </button>

           <button
             role="menuitem"
             className="anim-fab-item anim-fab-item-5 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
             // ONE-CLICK-2: Transfer quick-add. Opens the transfer dialog on
             // the finance overview sub-tab (SourceBalance consumes the
             // 'transfer' action). Previously the transfer feature was
             // buried: Finance → Ringkasan → scroll to bottom → "Transfer".
             onClick={() => { triggerQuickAdd('transfer'); openFinanceSubTab('overview'); setFabOpen(false); }}
           >
             <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 shadow-[0_4px_10px_-2px_rgba(139,92,246,0.5)]">
               <ArrowLeftRight className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
             </span>
             <span className="min-w-0">
               <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Transfer</span>
               <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Pindahkan antar dompet</span>
             </span>
           </button>
         </div>
       )}

       {/* FAB — half-socketed into the dock, protruding above the edge */}
       <div
         className="absolute left-1/2 z-20 -translate-x-1/2"
         style={{ top: -FAB_PROTRUDE }}
       >
         <button
           ref={fabBtnRef}
           onClick={() => setFabOpen(!fabOpen)}
           aria-label={fabOpen ? 'Tutup menu tambah cepat' : 'Tambah cepat'}
           aria-haspopup="menu"
           aria-expanded={fabOpen}
           className={cn(
             'relative grid place-items-center rounded-full',
             'bg-gradient-to-br from-primary via-primary/85 to-emerald-500',
             'premium-fab-shadow',
             // Socket illusion: the ring approximates the dock bg color so
             // the FAB looks punched through the frosted glass.
             'ring-[4px] ring-white/80 dark:ring-slate-900/90',
             'transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
             'active:scale-90 motion-reduce:transition-none',
             fabOpen && 'rotate-45'
           )}
           style={{ width: FAB_SIZE, height: FAB_SIZE }}
         >
           {/* Inner sheen — subtle 3D glass-metal feel */}
           <span
             aria-hidden="true"
             className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 via-transparent to-black/10 pointer-events-none"
           />
           {/* Plus rotated 45° = X when open (clean swap-free close icon) */}
           <Plus className="h-6 w-6 text-white drop-shadow-[0_1px_2px_rgba(0,66,55,0.35)]" strokeWidth={2.5} />
         </button>
       </div>
     </nav>
   </div>
 );
}

