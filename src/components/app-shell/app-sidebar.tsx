'use client';

// ── Sidebar / drawer (Task 71-a, split dari src/app/page.tsx) ─────────────
// useSidebarDrawer(): perilaku drawer (auto-open desktop, breakpoint
// crossing, semantik modal mobile, focus trap) + ref untuk elemen aside
// dan tombol toggle di header.
// AppSidebar: panel glass fixed-position yang slide in/out.

import { useEffect, useRef, useState } from 'react';
import { useAppStore, type TabId } from '@/store/app-store';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sprout } from 'lucide-react';
import { NAV_SECTIONS } from '@/components/app-shell/app-tab-registry';

/** Perilaku sidebar/drawer shell. Mengembalikan ref yang harus dilekatkan:
 * drawerRef → elemen <aside> (AppSidebar), sidebarToggleRef → tombol toggle
 * di header (AppHeader), isMobileViewport → kondisi inert konten di belakang
 * drawer mobile. */
export function useSidebarDrawer() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  // Auto-open sidebar on desktop (≥768px) on first mount.
  // Default is closed to avoid jarring overlay on mobile first load.
  // BUGHUNT-OTHER-1 BUG-L16: also react to window resize — previously the
  // sidebar only opened if the user happened to be on desktop at first
  // mount, and never re-opened when resizing from mobile to desktop.
  // BUGHUNT-ROUND2 SIDEBAR-1: the resize listener only ever OPENED the
  // sidebar (>=768px) — shrinking the window back to mobile left the
  // sidebar drawer open, covering ~2/3 of a phone screen with the dark
  // overlay. Now resize sets the state to match the viewport: open on
  // desktop, closed on mobile. A deliberately-opened mobile drawer is
  // unaffected until the user actually resizes/rotates the device.
  // TASK 59-b1 #4: resize kini hanya bereaksi saat BREAKPOINT CROSSING.
  // Sebelumnya ANY resize event memaksa setSidebarOpen(matchViewport):
  // sidebar desktop yang sengaja ditutup user diam-diam terbuka lagi oleh
  // zoom-devtools/resize jendela, dan drawer mobile terbuka dipaksa tutup.
  // Perilaku asli mount (auto-open desktop) dan crossing (BUGHUNT-ROUND2
  // SIDEBAR-1) tetap utuh.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let wasDesktop = window.innerWidth >= 768;
    setSidebarOpen(wasDesktop); // perilaku mount asli: auto-open di desktop
    const apply = () => {
      const isDesktop = window.innerWidth >= 768;
      if (isDesktop !== wasDesktop) {
        wasDesktop = isDesktop;
        setSidebarOpen(isDesktop);
      }
    };
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [setSidebarOpen]);

  // BUGHUNT-54 (3-d #3): deteksi mobile via matchMedia dulu dipakai kondisi
  // `inert` sidebar. TASK 59-b1 #2: state itu dihapus saat kondisi inert
  // disederhanakan. TASK 60-a #4a (temuan 59-b1): matchMedia DIBUAT KEMBALI
  // — kini untuk semantik MODAL drawer mobile: focus trap + inert konten di
  // belakang overlay hanya berlaku saat drawer terbuka di viewport mobile
  // (<768px — overlay dim terlihat). Di desktop sidebar adalah panel docked
  // (bukan modal): Tab harus tetap mengalir normal antara sidebar & konten.
  // Listener matchMedia independen — tidak menyentuh listener resize
  // breakpoint-crossing di atas.
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsMobileViewport(!mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // BUGHUNT-54 (3-d #3b): Escape menutup drawer saat terbuka — paritas a11y
  // dengan pola Escape menu FAB (PremiumBottomNav) yang sudah ada.
  // TASK 60-a #4a (temuan 59-b1): drawer mobile kini MODAL penuh (pola
  // WAI-ARIA dialog): saat terbuka di viewport mobile — simpan
  // document.activeElement, pindahkan fokus ke elemen focusable pertama di
  // drawer, Tab/Shift+Tab berputar DI DALAM drawer (focus trap), Escape
  // menutup, dan fokus dikembalikan ke elemen tersimpan saat tertutup
  // (fallback: tombol toggle header — saat drawer dibuka via klik,
  // browser Safari tidak memfokuskan tombol; dan saat inert main aktif,
  // browser mem-blur tombol). SATU handler terpadu menggantikan listener
  // Escape lama — tidak ada handler dobel/close ganda. Di desktop hanya
  // perilaku Escape lama yang berlaku (panel docked, bukan modal).
  const drawerRef = useRef<HTMLElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const drawerReturnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusables = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    const isModalDrawer = isMobileViewport;
    if (isModalDrawer) {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      drawerReturnFocusRef.current =
        active && active !== document.body ? active : sidebarToggleRef.current;
      focusables()[0]?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        return;
      }
      if (!isModalDrawer || e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === first || !drawer.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !drawer.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (isModalDrawer) {
        drawerReturnFocusRef.current?.focus?.();
        drawerReturnFocusRef.current = null;
      }
    };
  }, [sidebarOpen, isMobileViewport, setSidebarOpen]);

  return { drawerRef, sidebarToggleRef, isMobileViewport };
}

