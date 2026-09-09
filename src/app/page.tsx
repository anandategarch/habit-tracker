'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type TabId } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
 LayoutDashboard,
 CheckSquare,
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
} from 'lucide-react';
import { jakartaDateString } from '@/lib/jakarta-date';

import dynamic from 'next/dynamic';
import { PageTransition, ParallaxBackground } from '@/components/habit-tracker/page-transition';
import { PullToRefresh } from '@/components/habit-tracker/pull-to-refresh';
import { SproutGrow } from '@/components/ui/loaders';

// FIX-TRANSITION-1: Each tab is dynamically imported (ssr: false) to keep the
// initial bundle small + avoid SSR for components that use browser-only APIs.
// Previously these had NO `loading` fallback — when the user switched to a
// tab whose chunk wasn't yet loaded, the dynamic component returned `null`
// during the ~300ms chunk-fetch/parse window, producing a blank white screen
// ("transisi antar tab hanya putih aja").
//
// Now each dynamic() provides a `loading` render-prop that shows SproutGrow
// (same pohon animation as splash screen) for consistent branding across
// app load + tab transitions. The loader mounts immediately when the dynamic
// wrapper renders, then swaps out atomically once the chunk resolves — no
// blank frame in between. The PageTransition's motion.div still animates the
// surrounding fade, so the loader itself enters with the same fade-in.
//
// FEAT-SPROUT-NAV: SproutGrow digunakan untuk tab loading juga (bukan hanya
// splash screen) supaya consistent branding — user lihat pohon grow setiap
// kali pindah tab, bukan AuroraRing generic.
const tabLoading = () => (
 <div className="flex flex-col items-center justify-center gap-3 py-8">
   <SproutGrow size={80} />
   <p className="text-xs text-muted-foreground">Memuat...</p>
 </div>
);

const Dashboard = dynamic(() => import('@/components/habit-tracker/dashboard'), { ssr: false, loading: tabLoading });
const DailyTracker = dynamic(() => import('@/components/habit-tracker/daily-tracker'), { ssr: false, loading: tabLoading });
const Goals = dynamic(() => import('@/components/habit-tracker/goals'), { ssr: false, loading: tabLoading });

const Finance = dynamic(() => import('@/components/habit-tracker/finance'), { ssr: false, loading: tabLoading });
const SettingsTab = dynamic(() => import('@/components/habit-tracker/settings'), { ssr: false, loading: tabLoading });

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
 { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'tracker', label: 'Tracker Harian', icon: CheckSquare },
 { id: 'goals', label: 'Tujuan', icon: Target },

 { id: 'finance', label: 'Keuangan', icon: Wallet },
 { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
];

// PREMIUM DOCK PATTERN: Bottom nav = 2 left + FAB center + 2 right.
// NAV_LEFT_ITEMS + NAV_RIGHT_ITEMS defined in PremiumBottomNav below.
// Goals accessible via sidebar drawer (hamburger menu).

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
 dashboard: Dashboard,
 tracker: DailyTracker,
 goals: Goals,

 finance: Finance,
 settings: SettingsTab,
};

// BUGHUNT-OTHER-1 BUG-M14: lookup set for validating the `?tab=` query param.
const VALID_TAB_IDS = new Set<string>([
 'dashboard', 'tracker', 'goals',
 'finance', 'settings',
]);

