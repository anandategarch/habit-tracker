// ---------------------------------------------------------------------------
// src/components/work/work-task-editor.tsx — Sheet editor tugas lepas
// (Task 17-a). Buka dengan tap judul tugas di tab Hari Ini (atau hasil cari).
// Form = komponen terpisah yang di-remount per target (key) supaya state
// selalu segar tanpa setState-in-effect.
// ---------------------------------------------------------------------------
'use client';

import { useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CalendarDays, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeleteTask, useSaveTask } from './use-work-api';
import { WORK_TASK_STATUSES, type WorkTaskItem } from './work-types';
import { MiniSpinner } from './work-shared';

export interface TaskEditorState {
  task: WorkTaskItem | null;
  /** Mode tambah: judul awal dari input cepat (opsional). */
  draftTitle?: string;
}

export function WorkTaskEditor({
  date,
  state,
  onClose,
}: {
  date: string;
  state: TaskEditorState;
  onClose: () => void;
}) {
  const open = state.task !== null || state.draftTitle !== undefined;
  const formKey = state.task ? `edit-${state.task.id}` : `new-${state.draftTitle ?? ''}`;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-[88dvh] w-full flex-col gap-0 rounded-t-3xl border-t bg-card p-0 md:max-w-lg md:rounded-3xl"
      >
        <SheetHeader className="space-y-1 border-b border-border/70 px-5 pt-5 pb-4">
          <SheetTitle className="text-left text-base">
            {state.task ? 'Edit Tugas' : 'Tugas Baru'}
          </SheetTitle>
          <SheetDescription className="text-left text-xs">
            Judul, catatan, status, dan tanggal target — semua bisa diubah kapan saja.
          </SheetDescription>
        </SheetHeader>

        {open && (
          <TaskEditorForm key={formKey} date={date} task={state.task} draftTitle={state.draftTitle} onClose={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskEditorForm({
  date,
  task,
  draftTitle,
  onClose,
}: {
  date: string;
  task: WorkTaskItem | null;
  draftTitle?: string;
  onClose: () => void;
}) {
  const saveTask = useSaveTask(date);
  const deleteTask = useDeleteTask(date);

  const [title, setTitle] = useState(task?.title ?? draftTitle ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [status, setStatus] = useState(task?.status ?? 'todo');
  const [dayKey, setDayKey] = useState<string | null>(task ? task.dayKey : date);
  // Konfirmasi hapus dua langkah (form di-remount per tugas via key, jadi
  // state ini otomatis segar setiap kali editor dibuka untuk tugas lain).
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const busy = saveTask.isPending || deleteTask.isPending;

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    saveTask.mutate(
      {
        ...(task ? { id: task.id } : {}),
        title: trimmed,
        notes: notes.trim() ? notes.trim() : null,
        status,
        dayKey,
      },
      { onSuccess: onClose }
    );
  };

  const handleDelete = () => {
    if (!task) return;
    // Tekan pertama = senjatakan ("Yakin?"), tekan kedua = hapus sungguhan.
    if (!confirmDelete) {
      setConfirmDelete(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 4000);
      return;
    }
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        clearTimeout(confirmTimer.current);
        onClose();
      },
    });
  };

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 custom-scrollbar">
        <div className="space-y-1.5">
          <label htmlFor="task-title" className="text-xs font-semibold text-foreground">
            Judul tugas
          </label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. kirim invoice kantor"
            maxLength={200}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="task-notes" className="text-xs font-semibold text-foreground">
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </label>
          <Textarea
            id="task-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="detail kecil, link, nama orang…"
            rows={3}
            maxLength={2000}
            className="resize-none"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-xs font-semibold text-foreground">Status</legend>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Status tugas">
            {WORK_TASK_STATUSES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={status === option.value}
                onClick={() => setStatus(option.value)}
                className={cn(
                  'min-h-11 rounded-xl border px-2 py-2 text-xs font-bold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  status === option.value
                    ? 'border-transparent bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white premium-fab-shadow'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent/70'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="task-day" className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            Tanggal target
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDayKey(date)}
              className={cn(
                'min-h-11 rounded-xl border px-3 text-xs font-bold transition-colors',
                dayKey === date
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/70'
              )}
            >
              Hari ini
            </button>
            <button
              type="button"
              onClick={() => setDayKey(null)}
              className={cn(
                'min-h-11 rounded-xl border px-3 text-xs font-bold transition-colors',
                dayKey === null
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent/70'
              )}
            >
              Kapan saja
            </button>
            <input
              id="task-day"
              type="date"
              value={dayKey ?? ''}
              onChange={(e) => setDayKey(e.target.value || null)}
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-xs text-foreground"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {dayKey === null
              ? 'Tanpa tanggal — tampil di daftar "kapan saja".'
              : dayKey < date
                ? 'Tanggal sudah lewat — tugas ditandai lewat tenggat.'
                : dayKey === date
                  ? 'Muncul di daftar Hari Ini.'
                  : 'Muncul otomatis di tanggal tersebut.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/70 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {task && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDelete}
            disabled={busy}
            aria-label={confirmDelete ? 'Klik lagi untuk hapus permanen' : 'Hapus tugas'}
            className={cn(
              'gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive',
              confirmDelete && 'bg-destructive/10 font-bold'
            )}
          >
            {deleteTask.isPending ? (
              <MiniSpinner />
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                {confirmDelete && 'Yakin hapus?'}
              </>
            )}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={busy || !title.trim()}
            className="btn-primary-gradient min-w-24"
          >
            {saveTask.isPending ? <MiniSpinner className="text-white" /> : 'Simpan'}
          </Button>
        </div>
      </div>
    </>
  );
}
