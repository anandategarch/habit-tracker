// ---------------------------------------------------------------------------
// src/components/work/note-markdown.tsx — parser + renderer markdown-lite
// untuk Catatan Meja Kerja (Task 26, Fase 1+2 hasil riset aplikasi catatan
// profesional: Notion/Obsidian/Things/Apple Notes).
//
// Format yang didukung (disimpan sebagai TEKS POLOS di kolom content — tanpa
// schema baru, catatan lama tetap tampil normal):
//   - item              → bullet
//   * item              → bullet (alias)
//   1. item / 1) item   → daftar bernomor (renumber otomatis saat tampil)
//   - [ ] item          → kotak centang (belum)
//   - [x] item          → kotak centang (selesai)
//   # / ## / ### Judul  → judul kecil
//   **tebal** *miring*  → format inline
//   2 spasi di depan    → menjorok 1 level (maks 3 level)
// ---------------------------------------------------------------------------
'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NoteLineKind = 'paragraph' | 'heading' | 'bullet' | 'number' | 'check';

export interface NoteLine {
  /** Indeks baris di konten asli — dipakai toggle centang presisi. */
  lineIndex: number;
  kind: NoteLineKind;
  /** Level menjorok 0..3. */
  indent: number;
  /** Teks setelah penanda (tanpa penanda). */
  text: string;
  /** Khusus kind 'check'. */
  checked?: boolean;
  /** Nomor urut tampilan untuk kind 'number'. */
  order?: number;
  /** Level judul 1..3 untuk kind 'heading'. */
  level?: number;
  empty?: boolean;
}

export interface ListMarkerInfo {
  kind: 'bullet' | 'number' | 'check';
  indent: number;
  /** Panjang penanda dari awal baris sampai teks. */
  markerLen: number;
  num: number;
}

const RE_CHECK = /^([ \t]*)[-*]\s+\[( |x|X)\][ \t]*(.*)$/;
const RE_BULLET = /^([ \t]*)[-*]\s+(.*)$/;
const RE_NUMBER = /^([ \t]*)(\d+)([.)])[ \t]+(.*)$/;
const RE_HEADING = /^(#{1,3})[ \t]+(.*)$/;

function indentOf(lead: string): number {
  return Math.min(3, Math.floor(lead.length / 2));
}

/** Parse konten jadi baris berstruktur. Murah (≤ 5.000 karakter). */
export function parseNoteLines(content: string): NoteLine[] {
  const raw = content.split('\n');
  const out: NoteLine[] = [];
  let run = 0;
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i] ?? '';
    if (!line.trim()) {
      out.push({ lineIndex: i, kind: 'paragraph', indent: 0, text: '', empty: true });
      run = 0;
      continue;
    }
    const heading = RE_HEADING.exec(line);
    if (heading) {
      out.push({ lineIndex: i, kind: 'heading', indent: 0, level: heading[1].length, text: heading[2] ?? '' });
      run = 0;
      continue;
    }
    const check = RE_CHECK.exec(line);
    if (check) {
      out.push({
        lineIndex: i,
        kind: 'check',
        indent: indentOf(check[1] ?? ''),
        text: check[3] ?? '',
        checked: (check[2] ?? ' ').toLowerCase() === 'x',
      });
      run = 0;
      continue;
    }
    const number = RE_NUMBER.exec(line);
    if (number) {
      run += 1;
      out.push({
        lineIndex: i,
        kind: 'number',
        indent: indentOf(number[1] ?? ''),
        text: number[4] ?? '',
        order: run,
      });
      continue;
    }
    const bullet = RE_BULLET.exec(line);
    if (bullet) {
      out.push({ lineIndex: i, kind: 'bullet', indent: indentOf(bullet[1] ?? ''), text: bullet[2] ?? '' });
      run = 0;
      continue;
    }
    out.push({ lineIndex: i, kind: 'paragraph', indent: 0, text: line });
    run = 0;
  }
  return out;
}

