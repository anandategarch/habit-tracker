'use client';

// ── PremiumBottomNav (Task 71-a, split dari src/app/page.tsx) ─────────────
// PREMIUM REDESIGN (replaces the old Flutter notched bar):
// "Floating Glass Dock" — iOS-18 / modern-fintech design language.
//  • Floating frosted-glass bar (mx-3, rounded-[26px], backdrop-blur-2xl)
//    with layered teal-tinted depth shadows + top hairline highlight.
//  • Gradient "liquid" indicator that slides between tabs with a spring
//    curve (cubic-bezier overshoot) and passes BEHIND the FAB.
//  • Center FAB: teal→emerald gradient, glow, socket ring illusion,
//    rotates 45° into an X when the menu is open.
//  • Quick-add popup: frosted glass card, spring-staggered items, tail
//    pointer, dimmed backdrop (tap/Escape to close) — komponen
//    QuickAddMenu (app-quick-action.tsx).
//  • Mobile-only (md:hidden). a11y: aria-current, aria-expanded,
//    role=menu, focus-visible rings, prefers-reduced-motion respected.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TabId } from '@/store/app-store';
import { Plus } from 'lucide-react';
import { NAV_LEFT_ITEMS, NAV_RIGHT_ITEMS } from '@/components/app-shell/app-tab-registry';
import { QuickAddMenu } from '@/components/app-shell/app-quick-action';

const DOCK_H = 62; // dock height (px)
// TASK 54: Tujuan keluar dari dock (permintaan user) — dock simetris:
// 2 tab kiri + FAB tengah + 2 tab kanan. dockTabMetrics() data-driven
// jadi geometri indikator menyesuaikan otomatis; tab di luar dock
// ('work'/'settings'/'pohon'/'gym') membiarkan indikator tersembunyi.
// TASK 66: 'goals' sudah bukan tab — deep-link lama jatuh ke dashboard.
// BUGHUNT-54 (3-d #4): 0.43 → 0.40. Zona tengah (1 − 2×DOCK_SIDE) kini 20%
// ≈ 59px @dock 296px (viewport 320px) ≥ FAB 56px — dulu 14% ≈ 41px < 56px,
// sudut dalam tombol Tracker/Progres ketimpa FAB (elementFromPoint = FAB).
// Lebar tab @320px = 0.40×296/2 ≈ 59px masih muat untuk label terpanjang
// "Keuangan" (~47px).
const DOCK_SIDE = 0.40; // width share of each tab group (left/right)
const IND_INSET = 3; // indicator horizontal inset inside a tab
const FAB_SIZE = 56; // FAB diameter (px)
const FAB_PROTRUDE = 22; // px of FAB protruding above the dock top edge

// Geometri indikator per tab (fraksi lebar dock) — data-driven dari daftar
// tab dock di registry, jadi menambah/menggeser tab tidak perlu menyentuh
// konstanta posisi manual. Setiap tab punya {left, width} dalam fraksi dockW.
function dockTabMetrics(id: TabId): { left: number; width: number } | undefined {
  const li = NAV_LEFT_ITEMS.findIndex((n) => n.id === id);
  if (li >= 0) {
    const w = DOCK_SIDE / NAV_LEFT_ITEMS.length;
    return { left: w * li, width: w };
  }
  const ri = NAV_RIGHT_ITEMS.findIndex((n) => n.id === id);
  if (ri >= 0) {
    const w = DOCK_SIDE / NAV_RIGHT_ITEMS.length;
    return { left: 1 - DOCK_SIDE + w * ri, width: w };
  }
  return undefined;
}

