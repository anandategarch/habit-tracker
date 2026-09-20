// ---------------------------------------------------------------------------
// src/components/work/work-notes-utils.tsx — helper kecil sub-tab Catatan
// (pecahan Task 71-e dari work-notes.tsx): warna kartu catatan, waktu relatif
// "diedit X menit lalu", dan sorotan kata kunci hasil pencarian.
// ---------------------------------------------------------------------------
'use client';

import type { WorkNoteItem } from './work-types';

/** Warna kartu: pin = kuning lembut; selain itu rotasi mint/rose/sky stabil per id. */
export function noteCardClass(note: WorkNoteItem, index: number): string {
  if (note.pinned) return 'work-note-card-pin';
  const palette = ['work-note-card-mint', 'work-note-card-rose', 'work-note-card-sky'];
  return palette[index % palette.length];
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'kemarin';
  if (days < 7) return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Sorot kata kunci pada hasil pencarian (case-insensitive, aman XSS via React). */
export function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>;
  const lower = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let index = lower.indexOf(lowerNeedle);
  let key = 0;
  while (index !== -1) {
    if (index > cursor) parts.push(<span key={key++}>{text.slice(cursor, index)}</span>);
    parts.push(
      <mark key={key++} className="rounded-[3px] bg-primary/20 px-0.5 text-foreground">
        {text.slice(index, index + needle.length)}
      </mark>
    );
    cursor = index + needle.length;
    index = lower.indexOf(lowerNeedle, cursor);
  }
  if (cursor < text.length) parts.push(<span key={key++}>{text.slice(cursor)}</span>);
  return <>{parts}</>;
}