/** Deteksi penanda daftar di awal baris (untuk editor). */
export function detectListMarker(raw: string): ListMarkerInfo | null {
  const check = RE_CHECK.exec(raw);
  if (check) {
    return { kind: 'check', indent: indentOf(check[1] ?? ''), markerLen: raw.length - (check[3] ?? '').length, num: 0 };
  }
  const number = RE_NUMBER.exec(raw);
  if (number) {
    return {
      kind: 'number',
      indent: indentOf(number[1] ?? ''),
      markerLen: raw.length - (number[4] ?? '').length,
      num: Number.parseInt(number[2] ?? '0', 10) || 0,
    };
  }
  const bullet = RE_BULLET.exec(raw);
  if (bullet) {
    return { kind: 'bullet', indent: indentOf(bullet[1] ?? ''), markerLen: raw.length - (bullet[2] ?? '').length, num: 0 };
  }
  return null;
}

/** Lepas semua penanda (heading/daftar) dari awal baris — untuk tombol toolbar. */
export function stripLineMarker(raw: string): { lead: string; body: string } {
  const lead = /^[ \t]*/.exec(raw)?.[0] ?? '';
  const rest = raw.slice(lead.length);
  const body = rest
    .replace(/^#{1,3}[ \t]+/, '')
    .replace(/^[-*][ \t]+\[( |x|X)\][ \t]*/, '')
    .replace(/^[-*][ \t]+/, '')
    .replace(/^\d+[.)][ \t]+/, '');
  return { lead, body };
}

/** Render inline **tebal** dan *miring* → elemen React (aman XSS). */
export function renderNoteInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let key = 0;
  const pushItalic = (segment: string) => {
    for (const piece of segment.split(/(\*[^*\n]+\*)/g)) {
      if (!piece) continue;
      if (piece.length > 2 && piece.startsWith('*') && piece.endsWith('*')) {
        parts.push(<em key={key++}>{piece.slice(1, -1)}</em>);
      } else {
        parts.push(<span key={key++}>{piece}</span>);
      }
    }
  };
  for (const piece of text.split(/(\*\*[^*\n]+\*\*)/g)) {
    if (!piece) continue;
    if (piece.length > 4 && piece.startsWith('**') && piece.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-bold">
          {piece.slice(2, -2)}
        </strong>
      );
    } else {
      pushItalic(piece);
    }
  }
  return parts;
}

/** Teks polos tanpa penanda inline (untuk judul/pencarian/aria). */
export function stripNoteInline(text: string): string {
  return text.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
}

/** Toggle [ ] ↔ [x] pada baris ke-lineIndex → konten baru. */
export function toggleNoteCheck(content: string, lineIndex: number): string {
  const lines = content.split('\n');
  const raw = lines[lineIndex];
  if (raw === undefined) return content;
  const check = RE_CHECK.exec(raw);
  if (!check) return content;
  const wasChecked = (check[2] ?? ' ').toLowerCase() === 'x';
  lines[lineIndex] = raw.replace(/\[( |x|X)\]/, wasChecked ? '[ ]' : '[x]');
  return lines.join('\n');
}

