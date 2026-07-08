'use client';

import { useCallback } from 'react';
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
  Calculator,
  Brain,
  Settings as SettingsIcon,
  Menu,
  X,
  Flame,
} from 'lucide-react';

import Dashboard from '@/components/habit-tracker/dashboard';
import DailyTracker from '@/components/habit-tracker/daily-tracker';
import HabitMaster from '@/components/habit-tracker/habit-master';
import Analytics from '@/components/habit-tracker/analytics';
import CalendarView from '@/components/habit-tracker/calendar-view';
import Journal from '@/components/habit-tracker/journal';
import Goals from '@/components/habit-tracker/goals';
import Challenges from '@/components/habit-tracker/challenges';
import Rewards from '@/components/habit-tracker/rewards';
import Badges from '@/components/habit-tracker/badges';
import Statistics from '@/components/habit-tracker/statistics';
import AIInsights from '@/components/habit-tracker/ai-insights';
import SettingsTab from '@/components/habit-tracker/settings';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tracker', label: 'Daily Tracker', icon: CheckSquare },
  { id: 'habits', label: 'Habit Master', icon: ListChecks },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'badges', label: 'Badges', icon: Medal },
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
  journal: Journal,
  goals: Goals,
  challenges: Challenges,
  rewards: Rewards,
  badges: Badges,
  statistics: Statistics,
  insights: AIInsights,
  settings: SettingsTab,
};

export default function Home() {
  const { activeTab, setActiveTab, sidebarOpen, setSidebarOpen } = useAppStore();

  const handleNavClick = useCallback((id: TabId) => {
    setActiveTab(id);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [setActiveTab, setSidebarOpen]);

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen flex bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-16'
          )}
        >
          {/* Logo */}
          <div className={cn(
            'flex items-center gap-3 px-4 h-16 border-b border-border shrink-0',
            !sidebarOpen && 'md:justify-center md:px-2'
          )}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
              <Flame className="h-5 w-5" />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight">Habit Tracker</span>
                <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">Professional V2</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-2 custom-scrollbar">
            <nav className="px-2 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                          !sidebarOpen && 'md:justify-center md:px-2'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary-foreground')} />
                        {sidebarOpen && <span>{item.label}</span>}
                      </button>
                    </TooltipTrigger>
                    {!sidebarOpen && (
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </nav>
          </ScrollArea>

          <Separator />

          {/* Footer */}
          <div className={cn(
            'p-3 flex items-center gap-3 shrink-0',
            !sidebarOpen && 'md:justify-center md:p-2'
          )}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
              U
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold truncate">Habit Tracker</span>
                <span className="text-[10px] text-muted-foreground">Build better habits</span>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-md border-b border-border flex items-center px-4 md:px-6 gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-lg font-semibold">
              {NAV_ITEMS.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <div className="ml-auto text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
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