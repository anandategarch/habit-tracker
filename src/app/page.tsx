'use client';

import { useCallback, useEffect, useState } from 'react';
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
  CalendarDays,
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

const Dashboard = dynamic(() => import('@/components/habit-tracker/dashboard'), { ssr: false });
const DailyTracker = dynamic(() => import('@/components/habit-tracker/daily-tracker'), { ssr: false });
const CalendarView = dynamic(() => import('@/components/habit-tracker/calendar-view'), { ssr: false });
const Goals = dynamic(() => import('@/components/habit-tracker/goals'), { ssr: false });

const Finance = dynamic(() => import('@/components/habit-tracker/finance'), { ssr: false });
const SettingsTab = dynamic(() => import('@/components/habit-tracker/settings'), { ssr: false });

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tracker', label: 'Daily Tracker', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'goals', label: 'Goals', icon: Target },

  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

// Primary tabs shown in the mobile bottom navigation bar.
// Other tabs (Calendar, Goals, Challenges, Rewards, Badges) remain
// accessible via the hamburger sidebar drawer on mobile.
const BOTTOM_NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'tracker', label: 'Track', icon: CheckSquare },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  dashboard: Dashboard,
  tracker: DailyTracker,
  calendar: CalendarView,
  goals: Goals,

  finance: Finance,
  settings: SettingsTab,
};

// BUGHUNT-OTHER-1 BUG-M14: lookup set for validating the `?tab=` query param.
const VALID_TAB_IDS = new Set<string>([
  'dashboard', 'tracker', 'calendar', 'goals',
  'finance', 'settings',
]);

export default function Home() {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();

  // Splash screen on initial app load — shows SproutGrow loader for 1.5s
  // while dynamic imports + React Query fetch data. Makes first load feel
  // premium + branded (sprout theme) instead of blank white flash.
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
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
      ? new Date(`${jakartaDateString()}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : ''
  );

  // Refresh date string every minute so it stays accurate past midnight
  // (Jakarta midnight, not browser-local midnight).
  useEffect(() => {
    const update = () => {
      setDateString(
        new Date(`${jakartaDateString()}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
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
      {/* Splash screen — SproutGrow loader on initial app load (1.5s).
          Premium branded loading experience instead of blank white flash. */}
      {showSplash && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-6">
          <SproutGrow size={140} />
          <div className="text-center">
            <p className="text-lg font-semibold text-primary tracking-tight">Rutina</p>
            <p className="text-xs text-muted-foreground mt-1">Menumbuhkan habit harian</p>
          </div>
        </div>
      )}
      <div className="min-h-dvh flex bg-background">
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

        {/* Main content - shifts right on desktop when sidebar is open */}
        <main
          className={cn(
            'flex-1 min-w-0 flex flex-col transition-[margin] duration-300 ease-in-out',
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
                  aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                >
                  {sidebarOpen
                    ? <PanelLeftClose className="h-5 w-5" />
                    : <PanelLeftOpen className="h-5 w-5" />
                  }
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
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

              ANIM-3 / Feature 5: PullToRefresh wraps the content area.
              On touch devices, the user can pull down at the top of the
              scroll area to trigger a full data refresh (a 🌱 sprout
              grows as they pull, then spins while refreshing). On
              desktop (no touch), it's a pass-through wrapper — no
              behaviour change. */}
          <PullToRefresh
            className="flex-1 p-4 md:p-6 overflow-auto pb-28 md:pb-6"
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

        {/* ── Mobile bottom navigation (Morph Bump style) ────────────────────
            Fixed at the bottom on mobile only (md:hidden).
            Design: Material You morph-bump — active tab's icon lifts up
            inside a gradient circle that emerges from the nav bar, giving
            a 3D depth effect. Inactive tabs stay flat with muted icons.
            Respects iOS safe-area inset for the home indicator. */}
        <nav
          aria-label="Primary mobile navigation"
          className={cn(
            'fixed bottom-0 left-0 right-0 z-30 md:hidden',
            'bg-background/95 backdrop-blur-md border-t border-border',
            'pb-[env(safe-area-inset-bottom)]'
          )}
        >
          <div className="flex items-stretch justify-around h-[68px] relative">
            {BOTTOM_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-end pb-2 relative',
                    'transition-all duration-200 active:scale-90',
                    'min-h-[68px]'
                  )}
                >
                  {/* Morph bump circle — gradient background that emerges
                      when active. Always rendered for smooth morph animation.
                      Uses scale + translateY for the bump-up effect.
                      CSS-AUDIT-1: `bg-primary` provides a SOLID-COLOR FALLBACK
                      for browsers that don't support the `linear-gradient(... in oklab, ...)`
                      interpolation syntax (Chrome < 111). Without it, the gradient
                      is invalid → bump circle is invisible → user sees flat nav.
                      background-color sits BELOW background-image, so on modern
                      browsers the gradient covers the solid color (no visual
                      change), but on old browsers the solid color shows through. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-2 left-1/2 -translate-x-1/2',
                      'w-12 h-12 rounded-full',
                      'bg-primary bg-gradient-to-br from-primary to-primary/85',
                      'shadow-lg shadow-primary/30',
                      'transition-all duration-300 ease-out',
                      'anim-nav-bump',
                      isActive
                        ? 'opacity-100 scale-100 -translate-y-3'
                        : 'opacity-0 scale-50 translate-y-0'
                    )}
                  />
                  {/* Top accent dot — small highlight on active circle */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-2 left-1/2 -translate-x-1/2',
                      'w-1.5 h-1.5 rounded-full bg-primary-foreground/40',
                      'transition-all duration-300 ease-out',
                      isActive ? 'opacity-100 -translate-y-1' : 'opacity-0'
                    )}
                  />
                  {/* Icon — lifts up with the bump when active, stays flat otherwise */}
                  <Icon
                    className={cn(
                      'shrink-0 relative z-10 transition-all duration-300 ease-out',
                      isActive
                        ? 'h-5 w-5 -translate-y-3.5 text-primary-foreground'
                        : 'h-5 w-5 translate-y-0 text-muted-foreground'
                    )}
                  />
                  {/* Label — always visible; active label uses primary color */}
                  <span
                    className={cn(
                      'text-[10px] font-medium leading-none mt-1.5 transition-all duration-300',
                      isActive
                        ? 'text-primary'
                        : 'text-muted-foreground/70'
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}