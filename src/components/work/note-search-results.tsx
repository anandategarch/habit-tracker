// ---------------------------------------------------------------------------
// src/components/work/note-search-results.tsx — hasil pencarian catatan &
// tugas di sub-tab Catatan (pecahan Task 71-e dari work-notes.tsx).
// ---------------------------------------------------------------------------
'use client';

import { Search, StickyNote } from 'lucide-react';
import type { WorkNoteItem, WorkTaskItem } from './work-types';
import { EmptyHint, GroupLabel } from './work-shared';
import { notePlainPreview } from './note-markdown';
import { Highlight, formatRelative } from './work-notes-utils';

export function SearchResults({
  q,
  result,
  isFetching,
  onOpenTask,
  onOpenNote,
}: {
  q: string;
  result: { tasks: WorkTaskItem[]; notes: WorkNoteItem[] } | undefined;
  isFetching: boolean;
  onOpenTask: (task: WorkTaskItem) => void;
  onOpenNote: (note: WorkNoteItem) => void;
}) {
  const tasks = result?.tasks ?? [];
  const notes = result?.notes ?? [];
  const total = tasks.length + notes.length;
  return (
    <div>
      <p className="mb-2 mt-4 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/80">
        {isFetching ? 'MENCARI…' : `${total} HASIL · TUGAS & CATATAN`}
      </p>
      {total === 0 && !isFetching && (
        <EmptyHint
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title={`Nggak ketemu “${q}”`}
          hint="Coba kata yang lebih pendek — pencarian mengecek judul, catatan, isi, dan tag."
        />
      )}
      {tasks.length > 0 && (
        <>
          <GroupLabel>Tugas</GroupLabel>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="premium-list-item w-full px-3 py-2.5 text-left anim-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-foreground">
                      <Highlight text={task.title} needle={q} />
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      Tugas · {task.status === 'selesai' ? 'sudah selesai' : task.overdue ? 'lewat tenggat' : task.kapanSaja ? 'kapan saja' : 'belum selesai'}
                      {task.notes ? ` · ${task.notes}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {notes.length > 0 && (
        <>
          <GroupLabel>Catatan</GroupLabel>
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onOpenNote(note)}
                  className="premium-list-item w-full px-3 py-2.5 text-left anim-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
                    <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="work-serif block truncate text-[13.5px] text-foreground">
                      <Highlight text={notePlainPreview(note.content)} needle={q} />
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Catatan{note.tag ? ` · #${note.tag}` : ''} · diedit {formatRelative(note.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
