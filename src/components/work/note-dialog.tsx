// ---------------------------------------------------------------------------
// src/components/work/note-dialog.tsx — dialog catatan dua mode BACA/UBAH
// (pecahan Task 71-e dari work-notes.tsx): render markdown interaktif saat
// membaca, editor pintar + tag saat mengubah, chip status autosave, dan
// tombol hapus dua langkah. State machine-nya ada di work-notes-autosave.ts.
// ---------------------------------------------------------------------------
'use client';

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
import { Check, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NOTE_CONTENT_MAX, type WorkPayload } from './work-types';
import { MiniSpinner } from './work-shared';
import { NoteMarkdown, noteStats, noteTitleOf } from './note-markdown';
import { NoteEditor } from './note-editor';
import { formatRelative } from './work-notes-utils';
import type { NoteDraft, SaveState } from './work-notes-autosave';

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

export function NoteDialog({
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