export function PremiumBottomNav({
  activeTab,
  onNavClick,
  inertBehindDrawer,
}: {
  activeTab: TabId;
  onNavClick: (id: TabId) => void;
  /** TASK 60-a #4a: dock ikut non-interactive saat drawer mobile terbuka
      (modal penuh — konten di belakang overlay tidak boleh tersentuh
      pointer/keyboard; fokus dikembalikan trap drawer). Desktop tidak
      terpengaruh (prop hanya true saat viewport <768px). */
  inertBehindDrawer?: boolean;
}) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockW, setDockW] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);

  useLayoutEffect(() => {
    if (!dockRef.current) return;
    const update = () => setDockW(dockRef.current?.offsetWidth ?? 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dockRef.current);
    return () => observer.disconnect();
  }, []);

  // FIX FAB-FOCUS: menu role=menu kini menerima fokus keyboard — item
  // pertama difokuskan saat buka, fokus kembali ke FAB saat tutup
  // (guard wasOpenRef supaya tidak mencuri fokus saat mount awal).
  // TASK 60-a #4a (temuan 59-b1): menu kini patuh pola WAI-ARIA Menu penuh
  // — SATU handler terpadu (menggabungkan listener Escape lama + efek
  // FIX FAB-FOCUS, tanpa handler dobel): Escape menutup; Tab/Shift+Tab
  // BERPUTAR di antara item menu (focus trap — konten di belakang
  // backdrop tidak menerima fokus keyboard); ArrowDown/ArrowUp/Home/End
  // memindahkan fokus antar role="menuitem" (roving focus pola APG).
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fabBtnRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!fabOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        fabBtnRef.current?.focus();
      }
      return;
    }
    wasOpenRef.current = true;
    const items = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [],
      );
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFabOpen(false);
        return;
      }
      const list = items();
      if (list.length === 0) return;
      const idx = list.findIndex((el) => el === document.activeElement);
      if (e.key === 'Tab') {
        // Trap: berputar di antara item menu saja (preventDefault — tanpa
        // ini Tab melompat ke tombol dock di belakang backdrop dim).
        e.preventDefault();
        const nextIdx = e.shiftKey
          ? idx <= 0
            ? list.length - 1
            : idx - 1
          : idx < 0 || idx >= list.length - 1
            ? 0
            : idx + 1;
        list[nextIdx]?.focus();
        return;
      }
      let next = -1;
      if (e.key === 'ArrowDown') next = idx < 0 ? 0 : (idx + 1) % list.length;
      else if (e.key === 'ArrowUp') next = idx < 0 ? list.length - 1 : (idx - 1 + list.length) % list.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = list.length - 1;
      else return;
      e.preventDefault();
      list[next]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fabOpen]);

  // Liquid indicator geometry. GPU-friendly: fixed width per tab +
  // translateX transition with a spring (overshoot) easing curve.
  const metrics = dockTabMetrics(activeTab);
  const indVisible = metrics !== undefined && dockW > 0;
  const indX = metrics ? metrics.left * dockW + IND_INSET : 0;
  const indW = metrics ? Math.max(0, metrics.width * dockW - IND_INSET * 2) : 0;

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
          'relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px]',
          'whitespace-nowrap',
          'transition-transform duration-150 motion-reduce:transition-none active:scale-[0.94]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70',
          'focus-visible:ring-offset-1 focus-visible:rounded-2xl'
        )}
      >
        <span
          aria-hidden="true"
          className={cn('grid place-items-center', isActive && 'anim-nav-icon-pop')}
        >
          <Icon
            className={cn(
              'h-[21px] w-[21px] shrink-0 transition-colors duration-300 motion-reduce:transition-none',
              isActive
                ? 'text-white drop-shadow-[0_1px_1px_rgba(0,66,55,0.25)]'
                : 'text-slate-500 dark:text-slate-400'
            )}
            strokeWidth={isActive ? 2.4 : 1.7}
          />
        </span>
        <span
          className={cn(
            'premium-dock-label transition-colors duration-300 motion-reduce:transition-none',
            isActive
              ? 'font-bold text-white'
              : 'font-medium text-slate-500 dark:text-slate-400'
          )}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <div
      {...(inertBehindDrawer ? { inert: true } : {})}
      className="fixed bottom-0 inset-x-0 z-40 md:hidden"
    >
      {/* Dimmed backdrop while the quick-add popup is open — tap to close.
          Rendered OUTSIDE the animated nav element (no transformed
          ancestor) so position:fixed is always viewport-correct. */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/25 dark:bg-black/40 backdrop-blur-[2px] anim-fab-backdrop"
          onClick={() => setFabOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        ref={dockRef}
        aria-label="Navigasi utama"
        className={cn(
          'relative z-40 mx-3 mb-[calc(env(safe-area-inset-bottom)+10px)]',
          'anim-nav-dock-enter',
          'rounded-[26px]',
          'bg-white/80 dark:bg-slate-900/80',
          'backdrop-blur-2xl backdrop-saturate-150',
          'border border-slate-900/[0.07] dark:border-white/10',
          'premium-dock-shadow'
        )}
        style={{ height: DOCK_H }}
      >
        {/* Glass hairline highlight along the top edge (light refraction) */}
        <div
          aria-hidden="true"
          className="absolute inset-x-[16px] top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/15 pointer-events-none"
        />

        {/* Liquid gradient indicator — slides between tabs, passes behind
            the FAB (z-0 vs z-20). */}
        <div
          aria-hidden="true"
          className="nav-liquid-indicator absolute left-0 top-[7px] z-0 rounded-full"
          style={{
            height: DOCK_H - 14,
            width: indW,
            transform: `translateX(${indX}px)`,
            opacity: indVisible ? 1 : 0,
          }}
        />

        {/* Soft teal halo behind the FAB — glows through the glass dock */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 -top-[46px] -translate-x-1/2 w-[104px] h-[104px] rounded-full bg-teal-400/20 dark:bg-teal-400/25 blur-3xl pointer-events-none"
        />

        {/* Tab groups — 40% each side; the center 20% is the FAB zone
            (BUGHUNT-54 3-d #4/#9a: zona tengah ±59px @320px ≥ FAB 56px;
            geometri indikator tetap data-driven via dockTabMetrics()). */}
        <div className="absolute left-0 top-0 h-full flex items-stretch" style={{ width: `${DOCK_SIDE * 100}%` }}>
          {NAV_LEFT_ITEMS.map(renderTab)}
        </div>
        <div className="absolute right-0 top-0 h-full flex items-stretch" style={{ width: `${DOCK_SIDE * 100}%` }}>
          {NAV_RIGHT_ITEMS.map(renderTab)}
        </div>

        {/* Quick-add popup — frosted glass card, spring-staggered items.
            bottom is nav-relative: dock height + FAB protrusion + 10px gap
            (the nav already sits above the safe-area inset). */}
        {fabOpen && (
          <QuickAddMenu
            activeTab={activeTab}
            onNavClick={onNavClick}
            onClose={() => setFabOpen(false)}
            menuRef={menuRef}
            bottomOffset={DOCK_H + FAB_PROTRUDE + 10}
          />
        )}

        {/* FAB — half-socketed into the dock, protruding above the edge */}
        <div
          className="absolute left-1/2 z-20 -translate-x-1/2"
          style={{ top: -FAB_PROTRUDE }}
        >
          <button
            ref={fabBtnRef}
            onClick={() => setFabOpen(!fabOpen)}
            aria-label={fabOpen ? 'Tutup menu tambah cepat' : 'Tambah cepat'}
            aria-haspopup="menu"
            aria-expanded={fabOpen}
            className={cn(
              'relative grid place-items-center rounded-full',
              'bg-gradient-to-br from-primary via-primary/85 to-emerald-500',
              'premium-fab-shadow',
              // Socket illusion: the ring approximates the dock bg color so
              // the FAB looks punched through the frosted glass.
              'ring-[4px] ring-white/80 dark:ring-slate-900/90',
              'transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
              'active:scale-90 motion-reduce:transition-none',
              fabOpen && 'rotate-45'
            )}
            style={{ width: FAB_SIZE, height: FAB_SIZE }}
          >
            {/* Inner sheen — subtle 3D glass-metal feel */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 via-transparent to-black/10 pointer-events-none"
            />
            {/* Plus rotated 45° = X when open (clean swap-free close icon) */}
            <Plus className="h-6 w-6 text-white drop-shadow-[0_1px_2px_rgba(0,66,55,0.35)]" strokeWidth={2.5} />
          </button>
        </div>
      </nav>
    </div>
  );
}
