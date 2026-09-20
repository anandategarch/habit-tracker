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
//
// Task 71-e: file dipecah — akar komposisi saja; konstanta → work-board-
// shared.ts, kartu rutinitas → board-routine-card.tsx, kartu tugas →
// board-card.tsx, kolom → board-column.tsx, arsip → board-archive.tsx,
// mutasi/drag/logika kolom → work-board-controller.ts.
// ---------------------------------------------------------------------------
'use client';

import {
  DndContext,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { CloudOff, Plus, RotateCw, Umbrella } from 'lucide-react';
import type { WorkBoardPayload, WorkRoutineItem, WorkTaskItem } from './work-types';
import { EmptyHint } from './work-shared';
import { COLUMN_DEFS, routineDragId } from './work-board-shared';
import { useBoardController } from './work-board-controller';
import { BoardArchive } from './board-archive';
import { BoardColumn } from './board-column';
import { BoardCard, SortableBoardCard } from './board-card';
import { RoutineBoardCard, SortableRoutineCard } from './board-routine-card';

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
  const {
    sensors,
    activeItem,
    activeRoutines,
    openRoutines,
    doneRoutines,
    columnItems,
    archive,
    handleDragStart,
    handleDragEnd,
    toggleRoutineCard,
    quickMove,
    reopenArchived,
    routinePending,
    taskPending,
    archivePending,
  } = useBoardController({ date, board, routines, holiday });

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
                            quickPending={routinePending}
                          />
                        ) : (
                          <SortableBoardCard
                            key={item.task.id}
                            task={item.task}
                            today={date}
                            onEdit={onEditTask}
                            onQuickMove={quickMove}
                            quickPending={taskPending}
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
          <BoardArchive archive={archive} pending={archivePending} onReopen={reopenArchived} />
        </>
      )}
    </div>
  );
}