/** Judul kartu = baris pertama bermakna tanpa penanda (potong 60). */
export function noteTitleOf(content: string): string {
  const first = parseNoteLines(content).find((l) => !l.empty);
  if (!first) return 'Catatan';
  const text = stripNoteInline(first.text).trim();
  if (!text) return 'Catatan';
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** Baris pratinjau kartu: lewati baris judul, ambil N baris bermakna berikutnya. */
export function notePreviewLines(content: string, count = 2): NoteLine[] {
  const meaningful = parseNoteLines(content).filter((l) => !l.empty);
  return meaningful.slice(1, 1 + count);
}

/** Teks polos 2 baris pertama (untuk hasil pencarian). */
export function notePlainPreview(content: string, maxLines = 2): string {
  return parseNoteLines(content)
    .filter((l) => !l.empty)
    .slice(0, maxLines)
    .map((l) => stripNoteInline(l.text).trim())
    .filter(Boolean)
    .join(' ');
}

/** Statistik: kata, huruf, progres centang. */
export function noteStats(content: string): { words: number; chars: number; checks: number; checksDone: number } {
  let checks = 0;
  let checksDone = 0;
  for (const line of parseNoteLines(content)) {
    if (line.kind === 'check') {
      checks += 1;
      if (line.checked) checksDone += 1;
    }
  }
  const plain = stripNoteInline(content).trim();
  const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
  return { words, chars: content.length, checks, checksDone };
}

/** Kotak centang catatan — dipakai mode baca dialog + pratinjau kartu. */
export function NoteCheckBox({
  checked,
  label,
  onToggle,
  disabled,
}: {
  checked: boolean;
  label: string;
  onToggle?: () => void;
  disabled?: boolean;
}) {
  const name = label.trim() || 'item';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Tandai ${name} belum selesai` : `Tandai ${name} selesai`}
      disabled={disabled}
      onClick={onToggle}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-90 disabled:cursor-default disabled:active:scale-100"
    >
      <span
        className={cn(
          'grid h-[18px] w-[18px] place-items-center rounded-[6px] border-2 transition-colors',
          checked
            ? 'premium-fab-shadow border-transparent bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white'
            : 'border-muted-foreground/40'
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden="true" />}
      </span>
    </button>
  );
}

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-3 mb-0.5 text-[15px] font-extrabold text-foreground',
  2: 'mt-2.5 mb-0.5 text-[14px] font-bold text-foreground',
  3: 'mt-2 text-[13.5px] font-bold text-foreground/90',
};

/** Renderer utama: konten markdown-lite → React. onToggleCheck interaktif. */
export function NoteMarkdown({
  content,
  onToggleCheck,
  className,
}: {
  content: string;
  onToggleCheck?: (lineIndex: number) => void;
  className?: string;
}) {
  const lines = parseNoteLines(content).filter((l) => !l.empty);
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) break;

    if (line.kind === 'bullet' || line.kind === 'check') {
      const group: NoteLine[] = [];
      while (i < lines.length && (lines[i]?.kind === 'bullet' || lines[i]?.kind === 'check')) {
        group.push(lines[i] as NoteLine);
        i += 1;
      }
      blocks.push(
        <ul key={`b${key++}`} className="my-1.5 space-y-1">
          {group.map((item) => (
            <li key={item.lineIndex} className="flex items-start gap-2" style={{ marginLeft: item.indent * 16 }}>
              {item.kind === 'check' ? (
                <NoteCheckBox
                  checked={!!item.checked}
                  label={stripNoteInline(item.text)}
                  disabled={!onToggleCheck}
                  onToggle={() => onToggleCheck?.(item.lineIndex)}
                />
              ) : (
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" aria-hidden="true" />
              )}
              <span
                className={cn(
                  'min-w-0 flex-1',
                  item.kind === 'check' && item.checked && 'text-muted-foreground/70 line-through'
                )}
              >
                {renderNoteInline(item.text)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.kind === 'number') {
      const group: NoteLine[] = [];
      while (i < lines.length && lines[i]?.kind === 'number') {
        group.push(lines[i] as NoteLine);
        i += 1;
      }
      blocks.push(
        <ol key={`b${key++}`} className="my-1.5 space-y-1">
          {group.map((item) => (
            <li key={item.lineIndex} className="flex items-start gap-2" style={{ marginLeft: item.indent * 16 }}>
              <span className="w-4 shrink-0 pt-[1px] text-right text-[12px] font-bold tabular-nums text-primary/70">
                {item.order}.
              </span>
              <span className="min-w-0 flex-1">{renderNoteInline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.kind === 'heading') {
      blocks.push(
        <p key={`b${key++}`} className={HEADING_CLASS[line.level ?? 2]}>
          {renderNoteInline(line.text)}
        </p>
      );
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`b${key++}`} className="my-1.5">
        {renderNoteInline(line.text)}
      </p>
    );
    i += 1;
  }

  return <div className={cn('work-serif text-[13.5px] leading-relaxed text-foreground/90', className)}>{blocks}</div>;
}
