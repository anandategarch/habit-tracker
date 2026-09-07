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

// Primary tabs shown in the mobile bottom navigation bar.
// BUG-FINANCE-CAL BUG-4: the previous comment said "Other tabs (Calendar,
// Goals) remain accessible via the hamburger sidebar drawer on mobile." —
// that was stale (Calendar was merged into Tracker as the 'Riwayat' sub-tab
// in commit e5174c2). Only Goals + the four bottom-nav tabs remain in the
// sidebar drawer.
const BOTTOM_NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'tracker', label: 'Track', icon: CheckSquare },
  { id: 'finance', label: 'Keuangan', icon: Wallet },
  { id: 'settings', label: 'Pengaturan', icon: SettingsIcon },
];

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

        {/* ── Mobile bottom navigation (Notched Glassmorphism) ──────────────
            Design: Glass nav bar dengan CIRCULAR NOTCH di border yang pindah
            mengikuti tab aktif. Active button duduk DI DALAM notch (poking
            through the hole). Border melengkung mulus mengelilingi notch.

            Teknik:
            1. Glass div (backdrop-blur + bg-white/25) di-clip via clip-path
               ke notched shape → glass fill hanya terlihat di area nav shape
            2. SVG stroke (fill=none) di atas untuk border visible
            3. Active button absolutely positioned di notch center
            4. Inactive icons + labels di flexbox row

            Path dibangun dynamically dengan actual pixel width (via ref +
            ResizeObserver) supaya notch tetap perfect circle di semua screen. */}
        <NotchedBottomNav
          items={BOTTOM_NAV_ITEMS}
          activeTab={activeTab}
          onNavClick={handleNavClick}
        />
      </div>
    </TooltipProvider>
  );
}

// ── NotchedBottomNav ────────────────────────────────────────────────────
// Glass nav bar dengan circular notch di border yang pindah mengikuti tab
// aktif. Active button duduk DI DALAM notch (poking through the hole).
//
// Teknik:
// - Glass div dengan backdrop-blur, di-clip via CSS clip-path: path() ke
//   notched shape → glass fill mengikuti nav shape (termasuk notch bump)
// - SVG path (stroke only) di atas untuk border visible
// - Path dibangun dynamically dengan actual pixel width (ResizeObserver)
//   supaya notch tetap perfect circle di semua screen size
// - Active button absolutely positioned di notch center, left animated
// - clip-path tidak bisa di-transition, jadi notch snap instantly saat
//   tab ganti. Button glide smooth via CSS transition: left 0.15s

const NAV_HEIGHT = 76; // was 70 — sedikit lebih besar untuk proporsi lebih baik
const CORNER_R = 22; // top corners — proporsional dengan nav height 76
const NOTCH_R = 27; // notch radius (button is 50px = 25r, so 2px gap)

