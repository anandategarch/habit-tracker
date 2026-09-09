// ---------------------------------------------------------------------------
// src/components/work/work-today.tsx — sub-tab "Hari Ini" Meja Kerja (Task 17-a):
// rutinitas pagi/siang/sore + tugas lepas (input cepat) + kartu Catatan Kilat.
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Repeat, Sparkles, StickyNote, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSaveNote,
  useSaveTask,
  useToggleRoutineLog,
  useToggleTaskDone,
} from './use-work-api';
import {
  isTaskNew,
  type WorkPayload,
  type WorkRoutineItem,
  type WorkTaskItem,
  type WorkTimeOfDay,
} from './work-types';
import { EmptyHint, GroupLabel, MiniSpinner, RoutineTick, WorkBadge, WorkTick } from './work-shared';

const GROUP_ORDER: WorkTimeOfDay[] = ['pagi', 'siang', 'sore'];
const GROUP_LABELS: Record<WorkTimeOfDay, string> = { pagi: 'Rutin Pagi', siang: 'Rutin Siang', sore: 'Rutin Sore' };

function RoutineRow({
  routine,
  date,
}: {
  routine: WorkRoutineItem;
  date: string;
}) {
  const toggle = useToggleRoutineLog(date);
  return (
    <li className="premium-list-item px-3 py-2.5 anim-press">
      <RoutineTick
        done={routine.doneToday}
        label={`${routine.doneToday ? 'Batalkan' : 'Tandai selesai'}: ${routine.title}`}
        onClick={() => toggle.mutate({ routineId: routine.id, done: !routine.doneToday })}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[13.5px] font-semibold',
            routine.doneToday ? 'text-muted-foreground/80 line-through decoration-muted-foreground/50' : 'text-foreground'
          )}
        >
          {routine.title}
        </p>
      </div>
      <WorkBadge variant="rutin">
        <Repeat className="h-[9px] w-[9px]" aria-hidden="true" />
        RUTIN
      </WorkBadge>
    </li>
  );
}

function TaskRow({
  task,
  date,
  onEdit,
}: {
  task: WorkTaskItem;
  date: string;
  onEdit: (task: WorkTaskItem) => void;
}) {
  const toggle = useToggleTaskDone(date);
  const done = task.status === 'selesai';
  return (
    <li
      className={cn(
        'premium-list-item px-3 py-2.5 anim-press',
        task.overdue && 'border-destructive/30 bg-destructive/5 dark:bg-destructive/10'
      )}
    >
      <WorkTick
        status={task.status}
        label={`${done ? 'Buka lagi' : 'Selesaikan'}: ${task.title}`}
        onClick={() => toggle.mutate({ task, done: !done })}
      />
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-xl"
        aria-label={`Buka editor tugas ${task.title}`}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'truncate text-[13.5px] font-semibold',
              done ? 'text-muted-foreground/80 line-through decoration-muted-foreground/50' : 'text-foreground',
              task.status === 'nunggu' && !done && 'text-warning dark:text-warning/80'
            )}
          >
            {task.title}
          </span>
          {task.status === 'nunggu' && <WorkBadge variant="menunggu">MENUNGGU</WorkBadge>}
          {task.status === 'jalan' && <WorkBadge variant="jalan">JALAN</WorkBadge>}
          {isTaskNew(task, date) && task.dayKey === date && !done && <WorkBadge variant="baru">BARU</WorkBadge>}
          {!isTaskNew(task, date) && task.dayKey === date && !done && task.status === 'todo' && (
            <WorkBadge variant="sekali">SEKALI</WorkBadge>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {task.overdue && <span className="font-bold text-destructive">lewat tenggat</span>}
          {!task.overdue && (task.kapanSaja ? 'kapan saja' : task.dayKey === date ? 'hari ini' : null)}
          {task.notes && <span className="truncate opacity-70">· {task.notes}</span>}
        </span>
      </button>
    </li>
  );
}

