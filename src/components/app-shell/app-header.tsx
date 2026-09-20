'use client';

// ── Header shell (Task 71-a, split dari src/app/page.tsx) ─────────────────
// Top bar — PREMIUM-UI: kaca blur + hairline bawah fade. Tombol toggle
// sidebar (tooltip) + judul tab aktif (NAV_ITEMS) + tanggal Jakarta.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { jakartaDateString } from '@/lib/jakarta-date';
import { NAV_ITEMS } from '@/components/app-shell/app-tab-registry';
import type { TabId } from '@/store/app-store';

export function AppHeader({
  toggleRef,
  sidebarOpen,
  onToggleSidebar,
  activeTab,
}: {
  /** Ref tombol toggle — dipakai focus-trap drawer (fallback return-focus). */
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeTab: TabId;
}) {
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

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/75 backdrop-blur-xl flex items-center px-4 md:px-6 gap-3 border-b border-border/70">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={toggleRef}
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
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
  );
}
