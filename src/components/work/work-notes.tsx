// ---------------------------------------------------------------------------
// src/components/work/work-notes.tsx — sub-tab "Catatan" (Task 17-a, upgrade
// Task 26 Fase 1+2 hasil riset aplikasi catatan profesional):
//   - Catatan kilat 1 baris (tetap) + tombol "Catatan panjang".
//   - Dialog dua mode: BACA (render bullet/centang/nomor, centang interaktif)
//     dan UBAH (editor pintar + simpan otomatis saat jeda mengetik).
//   - Kartu: judul + pratinjau bullet/centang + progres centang + "diedit".
//   - Pencarian kilat (debounce 400ms) + chip tag + kartu warna lembut.
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, NotebookPen, Pencil, Pin, PinOff, Plus, Search, StickyNote, Trash2, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeleteNote, useSaveNote, useToggleNoteCheck, useToggleNotePin, useWorkSearch } from './use-work-api';
import { NOTE_CONTENT_MAX, type WorkNoteItem, type WorkPayload, type WorkTaskItem } from './work-types';
import { EmptyHint, GroupLabel, MiniSpinner, WorkLoadError } from './work-shared';
import {
  NoteCheckBox,
  NoteMarkdown,
  notePlainPreview,
  notePreviewLines,
  noteStats,
  noteTitleOf,
  renderNoteInline,
  toggleNoteCheck,
} from './note-markdown';
import { NoteEditor } from './note-editor';

