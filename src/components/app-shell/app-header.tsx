'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PanelLeftClose, PanelLeftOpen, CalendarDays } from 'lucide-react';
import { jakartaDateString } from '@/lib/jakarta-date';
import { NAV_ITEMS } from '@/components/app-shell/app-tab-registry';
import type { TabId } from '@/store/app-store';

export function AppHeader({
  toggleRef, sidebarOpen, onToggleSidebar, activeTab,
}: {
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: TabId;
}) {
  const [dateString, setDateString] = useState('');
  useEffect(() => {
    const update = () => setDateString(
      new Date(`${jakartaDateString()}T00:00:00Z`).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      }),
    );
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="rutina-header sticky top-0 z-30 flex shrink-0 items-center gap-3 backdrop-blur-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={toggleRef} variant="ghost" size="icon"
            className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}>
            {sidebarOpen ? <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{sidebarOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}</TooltipContent>
      </Tooltip>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-muted-foreground">Ruang pribadi</p>
        <h1 className="truncate text-base font-semibold tracking-tight">{NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Rutina'}</h1>
      </div>
      {dateString && (
        <div className="rutina-header-date ml-auto max-[419px]:hidden" suppressHydrationWarning>
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /><span>{dateString}</span>
        </div>
      )}
    </header>
  );
}
