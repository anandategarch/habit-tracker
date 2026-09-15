// ---------------------------------------------------------------------------
// src/components/work/work-board.tsx — sub-tab "Papan" Meja Kerja (Fase 2,
// Task 19): kanban 4 kolom (Belum / Jalan / Nunggu / Selesai) dengan drag &
// drop antar kolom (@dnd-kit, sama seperti pengurutan habit) + tombol geser
// cepat untuk mobile + seksi Arsip (tugas selesai dari hari sebelumnya).
//
// Task 22 (bug "tugas selesai / menggantung kok tidak muncul?"): rutinitas
// kini jadi KARTU kelas satu di papan — rutinitas aktif yang BELUM dicentang
// tampil sebagai kartu di kolom Belum, yang SUDAH dicentang hari ini tampil
// sebagai kartu di kolom Selesai (badge RUTIN + Pagi/Siang/Sore). Tap kartu =
// centang/batalkan; geser Belum↔Selesai = sama; men-drop kartu rutinitas ke
// kolom Jalan/Nunggu ditolak dengan toast penjelasan. Data & toggle optimistik
// memakai payload /api/work yang sama dengan tab Hari Ini. Seksi checklist
// "Rutinitas Hari Ini" (Task 21) dihapus — digantikan kartu-kartu ini supaya
// papan benar-benar memperlihatkan semua yang selesai & menggantung.
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
import { toast } from 'sonner';
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
import { EmptyHint, MiniSpinner, WorkBadge, formatLongIndoDate } from './work-shared';

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

// ── Rutinitas di papan (Task 22) ─────────────────────────────────────────────
// Kartu rutinitas = warga kelas satu papan: belum dicentang → kolom Belum,
// dicentang hari ini → kolom Selesai. ID sortable diberi prefiks supaya tidak
// mungkin bertabrakan dengan id tugas.

const ROUTINE_PREFIX = 'routine:';
const routineDragId = (r: WorkRoutineItem) => `${ROUTINE_PREFIX}${r.id}`;

