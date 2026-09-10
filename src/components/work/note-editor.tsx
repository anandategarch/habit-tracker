// ---------------------------------------------------------------------------
// src/components/work/note-editor.tsx — editor Catatan pintar (Task 26).
// Bilah format + textarea yang membesar sendiri (auto-grow) + perilaku daftar
// standar aplikasi catatan profesional (Obsidian/Things/Notion):
//   Enter        → lanjutkan bullet/nomor/centang; di item kosong → keluar
//                  daftar (atau kurangi menjorok bila item menjorok).
//   Backspace    → di awal teks item: lepas penanda / kurangi menjorok.
//   Tab/Shift+Tab → menjorok / kurangi menjorok (tombol toolbar tersedia
//                  untuk ponsel yang tak punya tombol Tab).
// Semua operasi murni manipulasi teks — konten tetap teks polos.
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useRef } from 'react';
import { Bold, IndentDecrease, IndentIncrease, Italic, List, ListChecks, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { detectListMarker, noteStats, stripLineMarker } from './note-markdown';
import { NOTE_CONTENT_MAX } from './work-types';

/** Tinggi maksimum kotak tulis sebelum mulai scroll (px). */
const MAX_EDITOR_HEIGHT = 380;

function lineRangeAt(value: string, pos: number): [number, number] {
  const start = value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  const end = value.indexOf('\n', pos);
  return [start, end === -1 ? value.length : end];
}

export interface NoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxChars?: number;
  minRows?: number;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function NoteEditor({
  value,
  onChange,
  maxChars = NOTE_CONTENT_MAX,
  minRows = 9,
  placeholder,
  disabled,
  autoFocus,
}: NoteEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);

  // Auto-grow: tinggi mengikuti isi, mentok lalu scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_EDITOR_HEIGHT)}px`;
  }, [value]);

  // Pulihkan posisi kursor setelah edit terprogram (toolbar/Enter/Backspace).
  useEffect(() => {
    const el = ref.current;
    if (!el || !pendingSel.current) return;
    const [start, end] = pendingSel.current;
    pendingSel.current = null;
    const max = el.value.length;
    el.setSelectionRange(Math.min(start, max), Math.min(end, max));
  }, [value]);

  const apply = (next: string, selStart: number, selEnd: number = selStart) => {
    pendingSel.current = [selStart, selEnd];
    onChange(next);
  };

  // ── Operasi baris ────────────────────────────────────────────────────────

  const toggleLineKind = (kind: 'bullet' | 'number' | 'check') => {
    const el = ref.current;
    if (!el) return;
    const value = el.value;
    const pos = el.selectionStart;
    const [ls, le] = lineRangeAt(value, pos);
    const raw = value.slice(ls, le);
    const marker = detectListMarker(raw);
    const { lead, body } = stripLineMarker(raw);
    let nextLine: string;
    if (marker && marker.kind === kind) {
      // Penanda sama → lepas (kembali ke teks biasa).
      nextLine = lead + body;
    } else {
      const prefix = kind === 'bullet' ? '- ' : kind === 'check' ? '- [ ] ' : '1. ';
      nextLine = lead + prefix + body;
    }
    apply(value.slice(0, ls) + nextLine + value.slice(le), ls + nextLine.length);
  };

  const wrapSelection = (marker: string) => {
    const el = ref.current;
    if (!el) return;
    const value = el.value;
    const s = el.selectionStart;
    const e = el.selectionEnd;
    const before = value.slice(Math.max(0, s - marker.length), s);
    const after = value.slice(e, e + marker.length);
    if (before === marker && after === marker) {
      const next = value.slice(0, s - marker.length) + value.slice(s, e) + value.slice(e + marker.length);
      apply(next, s - marker.length, e - marker.length);
      return;
    }
    const next = value.slice(0, s) + marker + value.slice(s, e) + marker + value.slice(e);
    apply(next, s + marker.length, e + marker.length);
  };

  const indentLine = (value: string, ls: number, le: number, pos: number, outdent: boolean) => {
    const raw = value.slice(ls, le);
    const lead = /^[ \t]*/.exec(raw)?.[0] ?? '';
    if (outdent) {
      const cut = lead.length >= 2 ? 2 : lead.length;
      if (cut === 0) return;
      apply(value.slice(0, ls) + raw.slice(cut) + value.slice(le), Math.max(ls, pos - cut));
      return;
    }
    if (lead.length >= 6) return; // maks 3 level menjorok.
    apply(`${value.slice(0, ls)}  ${raw}${value.slice(le)}`, pos + 2);
  };

  // ── Perilaku tombol ──────────────────────────────────────────────────────

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const value = el.value;
    const pos = el.selectionStart;
    const [ls, le] = lineRangeAt(value, pos);
    const raw = value.slice(ls, le);

    if (e.key === 'Tab') {
      e.preventDefault();
      indentLine(value, ls, le, pos, e.shiftKey);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && pos === le) {
      const marker = detectListMarker(raw);
      if (!marker) return;
      e.preventDefault();
      // Item kosong: keluar daftar / kurangi menjorok.
      if (!raw.slice(marker.markerLen).trim()) {
        if (marker.indent > 0) {
          apply(value.slice(0, ls) + raw.slice(2) + value.slice(le), ls);
        } else {
          // Hapus baris ini seluruhnya (termasuk baris barunya).
          const lineIdx = value.slice(0, ls).split('\n').length - 1;
          const nextLines = value.split('\n');
          nextLines.splice(lineIdx, 1);
          apply(nextLines.join('\n'), ls);
        }
        return;
      }
      const lead = ' '.repeat(marker.indent * 2);
      const prefix = marker.kind === 'check' ? '- [ ] ' : marker.kind === 'bullet' ? '- ' : `${marker.num + 1}. `;
      const insert = `\n${lead}${prefix}`;
      apply(value.slice(0, pos) + insert + value.slice(pos), pos + insert.length);
      return;
    }

    if (e.key === 'Backspace' && el.selectionStart === el.selectionEnd) {
      const marker = detectListMarker(raw);
      if (marker && pos - ls === marker.markerLen) {
        e.preventDefault();
        if (marker.indent > 0) {
          apply(value.slice(0, ls) + raw.slice(2) + value.slice(le), Math.max(ls, pos - 2));
        } else {
          apply(value.slice(0, ls) + raw.slice(marker.markerLen) + value.slice(le), ls);
        }
      }
    }
  };

  const stats = noteStats(value);

  const toolBtn =
    'grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-background hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';
  const divider = 'mx-0.5 h-5 w-px shrink-0 bg-border';

  return (
    <div className="w-full">
      <div
        role="group"
        aria-label="Bilah format catatan"
        className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
      >
        <button type="button" aria-label="Ubah baris jadi bullet" disabled={disabled} onClick={() => toggleLineKind('bullet')} className={toolBtn}>
          <List className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Ubah baris jadi daftar bernomor" disabled={disabled} onClick={() => toggleLineKind('number')} className={toolBtn}>
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Ubah baris jadi kotak centang" disabled={disabled} onClick={() => toggleLineKind('check')} className={toolBtn}>
          <ListChecks className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className={divider} aria-hidden="true" />
        <button type="button" aria-label="Tebalkan teks terpilih" disabled={disabled} onClick={() => wrapSelection('**')} className={toolBtn}>
          <Bold className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Miringkan teks terpilih" disabled={disabled} onClick={() => wrapSelection('*')} className={toolBtn}>
          <Italic className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className={divider} aria-hidden="true" />
        <button
          type="button"
          aria-label="Menjorokkan baris ke dalam"
          disabled={disabled}
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            const [ls, le] = lineRangeAt(el.value, el.selectionStart);
            indentLine(el.value, ls, le, el.selectionStart, false);
          }}
          className={toolBtn}
        >
          <IndentIncrease className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Kurangi menjorok baris"
          disabled={disabled}
          onClick={() => {
            const el = ref.current;
            if (!el) return;
            const [ls, le] = lineRangeAt(el.value, el.selectionStart);
            indentLine(el.value, ls, le, el.selectionStart, true);
          }}
          className={toolBtn}
        >
          <IndentDecrease className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={minRows}
        maxLength={maxChars}
        placeholder={placeholder ?? 'Tulis bebas… ketik - lalu spasi untuk bullet, 1. untuk nomor'}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label="Isi catatan"
        className="custom-scrollbar mt-2 w-full resize-none rounded-2xl border border-border bg-card px-3.5 py-3 work-serif text-[13.5px] leading-relaxed text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
      />

      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
        <span>{stats.words.toLocaleString('id-ID')} kata</span>
        <span className={cn(stats.chars >= maxChars * 0.95 && 'font-bold text-destructive')}>
          {stats.chars.toLocaleString('id-ID')} / {maxChars.toLocaleString('id-ID')} huruf
        </span>
      </div>
    </div>
  );
}
