'use client';

import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SECTION_MAP, type HelpSectionId } from './help-calculation-content';

// ── HelpInfoButton — inline contextual help per section ─────────────────
// Renders a small ℹ️ icon button. Click opens help for THAT section only.
//
// Mobile: uses a bottom-sheet Drawer (easier to reach, better for long
//   content, natural swipe-down to dismiss).
// Desktop: uses a Popover anchored to the icon (compact, stays in context).
//
// Both close on:
//   - Scroll (page scroll closes the help — prevents the popover from
//     floating over wrong content as the user scrolls)
//   - Explicit × button in the header
//   - Click outside / Esc (Radix default)
//
// Props:
//   section — which help section to show (matches SECTIONS[].id)
//   label   — aria-label fallback (defaults to "Bantuan: <section title>")
export function HelpInfoButton({ section, label }: { section: HelpSectionId; label?: string }) {
  const data = SECTION_MAP.get(section);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Close on PAGE scroll — when the user scrolls the underlying page, the
  // popover/drawer should close so it doesn't float over wrong content.
  //
  // BUG-1 fix: previously used `capture: true` which caught scroll events
  // from ALL containers — including the help panel's own `overflow-y-auto`
  // div. This meant scrolling to read the bottom metrics immediately closed
  // the help, making long sections (Proyeksi, Insight, etc.) unreadable.
  //
  // Fix: only close on window/document-level scroll (no capture). Scroll
  // events from nested containers (the help panel itself) do NOT bubble to
  // window in most browsers, so they won't trigger the close. This is the
  // desired behavior — the user can scroll inside the help without closing
  // it, but scrolling the page behind it closes it.
  //
  // Threshold fix: only close if scrollY actually changed significantly
  // (>5px). Tiny scroll events from layout shifts (image load, content
  // render, keyboard open/close) were causing the popover to immediately
  // close after opening — "timbul kemudian hilang".
  useEffect(() => {
    if (!open) return;
    let lastScrollY = window.scrollY;
    let scrolled = false;
    const handleScroll = () => {
      if (scrolled) return;
      const delta = Math.abs(window.scrollY - lastScrollY);
      // Only close on significant scroll (>5px), not tiny layout-shift scrolls
      if (delta > 5) {
        scrolled = true;
        setOpen(false);
      }
      lastScrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [open]);

  if (!data) return null; // unknown section — render nothing

  // Shared content — used by both Popover (desktop) and Drawer (mobile)
  const helpContent = (
    <>
      {/* Header — emoji + title + close button */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{data.emoji}</span>
          <p className="text-xs font-semibold text-foreground truncate">{data.title}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label="Tutup bantuan"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Intro */}
      {data.intro && (
        <p className="text-[11px] text-muted-foreground px-3 pt-2 leading-relaxed">
          {data.intro}
        </p>
      )}

      {/* Metrics list — only this section's metrics */}
      <div className="px-3 py-2 space-y-2">
        {data.metrics.map((metric, idx) => (
          <div key={idx} className="rounded-md border border-border/60 bg-muted/20 p-2">
            <p className="text-[11px] font-semibold text-foreground mb-0.5">{metric.name}</p>
            <p className="text-[10px] text-foreground/80 leading-relaxed mb-0.5">
              <span className="text-muted-foreground font-medium">Rumus: </span>
              {metric.formula}
            </p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-medium">Data: </span>
              {metric.source}
            </p>
          </div>
        ))}
      </div>
    </>
  );

  // Trigger button — shared between Popover and Drawer
  const triggerButton = (
    <button
      type="button"
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
      aria-label={label ?? `Bantuan: ${data.title}`}
      title={`Cara hitung: ${data.title}`}
    >
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM8 3a5 5 0 110 10 5 5 0 010-10zm0 1.75a.85.85 0 00-.85.85v3.2a.85.85 0 001.7 0v-3.2A.85.85 0 008 4.75zm0 5.9a1 1 0 100 2 1 1 0 000-2z"/>
      </svg>
    </button>
  );

  // Mobile: bottom-sheet Drawer — easier to reach, natural swipe-down dismiss,
  // doesn't cover content while reading. Max height 75vh so user can still
  // see the section they're learning about.
  //
  // BUG-4 fix: previously had TWO headers — DrawerHeader with visible
  // DrawerTitle + helpContent's own header with emoji+title+close. Both
  // showed the title → redundant, wasted ~48px. Now DrawerTitle is
  // sr-only (Vaul requires it for accessibility) and helpContent's header
  // is the single visible header (it has the close button).
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        {/* BUG-11 fix: use DrawerTrigger asChild instead of wrapper div. */}
        <DrawerTrigger asChild>
          {triggerButton}
        </DrawerTrigger>
        <DrawerContent className="max-h-[75vh]">
          {/* sr-only title — required by Vaul for accessibility, but not
              shown visually (helpContent has the visible header). */}
          <DrawerTitle className="sr-only">
            Cara Hitung: {data.title}
          </DrawerTitle>
          <div className="overflow-y-auto custom-scrollbar px-1 pb-4">
            {helpContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Popover anchored to the icon — compact, stays in context.
  // collisionPadding prevents the popover from going off-screen edges.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-96 max-h-[60vh] overflow-y-auto custom-scrollbar p-0"
      >
        {helpContent}
      </PopoverContent>
    </Popover>
  );
}