const ROUTINE_TIME_ORDER: Record<string, number> = { pagi: 0, siang: 1, sore: 2 };
const ROUTINE_TIME_META: Record<string, { label: string; dot: string; text: string }> = {
  pagi: { label: 'Pagi', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  siang: { label: 'Siang', dot: 'bg-primary', text: 'text-primary' },
  sore: { label: 'Sore', dot: 'bg-rose-400', text: 'text-rose-500 dark:text-rose-400' },
};

/** Item papan: kartu rutinitas atau kartu tugas lepas. */
type BoardItem = { kind: 'routine'; routine: WorkRoutineItem } | { kind: 'task'; task: WorkTaskItem };

/** Kartu rutinitas di papan — dipakai untuk item sortable & DragOverlay.
 *  Tap kartu = centang / batalkan (mutasi yang sama dengan tab Hari Ini). */
function RoutineBoardCard({
  routine,
  onToggle,
  onQuickMove,
  quickPending,
  dragging,
  overlay,
}: {
  routine: WorkRoutineItem;
  onToggle: () => void;
  onQuickMove?: () => void;
  quickPending?: boolean;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const done = routine.doneToday;
  const meta = ROUTINE_TIME_META[routine.timeOfDay] ?? ROUTINE_TIME_META.siang;
  return (
    <div
      className={cn(
        'premium-card rounded-xl p-2.5',
        dragging && 'opacity-40',
        overlay && 'rotate-2 shadow-xl',
        done && 'opacity-75'
      )}
    >
      <div className="flex items-start gap-1.5">
        <span
          className="mt-0.5 hidden h-5 w-5 shrink-0 cursor-grab touch-none text-muted-foreground/50 sm:block"
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={onToggle}
          disabled={quickPending}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:rounded-lg disabled:opacity-60"
          aria-label={`${done ? 'Batalkan' : 'Tandai selesai'} rutinitas ${routine.title}`}
          aria-pressed={done}
        >
          <p
            className={cn(
              'text-[13px] font-semibold leading-snug',
              done ? 'text-muted-foreground/80 line-through decoration-muted-foreground/50' : 'text-foreground'
            )}
          >
            {routine.title}
          </p>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <WorkBadge variant="rutin">RUTIN</WorkBadge>
            <span className={cn('flex items-center gap-1 text-[10.5px] font-extrabold', meta.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden="true" />
              {meta.label}
            </span>
          </span>
        </button>
      </div>
      {/* Geser cepat — pengganti drag&drop di layar kecil (tetap bisa drag). */}
      {onQuickMove && (
        <button
          type="button"
          onClick={onQuickMove}
          disabled={quickPending}
          className="mt-1.5 ml-auto flex min-h-9 items-center gap-1 rounded-full border border-border/70 px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-50 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={`${done ? 'Batalkan' : 'Tandai selesai'} rutinitas ${routine.title}`}
        >
          {done ? 'Belum' : 'Selesai'}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Item sortable rutinitas (handle drag seluruh kartu, jarak aktivasi 8px). */
function SortableRoutineCard({
  routine,
  onToggle,
  quickPending,
}: {
  routine: WorkRoutineItem;
  onToggle: () => void;
  quickPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: routineDragId(routine),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="touch-manipulation"
      {...attributes}
      {...listeners}
    >
      <RoutineBoardCard
        routine={routine}
        onToggle={onToggle}
        onQuickMove={onToggle}
        quickPending={quickPending}
        dragging={isDragging}
      />
    </div>
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
  dragging,
  overlay,
}: {
  task: WorkTaskItem;
  today: string;
  onEdit: (task: WorkTaskItem) => void;
  onQuickMove?: (task: WorkTaskItem) => void;
  quickPending?: boolean;
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

/** Item sortable tugas dengan handle drag seluruh kartu (jarak aktivasi 8px supaya
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
  const toggleRoutine = useToggleRoutineLog(date);
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);
  const [arsipOpen, setArsipOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Rutinitas aktif hari ini (kosong saat Mode Libur — kartu tidak dimunculkan).
  const activeRoutines = useMemo(
    () => (holiday ? [] : (routines ?? []).filter((r) => r.active)),
    [routines, holiday]
  );

  // Kolom Belum: rutinitas belum dicentang, urut Pagi → Siang → Sore.
  const openRoutines = useMemo(
    () =>
      [...activeRoutines]
        .filter((r) => !r.doneToday)
        .sort(
          (a, b) =>
            (ROUTINE_TIME_ORDER[a.timeOfDay] ?? 9) - (ROUTINE_TIME_ORDER[b.timeOfDay] ?? 9) ||
            a.sortOrder - b.sortOrder ||
            a.createdAt.localeCompare(b.createdAt)
        ),
    [activeRoutines]
  );

  // Kolom Selesai: rutinitas dicentang hari ini, terbaru dicentang di atas.
  const doneRoutines = useMemo(
    () =>
      [...activeRoutines]
        .filter((r) => r.doneToday)
        .sort(
          (a, b) =>
            (b.doneAt ?? '').localeCompare(a.doneAt ?? '') ||
            (ROUTINE_TIME_ORDER[a.timeOfDay] ?? 9) - (ROUTINE_TIME_ORDER[b.timeOfDay] ?? 9) ||
            a.sortOrder - b.sortOrder
        ),
    [activeRoutines]
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

  const doneToday = useMemo(() => board?.doneToday ?? [], [board]);
  const archive = useMemo(() => board?.archive ?? [], [board]);

  // Susunan kartu per kolom: rutinitas dulu (tulang punggung hari ini), lalu
  // tugas lepas. Jalan & Nunggu khusus tugas lepas (rutinitas biner).
  const columnItems = useMemo(() => {
    const routine = (r: WorkRoutineItem): BoardItem => ({ kind: 'routine', routine: r });
    const task = (t: WorkTaskItem): BoardItem => ({ kind: 'task', task: t });
    return {
      todo: [...openRoutines.map(routine), ...columns.todo.map(task)],
      jalan: columns.jalan.map(task),
      nunggu: columns.nunggu.map(task),
      selesai: [...doneRoutines.map(routine), ...doneToday.map(task)],
    };
  }, [openRoutines, doneRoutines, columns, doneToday]);

  const statusOf = (id: string): WorkTaskStatus | null => {
    if (id.startsWith(ROUTINE_PREFIX)) {
      const rid = id.slice(ROUTINE_PREFIX.length);
      if (openRoutines.some((r) => r.id === rid)) return 'todo';
      if (doneRoutines.some((r) => r.id === rid)) return 'selesai';
      return null;
    }
    for (const col of ['todo', 'jalan', 'nunggu'] as WorkTaskStatus[]) {
      if (columns[col].some((t) => t.id === id)) return col;
    }
    if (doneToday.some((t) => t.id === id)) return 'selesai';
    return null;
  };

  const findItem = (id: string): BoardItem | null => {
    for (const col of ['todo', 'jalan', 'nunggu', 'selesai'] as const) {
      const found = columnItems[col].find((item) =>
        item.kind === 'routine' ? routineDragId(item.routine) === id : item.task.id === id
      );
      if (found) return found;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveItem(findItem(String(event.active.id)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;
    const dragId = String(active.id);
    const overId = String(over.id);

    // Target: kolom (droppable id = status) atau kartu lain (ambil statusnya).
    const targetStatus = (COLUMN_DEFS.find((c) => c.id === overId)?.id ?? statusOf(overId)) as WorkTaskStatus | null;
    if (!targetStatus) return;

    // ── Kartu RUTINITAS: hanya boleh Belum ↔ Selesai (centang hari ini). ──
    if (dragId.startsWith(ROUTINE_PREFIX)) {
      const routine = activeRoutines.find((r) => routineDragId(r) === dragId);
      if (!routine) return;
      if (targetStatus === 'selesai' && !routine.doneToday) {
        toggleRoutine.mutate({ routineId: routine.id, done: true });
      } else if (targetStatus === 'todo' && routine.doneToday) {
        toggleRoutine.mutate({ routineId: routine.id, done: false });
      } else if (targetStatus === 'jalan' || targetStatus === 'nunggu') {
        toast.info(
          'Rutinitas cuma punya dua kondisi: Belum dan Selesai. Untuk kolom Jalan/Nunggu, pakai tugas lepas.'
        );
      }
      return;
    }

    // ── Kartu tugas lepas (logika lama). ──
    const task = [...columns.todo, ...columns.jalan, ...columns.nunggu, ...doneToday].find((t) => t.id === dragId);
    if (!task) return;
    if (targetStatus === task.status) return;

    setTaskStatus.mutate({ task, status: targetStatus });
  };

  const toggleRoutineCard = (routine: WorkRoutineItem) => {
    toggleRoutine.mutate({ routineId: routine.id, done: !routine.doneToday });
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
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
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
  // Task 61-f (audit 61-a P1): React Query v5 — fetch gagal tanpa cache →
  // isLoading=false, board=undefined. Dulu `board.stats.todo` langsung
  // didereferensi di sini → TypeError mematikan seluruh tab Meja Kerja
  // SEBELUM kartu error showBoardError sempat dirender. Guard `{board && …}`
  // di JSX hanya melindungi render, bukan derivasi di atas.
  const totalOpen = board
    ? board.stats.todo + board.stats.jalan + board.stats.nunggu + openRoutines.length
    : 0;
  const doneCount = board ? board.stats.selesaiHariIni + doneRoutines.length : 0;

  const summaryText = holiday
    ? totalOpen > 0
      ? `${totalOpen} tugas terbuka · rutinitas diliburkan`
      : 'Mode Libur — rutinitas hari ini diliburkan'
    : totalOpen > 0
      ? `${totalOpen} belum beres · ${doneCount} selesai hari ini`
      : doneCount > 0
        ? 'Semua beres hari ini'
        : 'Papan masih kosong — buat tugas lewat tombol di kanan';

  return (
    <div className="pt-1">
      {/* ── Mode Libur: rutinitas tidak jadi kartu hari ini ── */}
      {holiday && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-warning/25 bg-warning/5 p-3 dark:bg-warning/10">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
            <Umbrella className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground">Mode Libur aktif</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Rutinitas hari ini diliburkan dan tidak ditampilkan di papan. Matikan Mode Libur di atas untuk kembali bekerja.
            </p>
          </div>
        </div>
      )}

      {/* ── Error papan: pernah skeleton abadi kalau API gagal ── */}
      {showBoardError && (
        <div className="mt-3">
          <EmptyHint
            icon={<CloudOff className="h-5 w-5" aria-hidden="true" />}
            title="Papan gagal dimuat"
            hint="Koneksi ke server terputus saat mengambil tugas. Rutinitas tetap bisa dicek dari tab Hari Ini."
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
            const items = isDoneCol ? columnItems.selesai : columnItems[col.id];
            return (
              <BoardColumn
                key={col.id}
                columnId={col.id}
                label={col.label}
                tone={col.tone}
                dot={col.dot}
                count={items.length}
              >
                <SortableContext
                  items={items.map((item) => (item.kind === 'routine' ? routineDragId(item.routine) : item.task.id))}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item) =>
                    item.kind === 'routine' ? (
                      <SortableRoutineCard
                        key={routineDragId(item.routine)}
                        routine={item.routine}
                        onToggle={() => toggleRoutineCard(item.routine)}
                        quickPending={toggleRoutine.isPending}
                      />
                    ) : (
                      <SortableBoardCard
                        key={item.task.id}
                        task={item.task}
                        today={date}
                        onEdit={onEditTask}
                        onQuickMove={quickMove}
                        quickPending={setTaskStatus.isPending}
                      />
                    )
                  )}
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-[11px] text-muted-foreground/70">
                      {isDoneCol
                        ? 'belum ada yang beres hari ini'
                        : col.id === 'todo' && activeRoutines.length > 0
                          ? 'semua rutinitas sudah beres'
                          : 'kosong'}
                    </p>
                  )}
                </SortableContext>
              </BoardColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem?.kind === 'routine' ? (
            <RoutineBoardCard routine={activeItem.routine} onToggle={() => {}} overlay />
          ) : activeItem?.kind === 'task' ? (
            <BoardCard task={activeItem.task} today={date} onEdit={() => {}} overlay />
          ) : null}
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
