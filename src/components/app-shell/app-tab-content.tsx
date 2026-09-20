'use client';

// ── Area konten tab (Task 71-a, split dari src/app/page.tsx) ───────────────
// PullToRefresh (scroll container + refresh) membungkus PageTransition yang
// membungkus komponen tab aktif (TAB_COMPONENTS). Handler refresh dipindah
// bersama elemen yang memakainya.

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore, type TabId } from '@/store/app-store';
import { PageTransition } from '@/components/habit-tracker/page-transition';
import { PullToRefresh } from '@/components/habit-tracker/pull-to-refresh';
import { TAB_COMPONENTS } from '@/components/app-shell/app-tab-registry';

export function AppTabContent({ tabId }: { tabId: TabId }) {
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();

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

  const ActiveComponent = TAB_COMPONENTS[tabId];

  // Content area — extra bottom padding on mobile so content
  // doesn't get hidden behind the floating glass dock.
  // Dock stack: 62px bar + 10px bottom margin + 16px breathing
  // gap = 88px (excluding safe-area inset).
  //
  // overflow-y-auto + overscroll-y-contain for smooth touch scroll
  // on mobile (prevents scroll chaining to body / stuck scroll
  // after DnD sensors or CSS animations intercept touch events).
  // WebkitOverflowScrolling: 'touch' enables iOS momentum scrolling.
  //
  // ANIM-3 / Feature 5: PullToRefresh wraps the content area.
  // On touch devices, the user can pull down at the top of the
  // scroll area to trigger a full data refresh (a 🌱 sprout
  // grows as they pull, then spins while refreshing). On
  // desktop (no touch), it's a pass-through wrapper — no
  // behaviour change.
  return (
    <PullToRefresh
      data-slot="app-scroller"
      className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-4 md:p-6 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-6"
      onRefresh={handleRefresh}
    >
      {/* ANIM-2 / Feature 4: PageTransition wraps the active tab
          content with a smooth enter/exit (fade + slide x).
          Replaces the previous `anim-tab-enter` CSS-only transition
          with framer-motion's AnimatePresence for crossfade-aware
          enter/exit (no overlap). `tabId={tabId}` triggers a
          re-mount on tab change. */}
      <PageTransition tabId={tabId}>
        <ActiveComponent />
      </PageTransition>
    </PullToRefresh>
  );
}
