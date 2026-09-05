'use client';

// ─────────────────────────────────────────────────────────────────────────────
// PHASE3-HABIT — Shareable Progress Card
// ─────────────────────────────────────────────────────────────────────────────
//
// Generates a PNG image of a habit's progress that the user can download or
// share. Uses the `html-to-image` library to snapshot a hidden DOM node.
//
// Layout (the snapshot target):
//   ┌─────────────────────────────────────┐
//   │ 🎯 Habit Name                Rutina │   ← header (icon + name + brand)
//   │                                     │
//   │  ┌─────────┐  Streak      7 hari    │   ← key stats with big numbers
//   │  │  92%    │  Kekuatan    Kuat      │
//   │  └─────────┘                        │
//   │                                     │
//   │  7 hari terakhir                    │   ← mini calendar (S M T W T F S)
//   │  ▢ ▢ ▣ ▢ ▣ ▣ ▣                     │
//   │                                     │
//   │  ─────────────────────────────────  │
//   │  Rutina · habit tracker profesional │   ← footer
//   └─────────────────────────────────────┘
//
// The card is rendered hidden (off-screen) but in the DOM so html-to-image
// can snapshot it. The "Bagikan" button calls `toPng` and triggers a
// download. On supporting browsers (Chromium-based, mobile Safari), we also
// attempt to share via the Web Share API with files.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from 'react';
import { Share2, Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Habit } from './daily-tracker-types';

interface ShareButtonProps {
  habit: Habit;
  streak: number;
  strength: number;
  strengthTier: {
    label: string;
    colorClass: string;
    barClass: string;
    dimmed: boolean;
  };
  last7Days: { done: boolean; dateNum: number }[];
  className?: string;
}

const DOW_LABELS = ['S', 'S', 'R', 'K', 'J', 'S', 'M']; // Senin..Minggu (Indonesian single-letter)

export function ShareButton({
  habit,
  streak,
  strength,
  strengthTier,
  last7Days,
  className,
}: ShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isAvoid = habit.habitType === 'avoid';
  // For avoid habits: "Bersih" instead of "Selesai" on the share card.
  const successLabel = isAvoid ? 'Bersih' : 'Selesai';

  const handleShare = useCallback(async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      // Generate the PNG. Use a fixed pixelRatio for crisp output that's
      // not too heavy. backgroundColor = white so it looks good on both
      // light + dark mode (the snapshot would otherwise inherit dark-mode
      // colors which look bad when shared on a light-mode chat app).
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        // Filter out anything marked with `data-share-skip` (e.g. buttons).
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return !node.dataset.shareSkip;
        },
      });

      // Convert data URL → Blob for the Web Share API (if supported).
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filename = `rutina-${habit.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-streak-${streak}.png`;

      // Try the Web Share API with file support (mobile browsers). If it
      // fails or isn't supported, fall back to a download.
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
        share?: (data: ShareData) => Promise<void>;
      };
      const file = new File([blob], filename, { type: 'image/png' });
      const shareData: ShareData = {
        title: `${habit.icon} ${habit.name} — Streak ${streak} hari`,
        text: `Lagi ${streak} hari ${isAvoid ? 'bersih' : 'konsisten'} dengan ${habit.name}! 🔥`,
        files: [file],
      };

      if (nav.canShare && nav.canShare(shareData) && nav.share) {
        try {
          await nav.share(shareData);
          toast.success('Progress dibagikan!');
          return;
        } catch (err) {
          // User cancelled the share sheet — fall through to download.
          if (err instanceof Error && err.name === 'AbortError') {
            setBusy(false);
            return;
          }
          // Other share errors fall through to download.
        }
      }

      // Fallback: trigger a download.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke the object URL after a short delay so the download has time
      // to start (some browsers race here).
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Gambar progress tersimpan!');
    } catch (err) {
      console.error('Share card error:', err);
      toast.error('Gagal membuat gambar progress');
    } finally {
      setBusy(false);
    }
  }, [busy, habit, streak, isAvoid]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('w-full h-8 text-xs', className)}
        onClick={handleShare}
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Membuat gambar…
          </>
        ) : (
          <>
            <Share2 className="h-3.5 w-3.5" />
            Bagikan Progress
          </>
        )}
      </Button>

      {/* ── Off-screen snapshot target ────────────────────────────────────
          Rendered in the DOM but pulled out of view with absolute positioning.
          html-to-image reads the computed styles, so this must be laid out
          (not display:none, which would yield zero dimensions). Width is
          fixed at 480px so the snapshot is consistent regardless of viewport. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-99999px',
          top: 0,
          width: '480px',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={cardRef}
          style={{
            padding: '32px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)',
            borderRadius: '24px',
            border: '1px solid #d1fae5',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        >
          {/* Header: icon + name + brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: isAvoid ? '#fee2e2' : '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                flexShrink: 0,
              }}
            >
              {habit.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {habit.name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {habit.category}
                {isAvoid && ' · Hindari'}
                {habit.habitType === 'amount' && ' · Jumlah'}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Rutina
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                habit tracker
              </div>
            </div>
          </div>

          {/* Stats row: big progress ring + key metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
            {/* Progress ring (SVG, drawn statically — no animation in snapshot) */}
            <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
              <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="48" cy="48" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke={isAvoid ? '#ef4444' : '#22c55e'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - strength / 100)}
                />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 700,
                color: '#0f172a',
              }}>
                {strength}%
              </div>
            </div>

            {/* Key metrics */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Streak
                </span>
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
                  {streak}
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>
                    hari
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Kekuatan
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {strengthTier.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Status
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: isAvoid ? '#16a34a' : '#16a34a',
                  }}
                >
                  {successLabel}
                </span>
              </div>
            </div>
          </div>

          {/* 7-day mini calendar */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              7 hari terakhir
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {last7Days.map((day, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: '1',
                    borderRadius: '10px',
                    background: day.done
                      ? (isAvoid ? '#22c55e' : '#22c55e')
                      : '#f1f5f9',
                    color: day.done ? '#ffffff' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    border: day.done ? 'none' : '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 500 }}>
                    {DOW_LABELS[i]}
                  </span>
                  <span>{day.dateNum}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#94a3b8',
          }}>
            <span>Rutina · habit tracker profesional</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Download style={{ width: '12px', height: '12px' }} />
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