function KilatCard({ date, notes }: { date: string; notes: WorkPayload['notes'] }) {
  const saveNote = useSaveNote(date);
  const [draft, setDraft] = useState('');
  // "3 catatan terakhir" = urut waktu update sungguhan (bukan ikut sematan
  // pin yang memang ditaru di atas oleh API — pin bukan berarti terbaru).
  const newest = [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 3);
  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft('');
    saveNote.mutate({ content: trimmed });
  };
  return (
    <div className="premium-card mt-4 p-4">
      <div className="flex items-center gap-2 text-xs font-extrabold text-warning dark:text-warning/80">
        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        Catatan Kilat
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ketik apa aja, 3 detik — nanti dirapikan…"
          aria-label="Tulis catatan kilat"
          maxLength={200}
          className="work-serif text-[13.5px]"
        />
        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={!draft.trim() || saveNote.isPending}
          aria-label="Simpan catatan kilat"
          className="btn-primary-gradient shrink-0"
        >
          {saveNote.isPending ? <MiniSpinner className="text-white" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      {newest.length > 0 && (
        <ul className="mt-3 space-y-2">
          {newest.map((note) => (
            <li key={note.id} className="work-serif border-b border-dashed border-border/80 pb-2 text-[13.5px] leading-relaxed text-foreground/85">
              {note.content}
              {note.tag && <span className="ml-1.5 not-italic text-[10px] font-bold text-muted-foreground">#{note.tag}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2.5 text-[11px] text-muted-foreground/80">
        {newest.length > 0 ? '3 catatan terakhir di atas — semua ada di tab Catatan.' : 'Ide, pengingat kecil, link — apa aja.'}
      </p>
    </div>
  );
}

export function WorkToday({
  date,
  data,
  isLoading,
  onEditTask,
  onGoTo,
}: {
  date: string;
  data: WorkPayload | undefined;
  isLoading: boolean;
  onEditTask: (task: WorkTaskItem | null, draftTitle?: string) => void;
  onGoTo: (tab: string) => void;
}) {
  const saveTask = useSaveTask(date);
  const [quickDraft, setQuickDraft] = useState('');

  if (isLoading || !data) {
    return (
      <div className="space-y-3 pt-3">
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/60" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    );
  }

  const activeRoutines = data.routines.filter((r) => r.active);
  const tasks = data.tasks;

  const submitQuickTask = () => {
    const trimmed = quickDraft.trim();
    if (!trimmed) return;
    setQuickDraft('');
    saveTask.mutate({ title: trimmed, dayKey: date, status: 'todo' });
  };

  return (
    <div className="pt-1">
      {/* ── Rutinitas hari ini ── */}
      {activeRoutines.length === 0 ? (
        <EmptyHint
          icon={<Repeat className="h-5 w-5" aria-hidden="true" />}
          title="Belum ada rutinitas kerjaan"
          hint="Rutinitas = tugas berulang yang muncul sendiri tiap hari. Atur sekali di tab Rutinitas, besok tinggal centang."
          action={
            <Button type="button" size="sm" className="btn-primary-gradient mt-1" onClick={() => onGoTo('routines')}>
              Atur Rutinitas
            </Button>
          }
        />
      ) : (
        GROUP_ORDER.map((group) => {
          const groupRoutines = activeRoutines.filter((r) => r.timeOfDay === group);
          if (groupRoutines.length === 0) return null;
          return (
            <section key={group} aria-label={`Rutinitas ${group}`}>
              <GroupLabel>{GROUP_LABELS[group]}</GroupLabel>
              <ul className="space-y-2">
                {groupRoutines.map((routine) => (
                  <RoutineRow key={routine.id} routine={routine} date={date} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {/* ── Input tambah tugas cepat ── */}
      <GroupLabel>Tugas Lepas Hari Ini</GroupLabel>
      <div className="flex items-center gap-2">
        <Input
          value={quickDraft}
          onChange={(e) => setQuickDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitQuickTask()}
          placeholder="Tambah tugas untuk hari ini…"
          aria-label="Tambah tugas untuk hari ini"
          maxLength={200}
        />
        <Button
          type="button"
          size="icon"
          onClick={submitQuickTask}
          disabled={!quickDraft.trim() || saveTask.isPending}
          aria-label="Tambah tugas"
          className="btn-primary-gradient shrink-0"
        >
          {saveTask.isPending ? <MiniSpinner className="text-white" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {/* ── Daftar tugas ── */}
      <ul className="mt-3 space-y-2">
        {tasks.length === 0 ? (
          <EmptyHint
            icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
            title="Hari ini masih bersih"
            hint={'Tulis tugas satu-off di atas — misal “kirim invoice” atau “review konten”. Cukup satu baris, langsung tersimpan.'}
          />
        ) : (
          tasks.map((task) => <TaskRow key={task.id} task={task} date={date} onEdit={onEditTask} />)
        )}
      </ul>

      {/* ── Kartu Catatan Kilat ── */}
      <KilatCard date={date} notes={data.notes} />

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70">
        <StickyNote className="h-3 w-3" aria-hidden="true" />
        Catatan lengkap ada di tab Catatan
      </div>
    </div>
  );
}
