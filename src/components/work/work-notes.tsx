// ---------------------------------------------------------------------------
// src/components/work/work-notes.tsx — sub-tab "Catatan" (Task 17-a, upgrade
// Task 26 Fase 1+2 hasil riset aplikasi catatan profesional):
//   - Catatan kilat 1 baris (tetap) + tombol "Catatan panjang".
//   - Dialog dua mode: BACA (render bullet/centang/nomor, centang interaktif)
//     dan UBAH (editor pintar + simpan otomatis saat jeda menetik).
//   - Kartu: judul + pratinjau bullet/centang + progres centang + "diedit".
//   - Pencarian kilat (debounce 400ms) + chip tag + kartu warna lembut.
// Task 71-e: file dipecah — akar komposisi saja; kartu → note-card.tsx, input
// kilat → note-kilat-input.tsx, hasil cari → note-search-results.tsx, dialog
// → note-dialog.tsx, mesin autosave → work-notes-autosave.ts, helper →
// work-notes-utils.tsx.
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { NotebookPen, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkSearch } from './use-work-api';
import type { WorkPayload, WorkTaskItem } from './work-types';
import { EmptyHint, WorkLoadError } from './work-shared';
import { KilatInput } from './note-kilat-input';
import { NoteCard } from './note-card';
import { SearchResults } from './note-search-results';
import { NoteDialog } from './note-dialog';
import { useNoteDialog } from './work-notes-autosave';

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

  // Dialog catatan (draft + autosave + hapus dua langkah).
  const dialog = useNoteDialog(date, data);

  const search = useWorkSearch(debounced);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce 400ms — hindari spam API saat menetik.
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

  return (
    <div className="pt-1">
      <KilatInput date={date} />

      <button
        type="button"
        onClick={dialog.openNew}
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
          onOpenNote={dialog.openNote}
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
                  onOpen={dialog.openNote}
                  onToggleCheck={dialog.handleCardToggleCheck}
                />
              ))}
            </div>
          )}
        </>
      )}

      {dialog.draft && (
        <NoteDialog
          draft={dialog.draft}
          mode={dialog.mode}
          saveState={dialog.saveState}
          confirmDelete={dialog.confirmDelete}
          data={data}
          deletePending={dialog.deletePending}
          onModeChange={dialog.handleModeChange}
          onDraftChange={dialog.onDraftChange}
          onToggleCheck={dialog.handleDialogToggleCheck}
          onRetrySave={dialog.doSave}
          onDelete={dialog.handleDeleteNote}
          onClose={dialog.closeDialog}
        />
      )}
    </div>
  );
}
