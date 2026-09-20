// ---------------------------------------------------------------------------
// src/components/work/note-card.tsx — kartu catatan di rak sub-tab Catatan
// (pecahan Task 71-e dari work-notes.tsx): judul + pratinjau bullet/centang +
// progres centang + tombol sematkan.
// ---------------------------------------------------------------------------
'use client';

import { Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToggleNotePin } from './use-work-api';
import type { WorkNoteItem } from './work-types';
import { NoteCheckBox, notePreviewLines, noteStats, noteTitleOf, renderNoteInline } from './note-markdown';
import { formatRelative, noteCardClass } from './work-notes-utils';

export function NoteCard({
  note,
  index,
  date,
  onOpen,
  onToggleCheck,
}: {
  note: WorkNoteItem;
  index: number;
  date: string;
  onOpen: (note: WorkNoteItem) => void;
  onToggleCheck: (note: WorkNoteItem, lineIndex: number) => void;
}) {
  const togglePin = useToggleNotePin(date);
  const title = noteTitleOf(note.content);
  const preview = notePreviewLines(note.content, 2);
  const stats = noteStats(note.content);
  const openLabel = `Buka catatan ${title}`;

  return (
    <article
      className={cn(
        'relative rounded-2xl border p-4 transition-shadow hover:shadow-md',
        noteCardClass(note, index)
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(note)}
        aria-label={openLabel}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-2xl"
      >
        <h3 className="pr-9 text-[13.5px] font-bold text-foreground">{title}</h3>
      </button>

      {preview.map((line) =>
        line.kind === 'check' ? (
          <div key={line.lineIndex} className="mt-1 flex items-start gap-1.5">
            <NoteCheckBox
              checked={!!line.checked}
              label={line.text}
              onToggle={() => onToggleCheck(note, line.lineIndex)}
            />
            <button
              type="button"
              onClick={() => onOpen(note)}
              aria-label={openLabel}
              className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-lg"
            >
              <span
                className={cn(
                  'work-serif block text-[13px] leading-relaxed line-clamp-1',
                  line.checked ? 'text-foreground/50 line-through' : 'text-foreground/70'
                )}
              >
                {renderNoteInline(line.text)}
              </span>
            </button>
          </div>
        ) : (
          <button
            key={line.lineIndex}
            type="button"
            onClick={() => onOpen(note)}
            aria-label={openLabel}
            className="mt-1 flex w-full items-start gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-lg"
          >
            {line.kind === 'bullet' && (
              <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/30" aria-hidden="true" />
            )}
            {line.kind === 'number' && (
              <span className="w-4 shrink-0 pt-[1px] text-right text-[12px] font-bold tabular-nums text-foreground/40">
                {line.order}.
              </span>
            )}
            <span
              className={cn(
                'work-serif min-w-0 flex-1 text-[13px] leading-relaxed line-clamp-1 text-foreground/70',
                line.kind === 'heading' && 'font-bold text-foreground/80'
              )}
            >
              {renderNoteInline(line.text)}
            </span>
          </button>
        )
      )}

      <p className="mt-2 text-[10.5px] tracking-[0.03em] text-muted-foreground">
        {note.tag ? `#${note.tag} · ` : ''}
        {note.pinned ? 'Disematkan · ' : ''}
        {stats.checks > 0 ? `✓ ${stats.checksDone}/${stats.checks} · ` : ''}
        {`diedit ${formatRelative(note.updatedAt)}`}
      </p>

      <button
        type="button"
        onClick={() => togglePin.mutate({ id: note.id, pinned: !note.pinned })}
        aria-label={note.pinned ? 'Lepas sematan catatan' : 'Sematkan catatan'}
        aria-pressed={note.pinned}
        className={cn(
          'absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          note.pinned
            ? 'text-warning dark:text-warning/80'
            : 'text-muted-foreground/40 hover:text-warning dark:hover:text-warning/80'
        )}
      >
        {note.pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
      </button>
    </article>
  );
}
