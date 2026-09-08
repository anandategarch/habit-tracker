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
  X,
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

// FLUTTER PATTERN: Bottom nav = 2 left + FAB center + 2 right.
// NAV_LEFT_ITEMS + NAV_RIGHT_ITEMS defined in FlutterBottomNav below.
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
  // non-WIB timezones. We compute the initial value lazily on the client.
  const [dateString, setDateString] = useState(() =>
    typeof window !== 'undefined'
      ? new Date(`${jakartaDateString()}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : ''
  );

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
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = () => {
      if (window.innerWidth >= 768) setSidebarOpen(true);
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
            'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-6',
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
        <ParallaxBackground className="bg-gradient-to-b from-primary/5 via-background to-background" />

        {/* Mobile dark overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - fixed position, slides in/out */}
        <aside
          className={cn(
            'fixed top-0 left-0 z-50 h-dvh w-64 bg-card border-r border-border flex flex-col',
            'transition-transform duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="font-bold text-sm leading-tight tracking-tight">Rutina</span>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-2 custom-scrollbar">
            <nav className="px-2 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary-foreground')} />
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
          {/* Top bar */}
          <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-md border-b border-border flex items-center px-4 md:px-6 gap-3">
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
              doesn't get hidden behind the fixed bottom navigation bar.
              Uses pb-28 (112px) to accommodate the morph-bump nav which
              is taller than the previous flat nav (active tab bumps up).

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
            className="flex-1 min-h-0 p-4 md:p-6 overscroll-y-contain pb-[calc(86px+env(safe-area-inset-bottom))] md:pb-6"
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

        {/* ── Mobile bottom navigation (Flutter BottomAppBar + FAB style) ────
            Design: 2 tabs left + FAB center (fixed notch) + 2 tabs right.
            FAB = quick-add button (popup: Pengeluaran/Pemasukan/Habit).
            Notch FIXED di center. Active tab = teal + filled icon + pill bg. */}
        <FlutterBottomNav
          activeTab={activeTab}
          onNavClick={handleNavClick}
        />
      </div>
    </TooltipProvider>
  );
}


// ── FlutterBottomNav ───────────────────────────────────────────────────
// Flutter BottomAppBar + FAB style: 2 tabs left + FAB center (fixed notch)
// + 2 tabs right. FAB = quick-add popup. Notch FIXED di center.
// Active tab = teal color + filled icon + pill background.
// Mobile-only (md:hidden).

const FLUTTER_NAV_HEIGHT = 76;
const FLUTTER_CORNER_R = 22;
const FLUTTER_NOTCH_R = 34; // notch top radius (FAB is 50px = 25r, gap = 9px)
const FLUTTER_NOTCH_BASE_W = 30; // flare width at base

const NAV_LEFT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'tracker', label: 'Track', icon: CheckSquare },
];

const NAV_RIGHT_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'finance', label: 'Keuangan', icon: Wallet },
  { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
];

function FlutterBottomNav({
  activeTab,
  onNavClick,
}: {
  activeTab: TabId;
  onNavClick: (id: TabId) => void;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const [navWidth, setNavWidth] = useState(388);
  const [fabOpen, setFabOpen] = useState(false);

  useLayoutEffect(() => {
    if (!navRef.current) return;
    const update = () => setNavWidth(navRef.current?.offsetWidth ?? 388);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, []);

  // Close FAB popup on outside tap
  useEffect(() => {
    if (!fabOpen) return;
    const handler = () => setFabOpen(false);
    const timer = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [fabOpen]);

  // Fixed center notch — always at navWidth/2
  const W = navWidth;
  const H = FLUTTER_NAV_HEIGHT;
  const cR = FLUTTER_CORNER_R;
  const nR = FLUTTER_NOTCH_R;
  const nB = FLUTTER_NOTCH_BASE_W;
  const nX = W / 2; // FIXED center
  const baseDepth = nR * 0.6;
  const bumpHeight = nR;

  const path = [
    `M ${cR} 0`,
    `L ${nX - nR} 0`,
    `C ${nX - nR} ${baseDepth} ${nX - nR - nB} ${-bumpHeight * 0.3} ${nX} ${-bumpHeight}`,
    `C ${nX + nR + nB} ${-bumpHeight * 0.3} ${nX + nR} ${baseDepth} ${nX + nR} 0`,
    `L ${W - cR} 0`,
    `A ${cR} ${cR} 0 0 1 ${W} ${cR}`,
    `L ${W} ${H}`,
    `L 0 ${H}`,
    `L 0 ${cR}`,
    `A ${cR} ${cR} 0 0 1 ${cR} 0`,
    'Z',
  ].join(' ');

  const clipPathValue = `path('${path}')`;

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
          'flex-1 flex flex-col items-center justify-center gap-0.5 relative',
          'transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:rounded-2xl',
          'motion-reduce:transition-none'
        )}
      >
        {/* Active pill background */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-2 top-1 bottom-1 rounded-xl transition-opacity duration-200',
            isActive ? 'bg-teal-500/10 opacity-100' : 'opacity-0'
          )}
        />
        <Icon
          className={cn(
            'h-[22px] w-[22px] shrink-0 relative z-10 transition-all duration-200 motion-reduce:transition-none',
            isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
          )}
          strokeWidth={isActive ? 2.5 : 1.5}
        />
        <span
          className={cn(
            'text-[11px] leading-none relative z-10 transition-colors duration-200 motion-reduce:transition-none',
            isActive
              ? 'font-semibold text-teal-600 dark:text-teal-400'
              : 'font-medium text-slate-500 dark:text-slate-400'
          )}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      ref={navRef}
      aria-label="Primary mobile navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 md:hidden',
        'bottom-[env(safe-area-inset-bottom)]',
        'w-full',
        'h-[76px]',
        'shadow-[0_-2px_8px_rgba(0,0,0,0.04),0_-1px_0_rgba(0,0,0,0.06)]'
      )}
    >
      {/* Solid background — clipped to notched shape */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          clipPath: clipPathValue,
          WebkitClipPath: clipPathValue,
          background: 'rgb(255, 255, 255)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden dark:block"
        style={{
          clipPath: clipPathValue,
          WebkitClipPath: clipPathValue,
          background: 'rgb(15, 23, 42)',
        }}
      />
      {/* Border */}
      <svg
        width={W}
        height={H}
        viewBox={`${-2} ${-bumpHeight - 2} ${W + 4} ${H + bumpHeight + 4}`}
        className="absolute inset-0 pointer-events-none overflow-visible"
        fill="none"
      >
        <path d={path} stroke="rgb(226, 232, 240)" strokeWidth="1" />
      </svg>

      {/* Left tabs */}
      <div className="absolute left-0 top-0 h-full flex items-stretch" style={{ width: '37.5%' }}>
        {NAV_LEFT_ITEMS.map(renderTab)}
      </div>

      {/* Right tabs */}
      <div className="absolute right-0 top-0 h-full flex items-stretch" style={{ width: '37.5%' }}>
        {NAV_RIGHT_ITEMS.map(renderTab)}
      </div>

      {/* FAB popup menu */}
      {fabOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-40"
          style={{ bottom: '70px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 min-w-[160px] anim-tab-enter">
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              onClick={() => { onNavClick('finance'); setFabOpen(false); }}
            >
              <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Pengeluaran</p>
                <p className="text-[10px] text-slate-500">Catat pengeluaran</p>
              </div>
            </button>
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              onClick={() => { onNavClick('finance'); setFabOpen(false); }}
            >
              <div className="w-8 h-8 rounded-full bg-teal-500/15 flex items-center justify-center shrink-0">
                <ArrowUpRight className="h-4 w-4 text-teal-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Pemasukan</p>
                <p className="text-[10px] text-slate-500">Catat pemasukan</p>
              </div>
            </button>
            <button
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              onClick={() => { onNavClick('tracker'); setFabOpen(false); }}
            >
              <div className="w-8 h-8 rounded-full bg-teal-500/15 flex items-center justify-center shrink-0">
                <CheckSquare className="h-4 w-4 text-teal-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Habit Baru</p>
                <p className="text-[10px] text-slate-500">Tambah habit</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* FAB — fixed center, protrudes above nav */}
      <div
        className="absolute left-1/2 z-20"
        style={{
          top: 0,
          transform: 'translateX(-50%) translateY(-40%)',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFabOpen(!fabOpen);
          }}
          aria-label="Tambah cepat"
          className={cn(
            'w-[50px] h-[50px] rounded-full',
            'bg-gradient-to-br from-teal-400 to-teal-600',
            'shadow-[0_4px_16px_rgba(20,184,166,0.25)]',
            'ring-1 ring-inset ring-white/20',
            'flex items-center justify-center',
            'transition-transform duration-200',
            'active:scale-90',
            'motion-reduce:transition-none',
            fabOpen && 'rotate-45'
          )}
        >
          {fabOpen ? (
            <X className="h-6 w-6 text-white" strokeWidth={2.5} />
          ) : (
            <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </nav>
  );
}