/** Warna kartu: pin = kuning lembut; selain itu rotasi mint/rose/sky stabil per id. */
function noteCardClass(note: WorkNoteItem, index: number): string {
  if (note.pinned) return 'work-note-card-pin';
  const palette = ['work-note-card-mint', 'work-note-card-rose', 'work-note-card-sky'];
  return palette[index % palette.length];
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
          placeholder="Catatan kilat 1 baris, tekan Enter…"
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

// ── Dialog catatan: mode BACA + UBAH ───────────────────────────────────────

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface NoteDraft {
  id: string | null;
  content: string;
  tag: string;
}

function SaveStatusChip({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'idle') return null;
  if (state === 'dirty') {
    return (
      <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground" aria-live="polite">
        <span className="h-1.5 w-1.5 rounded-full bg-warning/80" aria-hidden="true" />
        Belum tersimpan — otomatis sebentar lagi
      </p>
    );
  }
  if (state === 'saving') {
    return (
      <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground" aria-live="polite">
        <MiniSpinner className="h-3 w-3" />
        Menyimpan…
      </p>
    );
  }
  if (state === 'saved') {
    return (
      <p className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400" aria-live="polite">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Tersimpan
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onRetry}
      className="text-[10.5px] font-bold text-destructive underline underline-offset-2"
    >
      Gagal menyimpan — ketuk untuk coba lagi
    </button>
  );
}

function NoteDialog({
  draft,
  mode,
  saveState,
  confirmDelete,
  data,
  onModeChange,
  onDraftChange,
  onToggleCheck,
  onRetrySave,
  onDelete,
  onClose,
  deletePending,
}: {
  draft: NoteDraft;
  mode: 'read' | 'edit';
  saveState: SaveState;
  confirmDelete: boolean;
  data: WorkPayload | undefined;
  onModeChange: (mode: 'read' | 'edit') => void;
  onDraftChange: (draft: NoteDraft) => void;
  onToggleCheck: (lineIndex: number) => void;
  onRetrySave: () => void;
  onDelete: () => void;
  onClose: () => void;
  deletePending: boolean;
}) {
  const stats = noteStats(draft.content);
  const note = data?.notes.find((n) => n.id === draft.id);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="custom-scrollbar max-h-[88dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            {mode === 'edit' ? (
              'Tulis Catatan'
            ) : (
              <span className="truncate">{noteTitleOf(draft.content)}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Ketik minus lalu spasi untuk bullet, angka lalu titik untuk nomor — Enter melanjutkan daftar.'
              : `diedit ${note ? formatRelative(note.updatedAt) : 'baru saja'}`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[18px]">
          <SaveStatusChip state={saveState} onRetry={onRetrySave} />
        </div>

        {mode === 'read' ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted-foreground">
              <span>{stats.words.toLocaleString('id-ID')} kata</span>
              {stats.checks > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-[2px] font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ {stats.checksDone}/{stats.checks} selesai
                </span>
              )}
              {draft.tag && (
                <span className="rounded-full bg-warning/10 px-2 py-[2px] font-bold text-warning">
                  #{draft.tag}
                </span>
              )}
            </div>
            <NoteMarkdown content={draft.content} onToggleCheck={onToggleCheck} />
          </div>
        ) : (
          <div className="space-y-2.5">
            <NoteEditor
              // key TANPA draft.id: id catatan baru bisa datang di tengah sesi
              // mengetik (autosave pertama) — memasukkan id ke key akan
              // me-remount textarea dan mencuri fokus + posisi kursor user.
              key={mode}
              value={draft.content}
              onChange={(content) => onDraftChange({ ...draft, content })}
              maxChars={NOTE_CONTENT_MAX}
              autoFocus
            />
            <Input
              value={draft.tag}
              onChange={(e) => onDraftChange({ ...draft, tag: e.target.value })}
              placeholder="tag (opsional, tanpa #)"
              maxLength={40}
              aria-label="Tag catatan"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {draft.id ? (
            <Button
              type="button"
              variant="ghost"
              disabled={deletePending}
              onClick={onDelete}
              aria-label={confirmDelete ? 'Klik lagi untuk hapus permanen' : 'Hapus catatan'}
              className={cn(
                'gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive',
                confirmDelete && 'bg-destructive/10 font-bold'
              )}
            >
              {deletePending ? <MiniSpinner /> : <Trash2 className="h-4 w-4" />}
              {confirmDelete && 'Yakin hapus?'}
            </Button>
          ) : (
            <span />
          )}
          {mode === 'read' ? (
            <Button
              type="button"
              className="btn-primary-gradient gap-1.5"
              onClick={() => onModeChange('edit')}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Ubah
            </Button>
          ) : (
            <Button
              type="button"
              className="btn-primary-gradient gap-1.5"
              onClick={() => onModeChange('read')}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Selesai
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Komponen utama ─────────────────────────────────────────────────────────

export function WorkNotes({
  date,
  data,
  isLoading,
  error,
  onRetry,
  onOpenTask,
}: {
  date: string;
  data: WorkPayload | undefined;
  isLoading: boolean;
  /** BUGHUNT-47 (47-e #4): fetch gagal tanpa data cache → kartu error (bukan
   *  skeleton abadi). */
  error: boolean;
  onRetry: () => void;
  onOpenTask: (task: WorkTaskItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Dialog catatan.
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const draftRef = useRef<NoteDraft | null>(null);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Konfirmasi hapus dua langkah: klik 1 = senjatakan, klik 2 = hapus.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedFlash = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const saveNote = useSaveNote(date);
  const deleteNote = useDeleteNote(date);
  const noteCheck = useToggleNoteCheck(date);
  const search = useWorkSearch(debounced);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce 400ms — hindari spam API saat mengetik.
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(debounceTimer.current);
  }, [query]);

  // Bersihkan semua timer saat komponen dilepas.
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(savedFlash.current);
      clearTimeout(confirmTimer.current);
    },
    []
  );

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

  // ── Dialog: simpan otomatis (autosave saat jeda mengetik) ───────────────

  const updateDraft = (next: NoteDraft) => {
    draftRef.current = next;
    setDraft(next);
  };

  const doSave = () => {
    clearTimeout(saveTimer.current);
    const current = draftRef.current;
    if (!current) return;
    const content = current.content.trim();
    if (!content) {
      setSaveState('idle');
      return;
    }
    if (content.length > NOTE_CONTENT_MAX) {
      setSaveState('error');
      return;
    }
    setSaveState('saving');
    saveNote.mutate(
      {
        id: current.id ?? undefined,
        content,
        tag: current.tag.trim() ? current.tag.trim().replace(/^#/, '') : '',
        quiet: true,
      },
      {
        onSuccess: (note) => {
          if (!current.id && note && typeof note === 'object' && 'id' in note) {
            const newId = String((note as { id: unknown }).id);
            // Task 30 (bug: catatan ganda saat edit): id catatan baru HARUS
            // disinkronkan ke STATE juga, bukan hanya draftRef. Tanpa ini,
            // ketukan berikutnya menyusun draft dari state yang masih id:null
            // → menimpa draftRef → autosave berikutnya POST lagi → muncul
            // catatan duplikat pada tiap jeda ketik ("edit malah tambah baru").
            if (draftRef.current) draftRef.current = { ...draftRef.current, id: newId };
            setDraft((prev) => (prev && !prev.id ? { ...prev, id: newId } : prev));
          }
          setSaveState('saved');
          clearTimeout(savedFlash.current);
          savedFlash.current = setTimeout(() => setSaveState('idle'), 1800);
        },
        onError: () => setSaveState('error'),
      }
    );
  };

  const scheduleSave = (delay = 900) => {
    clearTimeout(saveTimer.current);
    setSaveState('dirty');
    saveTimer.current = setTimeout(() => doSave(), delay);
  };

  const openNote = (note: WorkNoteItem) => {
    clearTimeout(saveTimer.current);
    setConfirmDelete(false);
    setSaveState('idle');
    setMode('read');
    const next: NoteDraft = { id: note.id, content: note.content, tag: note.tag ?? '' };
    draftRef.current = next;
    setDraft(next);
  };

  const openNew = () => {
    clearTimeout(saveTimer.current);
    setConfirmDelete(false);
    setSaveState('idle');
    setMode('edit');
    const next: NoteDraft = { id: null, content: '', tag: '' };
    draftRef.current = next;
    setDraft(next);
  };

  const closeDialog = () => {
    // Ada perubahan yang belum terkirim? Kirim dulu (fire-and-forget).
    if (saveState === 'dirty') doSave();
    clearTimeout(saveTimer.current);
    clearTimeout(confirmTimer.current);
    setConfirmDelete(false);
    setSaveState('idle');
    setMode('read');
    draftRef.current = null;
    setDraft(null);
  };

  // Ubah → Baca ("Selesai"): simpan segera; catatan baru kosong = batal.
  const handleModeToRead = () => {
    const current = draftRef.current;
    if (!current) return;
    if (!current.content.trim()) {
      if (!current.id) {
        closeDialog();
        return;
      }
      const original = data?.notes.find((n) => n.id === current.id);
      updateDraft({ ...current, content: original?.content ?? current.content });
      setSaveState('idle');
      setMode('read');
      return;
    }
    doSave();
    setMode('read');
  };

  // Tombol hapus dua langkah: tekan pertama mengubah jadi "Yakin?", kedua
  // baru benar-benar menghapus; senjatakan ulang otomatis setelah 4 detik.
  const handleDeleteNote = () => {
    const current = draftRef.current;
    if (!current?.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    clearTimeout(confirmTimer.current);
    clearTimeout(saveTimer.current);
    deleteNote.mutate(current.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        setSaveState('idle');
        setMode('read');
        draftRef.current = null;
        setDraft(null);
      },
    });
  };

  // Centang interaktif di mode BACA: update lokal + simpan senyap.
  const handleDialogToggleCheck = (lineIndex: number) => {
    const current = draftRef.current;
    if (!current) return;
    const next = toggleNoteCheck(current.content, lineIndex);
    updateDraft({ ...current, content: next });
    if (current.id) {
      noteCheck.mutate({ id: current.id, content: next });
    } else {
      scheduleSave(300);
    }
  };

  // Centang interaktif di kartu (optimistik via hook).
  const handleCardToggleCheck = (note: WorkNoteItem, lineIndex: number) => {
    noteCheck.mutate({ id: note.id, content: toggleNoteCheck(note.content, lineIndex) });
  };

  const onDraftChange = (next: NoteDraft) => {
    updateDraft(next);
    scheduleSave();
  };

  return (
    <div className="pt-1">
      <KilatInput date={date} />

      <button
        type="button"
        onClick={openNew}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 text-xs font-bold text-primary/80 transition-all hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Catatan panjang — bullet, centang &amp; format
      </button>

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
          onOpenNote={openNote}
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

          {/* BUGHUNT-47 (47-e #4): error fetch tanpa data cache — kartu error
              + coba lagi, bukan skeleton abadi. */}
          {error && !data ? (
            <div className="mt-3">
              <WorkLoadError
                title="Catatan gagal dimuat"
                hint="Koneksi ke server terputus saat mengambil catatan."
                onRetry={onRetry}
              />
            </div>
          ) : isLoading || !data ? (
            <div className="mt-3 space-y-2.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/60" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="mt-3">
              <EmptyHint
                icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
                title={activeTag ? `Belum ada catatan #${activeTag}` : 'Rak catatan masih kosong'}
                hint="Tulis hal kecil lewat catatan kilat — atau buka Catatan panjang untuk bullet, kotak centang, dan format tebal."
              />
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              {visibleNotes.map((note, index) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={index}
                  date={date}
                  onOpen={openNote}
                  onToggleCheck={handleCardToggleCheck}
                />
              ))}
            </div>
          )}
        </>
      )}

      {draft && (
        <NoteDialog
          draft={draft}
          mode={mode}
          saveState={saveState}
          confirmDelete={confirmDelete}
          data={data}
          deletePending={deleteNote.isPending}
          onModeChange={(next) => {
            if (next === 'read') handleModeToRead();
            else setMode('edit');
          }}
          onDraftChange={onDraftChange}
          onToggleCheck={handleDialogToggleCheck}
          onRetrySave={doSave}
          onDelete={handleDeleteNote}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
