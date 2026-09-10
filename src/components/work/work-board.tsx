// ---------------------------------------------------------------------------
// src/components/work/work-board.tsx — sub-tab "Papan" Meja Kerja (Fase 2,
// Task 19): kanban 4 kolom (Belum / Jalan / Nunggu / Selesai) dengan drag &
// drop antar kolom (@dnd-kit, sama seperti pengurutan habit) + tombol geser
// cepat untuk mobile + seksi Arsip (tugas selesai dari hari sebelumnya).
// ---------------------------------------------------------------------------
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  CloudOff,
  GripVertical,
  Inbox,
  Plus,
  RotateCw,
  Umbrella,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetTaskStatus, useSaveTask, useToggleRoutineLog } from './use-work-api';
import {
  isTaskNew,
  type WorkBoardPayload,
  type WorkRoutineItem,
  type WorkTaskItem,
  type WorkTaskStatus,
} from './work-types';
import { EmptyHint, MiniSpinner, RoutineTick, WorkBadge, formatLongIndoDate } from './work-shared';

// Urutan kolom papan (status penyimpanan DB, bukan urutan visual bebas).
const COLUMN_DEFS: { id: WorkTaskStatus; label: string; tone: string; dot: string }[] = [
  { id: 'todo', label: 'Belum', tone: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
  { id: 'jalan', label: 'Jalan', tone: 'text-primary', dot: 'bg-primary' },
  { id: 'nunggu', label: 'Nunggu', tone: 'text-warning dark:text-warning/80', dot: 'bg-warning' },
  { id: 'selesai', label: 'Selesai', tone: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
];

/** Urutan "geser cepat": todo → jalan → selesai → todo; nunggu → selesai. */
const QUICK_NEXT: Record<string, string> = {
  todo: 'jalan',
  jalan: 'selesai',
  nunggu: 'selesai',
  selesai: 'todo',
};
const QUICK_LABEL: Record<string, string> = {
  jalan: 'Jalan',
  selesai: 'Selesai',
  todo: 'Belum',
  nunggu: 'Nunggu',
};

// ── Rutinitas di papan (Task 21) ─────────────────────────────────────────────
// Bug "Papan kosong padahal Rutinitas sudah diisi": rutinitas kini tampil di
// tab Papan sebagai seksi tersendiri di atas kanban — tap lingkaran untuk
// centang. Data diambil dari query /api/work (payload yang sama dengan tab
// Hari Ini) supaya toggle-nya optimistik di cache yang sama.

const ROUTINE_TIME_ORDER: Record<string, number> = { pagi: 0, siang: 1, sore: 2 };
const ROUTINE_TIME_META: Record<string, { label: string; dot: string; text: string }> = {
  pagi: { label: 'Pagi', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  siang: { label: 'Siang', dot: 'bg-primary', text: 'text-primary' },
  sore: { label: 'Sore', dot: 'bg-rose-400', text: 'text-rose-500 dark:text-rose-400' },
};

function RoutineBoardRow({ routine, date }: { routine: WorkRoutineItem; date: string }) {
  const toggle = useToggleRoutineLog(date);
  const meta = ROUTINE_TIME_META[routine.timeOfDay] ?? ROUTINE_TIME_META.siang;
  return (
    <div className={cn('premium-card flex items-center gap-2 rounded-xl p-2', routine.doneToday && 'opacity-70')}>
      <RoutineTick
        done={routine.doneToday}
        label={`${routine.doneToday ? 'Batalkan' : 'Tandai selesai'}: ${routine.title}`}
        onClick={() => toggle.mutate({ routineId: routine.id, done: !routine.doneToday })}
      />
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-[13px] font-semibold',
          routine.doneToday
            ? 'text-muted-foreground/80 line-through decoration-muted-foreground/50'
            : 'text-foreground'
        )}
      >
        {routine.title}
      </p>
      <span className={cn('flex shrink-0 items-center gap-1 text-[10px] font-extrabold', meta.text)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden="true" />
        {meta.label}
      </span>
    </div>
  );
}

function BoardRoutines({
  date,
  routines,
  holiday,
}: {
  date: string;
  routines: WorkRoutineItem[] | undefined;
  holiday: boolean;
}) {
  if (holiday) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-warning/25 bg-warning/5 p-3 dark:bg-warning/10">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
          <Umbrella className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-foreground">Mode Libur aktif</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Rutinitas hari ini diliburkan dan tidak ditampilkan. Matikan Mode Libur di atas untuk kembali bekerja.
          </p>
        </div>
      </div>
    );
  }
  if (routines === undefined) {
    return (
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    );
  }
  const active = routines.filter((r) => r.active);
  if (active.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/70 px-3 py-3 text-center text-[11.5px] leading-relaxed text-muted-foreground/80">
        Belum ada rutinitas aktif — atur tugas berulangmu di tab Rutinitas, nanti muncul di sini tiap hari.
      </p>
    );
  }
  const done = active.filter((r) => r.doneToday).length;
  const sorted = [...active].sort(
    (a, b) =>
      (ROUTINE_TIME_ORDER[a.timeOfDay] ?? 9) - (ROUTINE_TIME_ORDER[b.timeOfDay] ?? 9) ||
      a.sortOrder - b.sortOrder ||
      a.createdAt.localeCompare(b.createdAt)
  );
  return (
    <section aria-label="Rutinitas hari ini di papan">
      <div className="flex items-center gap-2 px-1">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Rutinitas Hari Ini</h4>
        <span className="rounded-full bg-primary/10 px-2 py-px text-[10.5px] font-bold tabular-nums text-primary dark:bg-primary/15">
          {done}/{active.length}
        </span>
        <span className="hidden text-[10.5px] text-muted-foreground/70 sm:inline">— tap untuk centang</span>
      </div>
      <div className="mt-2 grid max-h-72 gap-1.5 overflow-y-auto pr-0.5 custom-scrollbar sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((routine) => (
          <RoutineBoardRow key={routine.id} routine={routine} date={date} />
        ))}
      </div>
    </section>
  );
}

