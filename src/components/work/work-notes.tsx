// ---------------------------------------------------------------------------
// src/components/work/work-notes.tsx — sub-tab "Catatan" (Task 17-a):
// pencarian kilat (debounce 400ms) + chip tag + kartu catatan warna lembut.
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Pin, PinOff, Search, StickyNote, Trash2, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeleteNote, useSaveNote, useToggleNotePin, useWorkSearch } from './use-work-api';
import type { WorkNoteItem, WorkPayload, WorkTaskItem } from './work-types';
import { EmptyHint, GroupLabel, MiniSpinner } from './work-shared';

/** Warna kartu: pin = kuning lembut; selain itu rotasi mint/rose/sky stabil per id. */
function noteCardClass(note: WorkNoteItem, index: number): string {
  if (note.pinned) return 'work-note-card-pin';
  const palette = ['work-note-card-mint', 'work-note-card-rose', 'work-note-card-sky'];
  return palette[index % palette.length];
}

/** Judul kartu = baris pertama konten (dipotong); pratinjau = sisanya. */
function splitNote(content: string): { title: string; preview: string | null } {
  const [first, ...rest] = content.split('\n');
  const title = first.length > 60 ? `${first.slice(0, 57)}…` : first;
  const preview = rest.join('\n').trim();
  return { title, preview: preview || null };
}

function formatRelative(iso: string): string {
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
function Highlight({ text, needle }: { text: string; needle: string }) {
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

function KilatInput({ date }: { date: string }) {
  const saveNote = useSaveNote(date);
  const [draft, setDraft] = useState('');
  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft('');
    saveNote.mutate({ content: trimmed });
  };
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Zap className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-warning" aria-hidden="true" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Tulis catatan kilat, tekan Enter…"
          aria-label="Tulis catatan kilat"
          maxLength={200}
          className="pl-9"
        />
      </div>
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={!draft.trim() || saveNote.isPending}
        aria-label="Simpan catatan"
        className="btn-primary-gradient shrink-0"
      >
        {saveNote.isPending ? <MiniSpinner className="text-white" /> : <Check className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function NoteCard({
  note,
  index,
  date,
  onEdit,
}: {
  note: WorkNoteItem;
  index: number;
  date: string;
  onEdit: (note: WorkNoteItem) => void;
}) {
  const togglePin = useToggleNotePin(date);
  const { title, preview } = splitNote(note.content);
  return (
    <article
      className={cn(
        'relative rounded-2xl border p-4 transition-shadow hover:shadow-md',
        noteCardClass(note, index)
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(note)}
        aria-label={`Buka catatan ${title}`}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-2xl"
      >
        <h3 className="pr-9 text-[13.5px] font-bold text-foreground">{title}</h3>
        {preview && (
          <p className="work-serif mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-foreground/70">{preview}</p>
        )}
        <p className="mt-2 text-[10.5px] tracking-[0.03em] text-muted-foreground">
          {note.tag ? `#${note.tag} · ` : ''}
          {note.pinned ? 'Disematkan · ' : ''}
          {formatRelative(note.updatedAt)}
        </p>
      </button>
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

function SearchResults({
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
                      <Highlight text={note.content} needle={q} />
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Catatan{note.tag ? ` · #${note.tag}` : ''} · {formatRelative(note.updatedAt)}
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

export function WorkNotes({
  date,
  data,
  isLoading,
  onOpenTask,
}: {
  date: string;
  data: WorkPayload | undefined;
  isLoading: boolean;
  onOpenTask: (task: WorkTaskItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkNoteItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTag, setEditTag] = useState('');
  const saveNote = useSaveNote(date);
  const deleteNote = useDeleteNote(date);
  const search = useWorkSearch(debounced);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce 400ms — hindari spam API saat mengetik.
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const note of data?.notes ?? []) {
      if (note.tag) set.add(note.tag);
    }
    return [...set].sort();
  }, [data?.notes]);

  const searching = debounced.length >= 2;
  const visibleNotes = useMemo(() => {
    if (!data) return [];
    return activeTag ? data.notes.filter((n) => n.tag === activeTag) : data.notes;
  }, [data, activeTag]);

  const openNoteEditor = (note: WorkNoteItem) => {
    setEditing(note);
    setEditContent(note.content);
    setEditTag(note.tag ?? '');
  };

  return (
    <div className="pt-1">
      <KilatInput date={date} />

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari di semua catatan & tugas…"
          aria-label="Cari catatan dan tugas"
          className="pl-9"
          inputMode="search"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDebounced('');
            }}
            aria-label="Bersihkan pencarian"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {searching ? (
        <SearchResults
          q={debounced}
          result={search.data}
          isFetching={search.isFetching}
          onOpenTask={onOpenTask}
          onOpenNote={openNoteEditor}
        />
      ) : (
        <>
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter tag">
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                aria-pressed={activeTag === null}
                className={cn(
                  'min-h-11 rounded-full border px-3.5 text-xs font-bold transition-colors',
                  activeTag === null
                    ? 'border-transparent bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white premium-fab-shadow'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent/70'
                )}
              >
                Semua
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  aria-pressed={activeTag === tag}
                  className={cn(
                    'min-h-11 rounded-full border px-3.5 text-xs font-bold transition-colors',
                    activeTag === tag
                      ? 'border-transparent bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white premium-fab-shadow'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent/70'
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {isLoading || !data ? (
            <div className="mt-3 space-y-2.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/60" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="mt-3">
              <EmptyHint
                icon={<StickyNote className="h-5 w-5" aria-hidden="true" />}
                title={activeTag ? `Belum ada catatan #${activeTag}` : 'Rak catatan masih kosong'}
                hint="Tulis hal kecil yang nggak perlu jadi tugas — ide, link, info dari chat. Nanti tinggal dicari satu kata."
              />
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              {visibleNotes.map((note, index) => (
                <NoteCard key={note.id} note={note} index={index} date={date} onEdit={openNoteEditor} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialog edit catatan */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Catatan</DialogTitle>
            <DialogDescription>Ubah isi, tag, atau hapus kalau sudah nggak kepakai.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={5}
            maxLength={2000}
            autoFocus
            aria-label="Isi catatan"
            className="work-serif"
          />
          <Input
            value={editTag}
            onChange={(e) => setEditTag(e.target.value)}
            placeholder="tag (opsional, tanpa #)"
            maxLength={40}
            aria-label="Tag catatan"
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={deleteNote.isPending}
              onClick={() => {
                if (!editing) return;
                deleteNote.mutate(editing.id, { onSuccess: () => setEditing(null) });
              }}
              aria-label="Hapus catatan"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {deleteNote.isPending ? <MiniSpinner /> : <Trash2 className="h-4 w-4" />}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Batal
              </Button>
              <Button
                type="button"
                className="btn-primary-gradient"
                disabled={!editContent.trim() || saveNote.isPending}
                onClick={() => {
                  if (!editing || !editContent.trim()) return;
                  saveNote.mutate(
                    {
                      id: editing.id,
                      content: editContent.trim(),
                      tag: editTag.trim() ? editTag.trim().replace(/^#/, '') : '',
                    },
                    { onSuccess: () => setEditing(null) }
                  );
                }}
              >
                {saveNote.isPending ? <MiniSpinner className="text-white" /> : 'Simpan'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