function NotchedBottomNav({
  items,
  activeTab,
  onNavClick,
}: {
  items: { id: TabId; label: string; icon: React.ElementType }[];
  activeTab: TabId;
  onNavClick: (id: TabId) => void;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const [navWidth, setNavWidth] = useState(388); // default, updated on mount

  // Measure actual nav width for responsive path computation.
  // BUGFIX POST-1 #6: use useLayoutEffect (bukan useEffect) supaya measurement
  // terjadi synchronously sebelum paint → no 1-frame SVG scale mismatch on
  // narrow viewports.
  useLayoutEffect(() => {
    if (!navRef.current) return;
    const update = () => setNavWidth(navRef.current?.offsetWidth ?? 388);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, []);

  // BUGFIX POST-1 #1: activeIndex bisa -1 saat activeTab='goals' (via sidebar
  // drawer, bukan bottom nav). Guard ke 0 supaya notch + button tidak offscreen.
  const rawActiveIndex = items.findIndex(i => i.id === activeTab);
  const activeIndex = rawActiveIndex >= 0 ? rawActiveIndex : 0;
  const tabCount = items.length;
  // Notch center X = center of the active tab slot
  // BUGFIX POST-1 #5: Clamp notchX supaya tidak overlap dengan top corners
  // (cR + nR di kiri, W - cR - nR di kanan). Tanpa clamp, di viewport <392px
  // notch menabrak corner radius → jagged edges.
  const minNotchX = CORNER_R + NOTCH_R + 2;
  const maxNotchX = navWidth - CORNER_R - NOTCH_R - 2;
  const rawNotchX = (activeIndex + 0.5) * (navWidth / tabCount);
  const notchX = Math.max(minNotchX, Math.min(maxNotchX, rawNotchX));

  // Build SVG path: rounded rect with semicircular bump UP at notch position.
  // Path goes clockwise from top-left corner.
  const W = navWidth;
  const H = NAV_HEIGHT;
  const cR = CORNER_R;
  const nR = NOTCH_R;
  const nX = notchX;

  const path = [
    `M ${cR} 0`,
    `L ${nX - nR} 0`,
    // Semicircular arc going UP (sweep=0 in SVG Y-down = counter-clockwise = upward bump)
    `A ${nR} ${nR} 0 0 0 ${nX + nR} 0`,
    `L ${W - cR} 0`,
    // Top-right corner (clockwise = outward)
    `A ${cR} ${cR} 0 0 1 ${W} ${cR}`,
    // Bottom-right: flush to screen edge — no corner radius
    `L ${W} ${H}`,
    `L 0 ${H}`,
    // Bottom-left: flush to screen edge — no corner radius
    `L 0 ${cR}`,
    // Top-left corner
    `A ${cR} ${cR} 0 0 1 ${cR} 0`,
    'Z',
  ].join(' ');

  const clipPathValue = `path('${path}')`;

  return (
    <nav
      ref={navRef}
      aria-label="Primary mobile navigation"
      className={cn(
        // Flush to bottom (no floating margin), full width (no side margin)
        'fixed bottom-0 left-0 right-0 z-30 md:hidden',
        'bottom-[env(safe-area-inset-bottom)]',
        'w-full',
        'h-[76px]', // was 70px — sedikit lebih besar
        // FIX #5: Subtle top shadow as content separator — solid bg + 1px border
        // alone nyaris tidak terlihat pemisahnya dengan content di atas. Soft
        // upward shadow creates depth without being heavy.
        'shadow-[0_-2px_8px_rgba(0,0,0,0.04),0_-1px_0_rgba(0,0,0,0.06)]'
      )}
    >
      {/* Solid background layer — no transparency, no blur. Clipped to notched
          shape via clip-path. Light mode: white. Dark mode: slate-900. */}
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
      {/* Border layer: SVG stroke (fill=none) draws the visible border
          following the notched path. Solid border color for contrast
          on solid background (no longer glass transparency). */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 pointer-events-none"
        fill="none"
      >
        <path
          d={path}
          stroke="rgb(226, 232, 240)"
          strokeWidth="1"
        />
      </svg>

      {/* Tab buttons — flexbox row, each tab gets equal space.
          The active button is absolutely positioned (not in flex flow) so
          it can sit at the exact notch center. */}
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const itemIndex = items.findIndex(i => i.id === item.id);
        return (
          <button
            key={item.id}
            onClick={() => onNavClick(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'absolute top-0 h-full flex flex-col items-center justify-end pb-2',
              'transition-colors duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50',
              'motion-reduce:transition-none'
            )}
            style={{
              left: `${(itemIndex / tabCount) * 100}%`,
              width: `${100 / tabCount}%`,
            }}
          >
            {/* Inactive icon — sedikit lebih besar (22px dari 20px) untuk
                proporsi lebih baik dengan active button 50px. Icon slot
                fixed height supaya layout konsisten. */}
            <div className="h-[22px] mb-1.5 flex items-center justify-center">
              <Icon
                className={cn(
                  'h-[22px] w-[22px] transition-opacity duration-300 motion-reduce:transition-none',
                  isActive ? 'opacity-0' : 'opacity-100',
                  'text-slate-500 dark:text-slate-400'
                )}
                strokeWidth={1.5}
              />
            </div>
            {/* Label — always visible at bottom. 11px font (WCAG AA). */}
            <span
              className={cn(
                'text-[11px] leading-none transition-colors duration-300 motion-reduce:transition-none',
                isActive
                  ? 'font-semibold text-teal-600 dark:text-teal-400'
                  : 'font-medium text-slate-500 dark:text-slate-400'
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Active floating button — 50px (was 44px, user prefer agak besar).
          Protrudes 20px above nav top (translateY -40% = 50 * 0.4 = 20).
          Icon 24px (was 20px) — proporsional dengan button 50px.
          Glow 0.25 opacity (elegant), ring-inset white/20 untuk depth.
          Transition 0.15s sync dengan notch snap. */}
      <div
        className="absolute top-0 z-20 transition-[left] duration-150 ease-out motion-reduce:transition-none"
        style={{
          left: `${((activeIndex + 0.5) / tabCount) * 100}%`,
          // translateY(-40%) = button protrudes 20px above nav (50 * 0.4 = 20)
          transform: 'translateX(-50%) translateY(-40%)',
        }}
      >
        <div
          className={cn(
            // 50px (was 44px) — agak besar, proporsional dengan nav 76px
            'w-[50px] h-[50px] rounded-full',
            'bg-gradient-to-br from-teal-400 to-teal-600',
            // Glow 0.25 opacity — elegant, tidak kitsch
            'shadow-[0_4px_16px_rgba(20,184,166,0.25)]',
            // Inner highlight untuk depth
            'ring-1 ring-inset ring-white/20',
            'flex items-center justify-center'
          )}
        >
          {(() => {
            const ActiveIcon = items[activeIndex]?.icon;
            // Icon 24px (was 20px) — proporsional dengan button 50px
            return ActiveIcon ? <ActiveIcon className="h-6 w-6 text-white" strokeWidth={2.5} /> : null;
          })()}
        </div>
      </div>
    </nav>
  );
}