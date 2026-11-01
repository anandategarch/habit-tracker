'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TabId } from '@/store/app-store';
import { Plus } from 'lucide-react';
import { NAV_LEFT_ITEMS, NAV_RIGHT_ITEMS } from '@/components/app-shell/app-tab-registry';
import { QuickAddMenu } from '@/components/app-shell/app-quick-action';

export function PremiumBottomNav({
  activeTab,
  onNavClick,
  inertBehindDrawer,
}: {
  activeTab: TabId;
  onNavClick: (id: TabId) => void;
  inertBehindDrawer?: boolean;
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!addMenuOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        addButtonRef.current?.focus();
      }
      return;
    }

    wasOpenRef.current = true;
    const getItems = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [],
      );
    getItems()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setAddMenuOpen(false);
        return;
      }
      const items = getItems();
      if (items.length === 0) return;
      const activeIndex = items.findIndex((item) => item === document.activeElement);
      if (event.key === 'Tab') {
        event.preventDefault();
        const nextIndex = event.shiftKey
          ? activeIndex <= 0 ? items.length - 1 : activeIndex - 1
          : activeIndex < 0 || activeIndex >= items.length - 1 ? 0 : activeIndex + 1;
        items[nextIndex]?.focus();
        return;
      }
      let nextIndex = -1;
      if (event.key === 'ArrowDown') nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
      else if (event.key === 'ArrowUp') nextIndex = activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = items.length - 1;
      if (nextIndex >= 0) {
        event.preventDefault();
        items[nextIndex]?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addMenuOpen]);

  const renderTab = (item: { id: TabId; label: string; icon: React.ElementType }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNavClick(item.id)}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        className={cn('rutina-bottom-item', isActive && 'rutina-bottom-item-active')}
      >
        <span className="rutina-bottom-icon-wrap" aria-hidden="true">
          <Icon className="rutina-bottom-icon" strokeWidth={1.85} />
        </span>
        <span className="rutina-bottom-label">{item.label}</span>
      </button>
    );
  };

  return (
    <div
      {...(inertBehindDrawer ? { inert: true } : {})}
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
    >
      {addMenuOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Tutup menu tambah cepat"
          className="rutina-bottom-backdrop fixed inset-0 z-30"
          onClick={() => setAddMenuOpen(false)}
        />
      )}

      <nav aria-label="Navigasi utama" className="rutina-bottom-bar relative z-40">
        <div className="rutina-bottom-layout">
          {NAV_LEFT_ITEMS.map(renderTab)}
          <button
            ref={addButtonRef}
            type="button"
            onClick={() => setAddMenuOpen((open) => !open)}
            aria-label={addMenuOpen ? 'Tutup menu tambah cepat' : 'Tambah cepat'}
            aria-haspopup="menu"
            aria-expanded={addMenuOpen}
            className={cn('rutina-bottom-item rutina-bottom-add', addMenuOpen && 'rutina-bottom-add-open')}
          >
            <span className="rutina-bottom-add-icon" aria-hidden="true">
              <Plus className="h-[21px] w-[21px]" strokeWidth={2} />
            </span>
            <span className="rutina-bottom-label">Tambah</span>
          </button>
          {NAV_RIGHT_ITEMS.map(renderTab)}
        </div>

        {addMenuOpen && (
          <QuickAddMenu
            activeTab={activeTab}
            onNavClick={onNavClick}
            onClose={() => setAddMenuOpen(false)}
            menuRef={menuRef}
            bottomOffset="calc(100% + 12px)"
          />
        )}
      </nav>
    </div>
  );
}