function boardMetaLabel(task: WorkTaskItem, today: string): string | null {
  if (task.overdue) return 'lewat tenggat';
  if (task.kapanSaja) return 'kapan saja';
  if (task.dayKey === today) return 'hari ini';
  if (task.dayKey) {
    return task.dayKey > today
      ? `target ${formatLongIndoDate(task.dayKey).split(', ')[1] ?? task.dayKey}`
      : null;
  }
  return null;
}

/** Kartu tugas di papan — dipakai untuk item sortable & DragOverlay. */
function BoardCard({
  task,
  today,
  onEdit,
  onQuickMove,
  quickPending,
  dragHandleProps,
  dragging,
  overlay,
}: {
  task: WorkTaskItem;
  today: string;
  onEdit: (task: WorkTaskItem) => void;
  onQuickMove?: (task: WorkTaskItem) => void;
  quickPending?: boolean;
  dragHandleProps?: Record<string, unknown>;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const done = task.status === 'selesai';
  const meta = boardMetaLabel(task, today);
  const next = QUICK_NEXT[task.status] ?? 'todo';
  return (
    <div
      className={cn(
        'premium-card rounded-xl p-2.5',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-xl',
        done && 'opacity-75',
        task.overdue && !done && 'border-destructive/40'
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className="mt-0.5 hidden h-5 w-5 shrink-0 cursor-grab touch-none text-muted-foreground/50 sm:block"
          aria-hidden="true"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-lg"
          aria-label={`Buka editor tugas ${task.title}`}
        >
          <p
            className={cn(
              'text-[13px] font-semibold leading-snug',
              done ? 'text-muted-foreground/80 line-through decoration-muted-foreground/50' : 'text-foreground'
            )}
          >
            {task.title}
          </p>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {task.overdue && !done && (
              <WorkBadge variant="menunggu" className="!bg-destructive/10 !text-destructive dark:!text-destructive/90">
                LEWAT
              </WorkBadge>
            )}
            {task.status === 'nunggu' && !done && <WorkBadge variant="menunggu">MENUNGGU</WorkBadge>}
            {task.status === 'jalan' && !done && <WorkBadge variant="jalan">JALAN</WorkBadge>}
            {isTaskNew(task, today) && task.dayKey === today && !done && <WorkBadge variant="baru">BARU</WorkBadge>}
            {meta && <span className="text-[10.5px] text-muted-foreground">{meta}</span>}
            {task.notes && <span className="truncate text-[10.5px] text-muted-foreground/70">· {task.notes}</span>}
          </span>
        </button>
      </div>
      {/* Geser cepat — pengganti drag&drop di layar kecil (tetap bisa drag). */}
      {onQuickMove && (
        <button
          type="button"
          onClick={() => onQuickMove(task)}
          disabled={quickPending}
          className="mt-1.5 ml-auto flex min-h-9 items-center gap-1 rounded-full border border-border/70 px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-50 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={`Pindahkan ${task.title} ke kolom ${QUICK_LABEL[next]}`}
        >
          {QUICK_LABEL[next]}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Item sortable dengan handle drag seluruh kartu (jarak aktivasi 8px supaya
 *  tap tetap masuk ke editor, geser baru menyeret). */
function SortableBoardCard({
  task,
  today,
  onEdit,
  onQuickMove,
  quickPending,
}: {
  task: WorkTaskItem;
  today: string;
  onEdit: (task: WorkTaskItem) => void;
  onQuickMove: (task: WorkTaskItem) => void;
  quickPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="touch-manipulation"
      {...attributes}
      {...listeners}
    >
      <BoardCard
        task={task}
        today={today}
        onEdit={onEdit}
        onQuickMove={onQuickMove}
        quickPending={quickPending}
        dragging={isDragging}
      />
    </div>
  );
}

function BoardColumn({
  columnId,
  label,
  tone,
  dot,
  count,
  children,
}: {
  columnId: string;
  label: string;
  tone: string;
  dot: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <section
      aria-label={`Kolom ${label}`}
      className={cn(
        'flex w-[78vw] shrink-0 snap-center flex-col gap-2 rounded-2xl border bg-card/40 p-2.5 sm:w-[46%]',
        'lg:w-auto lg:shrink lg:snap-align-none',
        'transition-colors',
        isOver ? 'border-primary/40 bg-primary/5' : 'border-border/70'
      )}
    >
      <header className="flex items-center gap-2 px-1">
        <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
        <h4 className={cn('text-xs font-extrabold uppercase tracking-wider', tone)}>{label}</h4>
        <span className="ml-auto rounded-full bg-muted px-2 py-px text-[10.5px] font-bold tabular-nums text-muted-foreground">
          {count}
        </span>
      </header>
      <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2">
        {children}
      </div>
    </section>
  );
}

export function WorkBoard({
  date,
  board,
  isLoading,
  boardError,
  onRetryBoard,
  routines,
  holiday,
  onEditTask,
}: {
  date: string;
  board: WorkBoardPayload | undefined;
  isLoading: boolean;
  /** True kalau query /api/work/board gagal dan tidak ada data cache —
   *  menampilkan kartu error + tombol coba lagi (bukan skeleton abadi). */
  boardError: boolean;
  onRetryBoard: () => void;
  /** Rutinitas aktif hari ini (dari payload /api/work, tab apa adanya). */
  routines: WorkRoutineItem[] | undefined;
  holiday: boolean;
  onEditTask: (task: WorkTaskItem | null, draftTitle?: string) => void;
}) {
  const setTaskStatus = useSetTaskStatus(date);
  const saveTask = useSaveTask(date);
  const [activeTask, setActiveTask] = useState<WorkTaskItem | null>(null);
  const [arsipOpen, setArsipOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columns = useMemo(() => {
    const byStatus: Record<string, WorkTaskItem[]> = { todo: [], jalan: [], nunggu: [] };
    if (board) {
      for (const task of board.tasks) {
        (byStatus[task.status] ??= []).push(task);
      }
    }
    return byStatus;
  }, [board]);

  const doneToday = board?.doneToday ?? [];
  const archive = board?.archive ?? [];

  const statusOf = (id: string): WorkTaskStatus | null => {
    for (const col of ['todo', 'jalan', 'nunggu'] as WorkTaskStatus[]) {
      if (columns[col].some((t) => t.id === id)) return col;
    }
    if (doneToday.some((t) => t.id === id)) return 'selesai';
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveTask(
      [...columns.todo, ...columns.jalan, ...columns.nunggu, ...doneToday].find((t) => t.id === id) ?? null
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    const task = [...columns.todo, ...columns.jalan, ...columns.nunggu, ...doneToday].find((t) => t.id === taskId);
    if (!task) return;

    // Target: kolom (droppable id = status) atau kartu lain (ambil statusnya).
    const targetStatus = (COLUMN_DEFS.find((c) => c.id === overId)?.id ?? statusOf(overId)) as WorkTaskStatus | null;
    if (!targetStatus || targetStatus === task.status) return;

    setTaskStatus.mutate({ task, status: targetStatus });
  };

  const quickMove = (task: WorkTaskItem) => {
    const next = QUICK_NEXT[task.status] ?? 'todo';
    setTaskStatus.mutate({ task, status: next });
  };

  const reopenArchived = (task: WorkTaskItem) => {
    saveTask.mutate({ id: task.id, title: task.title, status: 'todo', dayKey: date });
  };

  if (isLoading && !board) {
    return (
      <div className="pt-1">
        <BoardRoutines date={date} routines={routines} holiday={holiday} />
        <div className="mt-3 flex gap-3 overflow-hidden lg:grid lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[78vw] shrink-0 rounded-2xl border border-border/70 bg-card/40 p-3 sm:w-[46%] lg:w-auto">
              <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
              <div className="mt-3 space-y-2">
                <div className="h-14 animate-pulse rounded-xl bg-muted/60" />
                <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const showBoardError = boardError && !board;
  const totalOpen = board.stats.todo + board.stats.jalan + board.stats.nunggu;
  const activeRoutines = holiday ? [] : (routines ?? []).filter((r) => r.active);
  const routineLeft = activeRoutines.filter((r) => !r.doneToday).length;

  const summaryText =
    totalOpen > 0
      ? `${totalOpen} tugas terbuka · ${board.stats.selesaiHariIni} selesai hari ini`
      : board.stats.selesaiHariIni > 0
        ? 'Semua tugas beres hari ini'
        : routineLeft > 0
          ? 'Belum ada tugas lepas — tinggal rutinitas di atas'
          : activeRoutines.length > 0
            ? 'Meja bersih — tugas & rutinitas semua beres'
            : 'Papan masih kosong — buat tugas lewat tombol di kanan';

  return (
    <div className="pt-1">
      {/* ── Rutinitas Hari Ini (Task 21 — fix "Papan kosong padahal rutinitas
          sudah diisi") ── */}
      <BoardRoutines date={date} routines={routines} holiday={holiday} />

      {/* ── Error papan: pernah skeleton abadi kalau API gagal ── */}
      {showBoardError && (
        <div className="mt-3">
          <EmptyHint
            icon={<CloudOff className="h-5 w-5" aria-hidden="true" />}
            title="Papan gagal dimuat"
            hint="Koneksi ke server terputus saat mengambil tugas. Rutinitas di atas tetap bisa dipakai."
            action={
              <Button
                type="button"
                size="sm"
                className="btn-primary-gradient mt-1 gap-1"
                onClick={onRetryBoard}
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                Coba lagi
              </Button>
            }
          />
        </div>
      )}

      {board && (
        <>
      {/* ── Ringkasan papan ── */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        <span className="text-[11.5px] font-semibold text-muted-foreground">{summaryText}</span>
        <span className="hidden text-[11px] text-muted-foreground/70 sm:inline">
          · geser kartu antar kolom untuk ubah status
        </span>
        <button
          type="button"
          onClick={() => onEditTask(null, '')}
          className="ml-auto flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-border/70 px-3.5 text-[11.5px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Buat tugas baru di papan"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Tugas baru
        </button>
      </div>

      {/* ── Papan kanban ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 custom-scrollbar lg:grid lg:grid-cols-4 lg:overflow-visible lg:snap-none">
          {COLUMN_DEFS.map((col) => {
            const isDoneCol = col.id === 'selesai';
            const items = isDoneCol ? doneToday : columns[col.id] ?? [];
            return (
              <BoardColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                tone={col.tone}
                dot={col.dot}
                count={items.length}
              >
                <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {items.map((task) => (
                    <SortableBoardCard
                      key={task.id}
                      task={task}
                      today={date}
                      onEdit={onEditTask}
                      onQuickMove={quickMove}
                      quickPending={setTaskStatus.isPending}
                    />
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-[11px] text-muted-foreground/70">
                      {isDoneCol ? 'belum ada yang beres hari ini' : 'kosong'}
                    </p>
                  )}
                </SortableContext>
              </BoardColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <BoardCard task={activeTask} today={date} onEdit={() => {}} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* ── Arsip ── */}
      <Collapsible open={arsipOpen} onOpenChange={setArsipOpen} className="mt-4">
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card/40 px-4 py-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-xl"
              aria-expanded={arsipOpen}
              aria-label={arsipOpen ? 'Tutup arsip' : 'Buka arsip'}
            >
              {arsipOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
              <Archive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-[13px] font-bold text-foreground">Arsip</span>
              <span className="rounded-full bg-muted px-2 py-px text-[10.5px] font-bold tabular-nums text-muted-foreground">
                {archive.length}
              </span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                — tugas beres dari hari-hari sebelumnya
              </span>
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          {archive.length === 0 ? (
            <div className="mt-2">
              <EmptyHint
                icon={<Inbox className="h-5 w-5" aria-hidden="true" />}
                title="Arsip masih kosong"
                hint="Tugas yang kamu selesaikan di hari sebelumnya akan tersimpan rapi di sini."
              />
            </div>
          ) : (
            <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1 custom-scrollbar" role="list">
              {archive.map((task) => {
                const dayLabel = task.dayKey ? formatLongIndoDate(task.dayKey) : 'kapan saja';
                return (
                  <li
                    key={task.id}
                    className="premium-list-item flex-wrap px-3 py-2.5"
                    style={{ alignItems: 'flex-start' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-muted-foreground/80 line-through decoration-muted-foreground/40">
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{dayLabel}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => reopenArchived(task)}
                      disabled={saveTask.isPending}
                      className="h-9 gap-1 text-[11.5px] font-bold text-primary hover:bg-primary/10 hover:text-primary"
                      aria-label={`Buka lagi tugas ${task.title} untuk hari ini`}
                    >
                      {saveTask.isPending ? (
                        <MiniSpinner />
                      ) : (
                        <>
                          Buka lagi
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>
        </>
      )}
    </div>
  );
}
