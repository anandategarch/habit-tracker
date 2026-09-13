'use client';

// components/habit-tracker/daily-tracker-notes-card.tsx — catatan harian.
//
// Task 38 (split god file): DIEKSTRAKSI dari daily-tracker.tsx — JSX + dynamic
// import TipTap-era RichNotesEditor (ssr:false) identik. Autosave (debounce)
// tetap di parent lewat onChange.

import dynamic from 'next/dynamic';
import { NotebookPen } from 'lucide-react';

// PHASE4-POLISH: TipTap rich text editor for the daily notes. Loaded with
// ssr:false because TipTap pokes at the DOM during initial render (it needs
// document.execCommand + contenteditable), and Next.js's SSR pass would
// crash without a real browser. The dynamic import also keeps the TipTap
// bundle (~80kb gzipped) out of the initial JS for users who never open the
// daily tracker tab.
const RichNotesEditor = dynamic(
  () => import('./rich-notes-editor').then((m) => m.RichNotesEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[112px] rounded-md bg-muted/30" />,
  },
);

export function DailyNotesCard({
  notes,
  onChange,
  charCount,
}: {
  notes: string;
  onChange: (html: string) => void;
  charCount: number;
}) {
  return (
    <section className="daily-notes-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="chip-soft chip-soft-teal h-7 w-7">
          <NotebookPen className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Catatan Harian</h3>
        <span className="ml-auto text-[11px] text-muted-foreground/70">
          {charCount > 0 ? `${charCount} karakter` : 'Tersimpan otomatis'}
        </span>
      </div>
      {/* GELOMBANG 1 (rebuild): editor teks polos premium (tanpa TipTap/
          dependensi baru) — HTML lama dibersihkan saat tampil; autosave
          tetap lewat debounce parent (handleNotesChange). */}
      <RichNotesEditor
        value={notes}
        onChange={onChange}
        placeholder="Bagaimana harimu? Tulis refleksi di sini…"
        className="text-sm leading-relaxed placeholder:text-muted-foreground/50"
      />
    </section>
  );
}
