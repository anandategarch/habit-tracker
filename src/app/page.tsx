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
  ListChecks,
  BarChart3,
  CalendarDays,
  BookOpen,
  Target,
  Trophy,
  Gift,
  Medal,
  Wallet,
  Calculator,
  Brain,
  Settings as SettingsIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Flame,
} from 'lucide-react';

import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/habit-tracker/dashboard'), { ssr: false });
const DailyTracker = dynamic(() => import('@/components/habit-tracker/daily-tracker'), { ssr: false });
const HabitMaster = dynamic(() => import('@/components/habit-tracker/habit-master'), { ssr: false });
const Analytics = dynamic(() => import('@/components/habit-tracker/analytics'), { ssr: false });
const CalendarView = dynamic(() => import('@/components/habit-tracker/calendar-view'), { ssr: false });
const Learning = dynamic(() => import('@/components/habit-tracker/learning'), { ssr: false });
const Goals = dynamic(() => import('@/components/habit-tracker/goals'), { ssr: false });
const Challenges = dynamic(() => import('@/components/habit-tracker/challenges'), { ssr: false });
const Rewards = dynamic(() => import('@/components/habit-tracker/rewards'), { ssr: false });
const Badges = dynamic(() => import('@/components/habit-tracker/badges'), { ssr: false });
const Finance = dynamic(() => import('@/components/habit-tracker/finance'), { ssr: false });
const Statistics = dynamic(() => import('@/components/habit-tracker/statistics'), { ssr: false });
const AIInsights = dynamic(() => import('@/components/habit-tracker/ai-insights'), { ssr: false });
const SettingsTab = dynamic(() => import('@/components/habit-tracker/settings'), { ssr: false });

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tracker', label: 'Daily Tracker', icon: CheckSquare },
  { id: 'habits', label: 'Habit Master', icon: ListChecks },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'learning', label: 'Daily Learning', icon: BookOpen },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'badges', label: 'Badges', icon: Medal },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'statistics', label: 'Statistics', icon: Calculator },
  { id: 'insights', label: 'AI Insights', icon: Brain },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  dashboard: Dashboard,
  tracker: DailyTracker,
  habits: HabitMaster,
  analytics: Analytics,
  calendar: CalendarView,
  learning: Learning,
  goals: Goals,
  challenges: Challenges,
  rewards: Rewards,
  badges: Badges,
  finance: Finance,
  statistics: Statistics,
  insights: AIInsights,
  settings: SettingsTab,
};

export default function Home() {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen } = useAppStore();
  const [dateString, setDateString] = useState(() =>
    typeof window !== 'undefined'
      ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : ''
  );

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
      <div className="min-h-screen flex bg-background">
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
            'fixed top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col',
            'transition-transform duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
              <Flame className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight">Habit Tracker</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Professional V2</span>
            </div>
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
          <div className="p-3 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
              U
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold truncate">Habit Tracker</span>
              <span className="text-[10px] text-muted-foreground">Build better habits</span>
            </div>
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
            <div className="ml-auto text-xs text-muted-foreground" suppressHydrationWarning>
              {dateString}
            </div>
          </header>

          {/* Content area */}
          <div className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="animate-fade-in">
              <ActiveComponent key={activeTab} />
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}