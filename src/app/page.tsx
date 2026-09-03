'use client';

import { useCallback, useEffect, useState } from 'react';
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
  Trophy,
  Gift,
  Medal,
  Wallet,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Sprout,
} from 'lucide-react';
import { jakartaDateString } from '@/lib/jakarta-date';

import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/habit-tracker/dashboard'), { ssr: false });
const DailyTracker = dynamic(() => import('@/components/habit-tracker/daily-tracker'), { ssr: false });
const CalendarView = dynamic(() => import('@/components/habit-tracker/calendar-view'), { ssr: false });
const Goals = dynamic(() => import('@/components/habit-tracker/goals'), { ssr: false });
const Challenges = dynamic(() => import('@/components/habit-tracker/challenges'), { ssr: false });
const Rewards = dynamic(() => import('@/components/habit-tracker/rewards'), { ssr: false });
const Badges = dynamic(() => import('@/components/habit-tracker/badges'), { ssr: false });
const Finance = dynamic(() => import('@/components/habit-tracker/finance'), { ssr: false });
const SettingsTab = dynamic(() => import('@/components/habit-tracker/settings'), { ssr: false });

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tracker', label: 'Daily Tracker', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'badges', label: 'Badges', icon: Medal },
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
  challenges: Challenges,
  rewards: Rewards,
  badges: Badges,
  finance: Finance,
  settings: SettingsTab,
};

// BUGHUNT-OTHER-1 BUG-M14: lookup set for validating the `?tab=` query param.
const VALID_TAB_IDS = new Set<string>([
  'dashboard', 'tracker', 'calendar', 'goals', 'challenges',
  'rewards', 'badges', 'finance', 'settings',
]);

export default function Home() {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);

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
      <div className="min-h-dvh flex bg-background">
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
              doesn't get hidden behind the fixed bottom navigation bar. */}
          <div className="flex-1 p-4 md:p-6 overflow-auto pb-24 md:pb-6">
            <div key={activeTab} className="anim-tab-enter">
              <ActiveComponent />
            </div>
          </div>
        </main>

        {/* ── Mobile bottom navigation ─────────────────────────────────────
            Fixed at the bottom on mobile only (md:hidden). Provides 1-tap
            access to the 4 most-used tabs. Other tabs remain accessible
            via the hamburger sidebar drawer. Respects iOS safe-area inset
            so it doesn't overlap the home indicator on notch devices. */}
        <nav
          aria-label="Primary mobile navigation"
          className={cn(
            'fixed bottom-0 left-0 right-0 z-30 md:hidden',
            'bg-background/95 backdrop-blur-md border-t border-border',
            'flex items-stretch justify-around',
            // Padding bottom for iOS home indicator / safe-area
            'pb-[env(safe-area-inset-bottom)]'
          )}
        >
          {BOTTOM_NAV_ITEMS.map((item, navIdx) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative',
                  'transition-all duration-150 active:scale-90',
                  'min-h-[56px]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {/* Sliding active indicator — always rendered, slides via transform */}
                <span
                  className={cn(
                    'absolute inset-x-2 top-1 bottom-1 rounded-xl bg-primary/10 anim-nav-pill',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                  style={{
                    transform: isActive ? 'translateX(0)' : `translateX(${(navIdx - BOTTOM_NAV_ITEMS.findIndex(n => n.id === activeTab)) * 100}%)`,
                  }}
                />
                {/* Top accent bar — always rendered, slides with pill */}
                <span
                  className={cn(
                    'absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary anim-nav-pill',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon className={cn('h-5 w-5 shrink-0 relative z-10', isActive && 'text-primary')} />
                <span className="text-xs font-medium leading-none relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </TooltipProvider>
  );
}