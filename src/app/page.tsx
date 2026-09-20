'use client';

// ── App shell (Task 71-a) ──────────────────────────────────────────────────
// Komposisi tipis: seluruh mekanik shell dipecah ke modul kolokasi
// src/components/app-shell/*:
//   app-tab-registry.tsx  — dynamic loader per tab (ssr:false + tabLoading)
//                           + konfigurasi navigasi (sidebar & dock)
//   app-url-sync.ts       — deep-link ?tab/?date/?sub ↔ store + popstate
//   app-splash.tsx        — splash Task 58 + state exit animasi
//   app-sidebar.tsx       — drawer/focus-trap + panel sidebar
//   app-header.tsx        — top bar (toggle, judul, tanggal Jakarta)
//   app-tab-content.tsx   — PullToRefresh + PageTransition + tab aktif
//   app-bottom-nav.tsx    — Premium Floating Glass Dock + FAB
//   app-quick-action.tsx  — popup menu tambah cepat (role=menu)
// `?tab=goals` deep-link lama jatuh ke fallback dashboard (VALID_TAB_IDS
// di app-url-sync.ts — TASK 66).

import { useCallback } from 'react';
import { useAppStore, type TabId } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';

// BUGHUNT-54 (3-d #2): gerbang Kunci Aplikasi — PIN perangkat (hash di
// localStorage 'rutina_app_lock', kelola di Pengaturan) kini benar-benar
// mengunci shell saat sesi baru. Komponen app-lock-settings.tsx
// (READ-ONLY) tetap sumber kebenaran isAppLockSet/verifyAppLockPin.
import { AppLockGate } from '@/components/app-lock-gate';
import { ParallaxBackground } from '@/components/habit-tracker/page-transition';

import { useAppSplash, SplashOverlay } from '@/components/app-shell/app-splash';
import { useUrlContextSync } from '@/components/app-shell/app-url-sync';
import { AppSidebar, useSidebarDrawer } from '@/components/app-shell/app-sidebar';
import { AppHeader } from '@/components/app-shell/app-header';
import { AppTabContent } from '@/components/app-shell/app-tab-content';
import { PremiumBottomNav } from '@/components/app-shell/app-bottom-nav';

export default function Home() {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  // CONNECTED-APP: konteks URL — tanggal tracker & sub-tab keuangan ikut
  // diserialisasi ke ?date= / ?sub= (deep-link + tombol Back).
  const selectedDate = useAppStore(s => s.selectedDate);
  const financeSubTab = useAppStore(s => s.financeSubTab);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);

  const { showSplash, splashExiting } = useAppSplash();
  useUrlContextSync(activeTab, selectedDate, financeSubTab);
  const { drawerRef, sidebarToggleRef, isMobileViewport } = useSidebarDrawer();

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

  return (
    <TooltipProvider delayDuration={300}>
      {/* Splash screen — TASK 58 (lihat app-splash.tsx). FEAT-SPLASH-REVEAL:
          exit animation (fade + scale + slide up); content entrance
          `anim-content-reveal` pada layout utama di bawah. */}
      {showSplash && <SplashOverlay exiting={splashExiting} />}
      {/* BUGFIX SCROLL-2: h-dvh + overflow-hidden bounds the layout to the
          viewport so the inner PullToRefresh (content area) becomes a REAL
          scroll container. Previously min-h-dvh (no max height) let the
          wrapper grow to fit content, making overflow-y-auto inert and
          forcing the document (html) to scroll — which on mobile Chrome/
          iOS Safari intermittently fails to respond to touch after DnD
          sensors or CSS animations intercept touch events. With the layout
          bounded, PullToRefresh owns the scroll, document doesn't scroll. */}
      {/* BUGHUNT-54 (3-d #2): AppLockGate membungkus SELURUH shell (header,
          konten tab, sidebar/drawer, PremiumBottomNav) — saat PIN diset dan
          sesi belum dibuka, hanya layar kunci yang dirender (shell tidak
          termount sama sekali). Splash screen tetap di luar gerbang
          (branding dulu → layar kunci → aplikasi). Tanpa PIN: pass-through. */}
      <AppLockGate>
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

          <AppSidebar
            drawerRef={drawerRef}
            sidebarOpen={sidebarOpen}
            activeTab={activeTab}
            onNavClick={handleNavClick}
          />

          {/* Main content - shifts right on desktop when sidebar is open.
              min-h-0 (BUGFIX SCROLL-1) lets flex-1 children shrink below content
              height so a future bounded-height layout produces a real scroll
              container instead of growing to fit content. */}
          <main
            {...(sidebarOpen && isMobileViewport ? { inert: true } : {})}
            className={cn(
              'flex-1 min-w-0 min-h-0 flex flex-col transition-[margin] duration-300 ease-in-out',
              sidebarOpen ? 'md:ml-64' : 'md:ml-0'
            )}
          >
            <AppHeader
              toggleRef={sidebarToggleRef}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={toggleSidebar}
              activeTab={activeTab}
            />
            <AppTabContent tabId={activeTab} />
          </main>

          <PremiumBottomNav
            activeTab={activeTab}
            onNavClick={handleNavClick}
            inertBehindDrawer={sidebarOpen && isMobileViewport}
          />
        </div>
      </AppLockGate>
    </TooltipProvider>
  );
}