/** Panel sidebar — fixed position, slides in/out.
 * PREMIUM-UI: glass panel + gradient logo + active pill gradien.
 * TASK 59-b1 #2: `inert` setiap kali drawer TERTUTUP (dulu hanya di
 * viewport mobile — di desktop, sidebar tertutup tetap off-screen
 * di -translate-x-full TAPI tetap focusable: Tab mendarat di tombol
 * nav tak terlihat & Enter mengganti tab diam-diam — pelanggaran
 * WCAG 2.4.3/2.4.7). Tombol toggle di header tetap aktif untuk
 * membuka kembali. */
export function AppSidebar({
  drawerRef,
  sidebarOpen,
  activeTab,
  onNavClick,
}: {
  drawerRef: React.RefObject<HTMLElement | null>;
  sidebarOpen: boolean;
  activeTab: TabId;
  onNavClick: (id: TabId) => void;
}) {
  return (
    <aside
      ref={drawerRef}
      {...(!sidebarOpen ? { inert: true } : {})}
      className={cn(
        'fixed top-0 left-0 z-50 h-dvh w-64 flex flex-col',
        'bg-card/95 backdrop-blur-xl border-r border-border',
        'transition-transform duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Logo — TASK 45: tagline "Tumbuh setiap hari" (bukan spesifikasi
          fitur) — identitas Personal Life Companion. */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary via-primary/85 to-emerald-500 text-white premium-fab-shadow">
          <Sprout className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <span className="font-bold text-sm tracking-tight">Rutina</span>
          <p className="text-[10px] text-muted-foreground/70">Tumbuh setiap hari</p>
        </div>
      </div>

      {/* Navigation — TASK 45: dikelompokkan (Utama / Ruang lain) supaya
          hirarki IA terbaca: perjalanan harian dulu, ruang pendukung kemudian. */}
      <ScrollArea className="flex-1 py-3 custom-scrollbar">
        <nav className="px-2.5 space-y-4" aria-label="Navigasi utama">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="premium-label px-3 pb-1.5">{section.label}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavClick(item.id)}
                      // BUGHUNT-54 (3-d #8): aria-current untuk nav
                      // sidebar/drawer (paritas dgn tombol dock).
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                        isActive
                          ? 'btn-primary-gradient text-primary-foreground shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/70 active:scale-[0.98]',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive && 'anim-nav-icon-pop')} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Footer */}
      <div className="px-4 py-3 shrink-0">
        <p className="text-[10px] text-muted-foreground/60">by Ananda Tegar</p>
      </div>
    </aside>
  );
}