export default function Home() {
 const activeTab = useAppStore(s => s.activeTab);
 const setActiveTab = useAppStore(s => s.setActiveTab);
 const sidebarOpen = useAppStore(s => s.sidebarOpen);
 const setSidebarOpen = useAppStore(s => s.setSidebarOpen);
 const triggerRefresh = useAppStore(s => s.triggerRefresh);
 const triggerQuickAdd = useAppStore(s => s.triggerQuickAdd);
 const queryClient = useQueryClient();

 // Splash screen on initial app load — shows SproutGrow loader for 2.6s
 // while dynamic imports + React Query fetch data. Makes first load feel
 // premium + branded (sprout theme) instead of blank white flash.
 // FEAT-SPLASH-REVEAL: Exit animation (fade + scale + slide up) instead of
 // hard cut. Uses splashExiting state to delay unmount until animation completes.
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
     // Unmount after exit animation completes (600ms)
     unmountTimer = setTimeout(() => setShowSplash(false), 600);
   }, 2600);
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
 const handleRefresh = useCallback(async () => {
   await Promise.all([
     queryClient.invalidateQueries(),
     Promise.resolve(triggerRefresh()),
   ]);
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

 // BUGHUNT-OTHER-1 BUG-M14: deep-link `?tab=` from URL on first mount.
 // This makes tabs shareable and survives reload. The replaceState below
 // also updates the URL whenever the user changes tabs (without breaking
 // the back button — we use replace, not push).
 // Intentionally run once on mount — we don't want to override the
 // store when the URL changes via setActiveTab's replaceState.
 useEffect(() => {
   if (typeof window === 'undefined') return;
   const params = new URLSearchParams(window.location.search);
   const tab = params.get('tab');
   if (tab && VALID_TAB_IDS.has(tab) && tab !== activeTab) {
     setActiveTab(tab as TabId);
   }
 }, []);

 // Sync activeTab → URL (replaceState so back button still works).
 useEffect(() => {
   if (typeof window === 'undefined') return;
   const url = new URL(window.location.href);
   if (activeTab === 'dashboard') {
     url.searchParams.delete('tab'); // keep URLs clean for the default tab
   } else {
     url.searchParams.set('tab', activeTab);
   }
   window.history.replaceState(null, '', url.toString());
 }, [activeTab]);

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
 useEffect(() => {
   if (typeof window === 'undefined') return;
   const apply = () => {
     setSidebarOpen(window.innerWidth >= 768);
   };
   apply();
   window.addEventListener('resize', apply);
   return () => window.removeEventListener('resize', apply);
 }, [setSidebarOpen]);

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
   <TooltipProvider delayDuration={300}>
     {/* Splash screen — SproutGrow loader on initial app load (2.6s).
         Premium branded loading experience instead of blank white flash.
         FEAT-SPLASH-REVEAL: Splash has exit animation (fade + scale + slide up)
         instead of hard cut. Content underneath has entrance animation
         (fade + slide up) for smooth transition. Inspired by motion-splash repo. */}
     {showSplash && (
       <div
         className={cn(
           'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background app-ambience gap-6',
           splashExiting ? 'anim-splash-exit' : 'anim-splash-enter'
         )}
         key="splash"
       >
         <SproutGrow size={140} />
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
           PREMIUM-UI: glass panel + gradient logo + active pill gradien. */}
       <aside
         className={cn(
           'fixed top-0 left-0 z-50 h-dvh w-64 flex flex-col',
           'bg-card/95 backdrop-blur-xl border-r border-border',
           'transition-transform duration-300 ease-in-out',
           sidebarOpen ? 'translate-x-0' : '-translate-x-full'
         )}
       >
         {/* Logo */}
         <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
           <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white premium-fab-shadow">
             <Sprout className="h-5 w-5" strokeWidth={2.2} />
           </div>
           <div className="leading-tight">
             <span className="font-bold text-sm tracking-tight">Rutina</span>
             <p className="text-[10px] text-muted-foreground/70">Habit & Keuangan</p>
           </div>
         </div>

         {/* Navigation */}
         <ScrollArea className="flex-1 py-3 custom-scrollbar">
           <nav className="px-2.5 space-y-1">
             {NAV_ITEMS.map((item) => {
               const Icon = item.icon;
               const isActive = activeTab === item.id;
               return (
                 <button
                   key={item.id}
                   onClick={() => handleNavClick(item.id)}
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
           <h1 className="text-lg font-semibold">
             {NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard'}
           </h1>
           <div className="ml-auto text-xs text-muted-foreground hidden xs:block sm:block" suppressHydrationWarning>
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
       />
     </div>
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
// FIX DOCK-1: semua 5 tab kini ADA di dock (dulu `goals` cuma di sidebar
// desktop → di mobile Tujuan TIDAK BISA dijangkau sama sekali). Sisi kiri 3
// tab + FAB di tengah + sisi kanan 2 tab.
const DOCK_SIDE = 0.43; // width share of each tab group (left/right)
const IND_INSET = 3; // indicator horizontal inset inside a tab
const FAB_SIZE = 56; // FAB diameter (px)
const FAB_PROTRUDE = 22; // px of FAB protruding above the dock top edge

const NAV_LEFT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
 { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
 { id: 'tracker', label: 'Tracker', icon: CheckSquare },
 { id: 'goals', label: 'Tujuan', icon: Target },
];

const NAV_RIGHT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
 { id: 'finance', label: 'Keuangan', icon: Wallet },
 { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
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
}: {
 activeTab: TabId;
 onNavClick: (id: TabId) => void;
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

 // Close popup on Escape (a11y parity with the tap-to-close backdrop).
 useEffect(() => {
   if (!fabOpen) return;
   const onKey = (e: KeyboardEvent) => {
     if (e.key === 'Escape') setFabOpen(false);
   };
   window.addEventListener('keydown', onKey);
   return () => window.removeEventListener('keydown', onKey);
 }, [fabOpen]);

 // FIX FAB-FOCUS: menu role=menu kini menerima fokus keyboard — item
 // pertama difokuskan saat buka, fokus kembali ke FAB saat tutup
 // (guard wasOpenRef supaya tidak mencuri fokus saat mount awal).
 const menuRef = useRef<HTMLDivElement | null>(null);
 const fabBtnRef = useRef<HTMLButtonElement | null>(null);
 const wasOpenRef = useRef(false);
 useEffect(() => {
   if (fabOpen) {
     wasOpenRef.current = true;
     const first = menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]');
     first?.focus();
   } else if (wasOpenRef.current) {
     wasOpenRef.current = false;
     fabBtnRef.current?.focus();
   }
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
   <div className="fixed bottom-0 inset-x-0 z-40 md:hidden">
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

       {/* Tab groups — 37.5% each side; the center 25% is the FAB zone */}
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
           <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500">
             Tambah Cepat
           </p>

           <button
             role="menuitem"
             className="anim-fab-item anim-fab-item-1 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
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
             className="anim-fab-item anim-fab-item-2 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
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
             className="anim-fab-item anim-fab-item-3 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
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

           <button
             role="menuitem"
             className="anim-fab-item anim-fab-item-4 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-slate-900/[0.05] dark:hover:bg-white/10 active:scale-[0.97]"
             // "Habit Baru" — the add-habit form lives in Settings →
             // Habit Master. Navigate there and let HabitMaster open its
             // dialog via the same quick-add trigger.
             onClick={() => { triggerQuickAdd('habit'); onNavClick('settings'); setFabOpen(false); }}
           >
             <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_4px_10px_-2px_rgba(245,158,11,0.5)]">
               <Sprout className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
             </span>
             <span className="min-w-0">
               <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Habit Baru</span>
               <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">Tambah habit baru</span>
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
             'bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500',
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

