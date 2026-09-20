// ---------------------------------------------------------------------------
// src/components/work/board-archive.tsx — seksi Arsip papan (pecahan Task 71-e
// dari work-board.tsx): tugas selesai dari hari sebelumnya (maks 30 terbaru),
// collapsible, dengan tombol "Buka lagi" untuk hari ini.
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Archive, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { EmptyHint, MiniSpinner, formatLongIndoDate } from './work-shared';
import type { WorkTaskItem } from './work-types';

export function BoardArchive({
  archive,
  pending,
  onReopen,
}: {
  archive: WorkTaskItem[];
  pending: boolean;
  onReopen: (task: WorkTaskItem) => void;
}) {
  const [arsipOpen, setArsipOpen] = useState(false);
  return (
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
                    onClick={() => onReopen(task)}
                    disabled={pending}
                    className="h-9 gap-1 text-[11.5px] font-bold text-primary hover:bg-primary/10 hover:text-primary"
                    aria-label={`Buka lagi tugas ${task.title} untuk hari ini`}
                  >
                    {pending ? (
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
  );
}
