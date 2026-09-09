// ---------------------------------------------------------------------------
// src/components/work/work-desk.tsx — TAB "Meja Kerja" (Task 17-a).
// Catatan kerjaan harian: rutinitas berulang + tugas lepas + catatan kilat +
// Asisten AI. Struktur & rasa visual meniru mockup public/meja-kerja.html
// (Aurora teal, badge RUTIN/SEKALI/BARU/MENUNGGU, pratinjau serif Georgia).
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Check, Clock, NotebookPen, Repeat, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';
import { useWorkData } from './use-work-api';
import { WorkToday } from './work-today';
import { WorkRoutines } from './work-routines';
import { WorkNotes } from './work-notes';
import { WorkAssistant } from './work-assistant';
import { WorkTaskEditor, type TaskEditorState } from './work-task-editor';
import { formatLongIndoDate } from './work-shared';
import type { WorkTaskItem } from './work-types';

export default function WorkDesk() {
  // Fase 1: meja kerja selalu "hari ini" (Jakarta). Dicek ulang tiap menit
  // supaya lewat tengah malam payload berganti otomatis.
  const [today, setToday] = useState(() => jakartaDateString());
  useEffect(() => {
    const id = setInterval(() => setToday(jakartaDateString()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [subTab, setSubTab] = useState('today');
  const { data, isLoading } = useWorkData(today);
  const [editorState, setEditorState] = useState<TaskEditorState>({ task: null });

  const stats = data?.stats;
  const allDone =
    !!stats &&
    stats.rutinAktif > 0 &&
    stats.rutinSelesai === stats.rutinAktif &&
    stats.tugasTodo + stats.tugasJalan + stats.tugasNunggu === 0;

  const openTaskEditor = (task: WorkTaskItem | null, draftTitle?: string) =>
    setEditorState({ task, draftTitle });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
            {formatLongIndoDate(today)}
          </p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Meja Kerja</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {allDone ? 'Meja bersih. Mantap hari ini!' : 'Satu-satu, semua beres.'}
          </p>
        </div>
        {/* Tombol "Tanya AI" (padanan FAB melayang mockup — di sini menempel
            header supaya tidak bertabrakan dengan FAB quick-add global dock). */}
        <button
          type="button"
          onClick={() => setSubTab('ai')}
          className={cn(
            'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold',
            'btn-primary-gradient text-white premium-fab-shadow transition-all active:scale-[0.96]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
          )}
          aria-label="Tanya Asisten AI"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Tanya AI
        </button>
      </header>

      {/* ── Pil statistik ── */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ringkasan hari ini">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11.5px] font-bold text-primary dark:bg-primary/15 dark:text-primary">
          <Check className="h-3 w-3" aria-hidden="true" />
          {stats && stats.rutinAktif > 0
            ? `${stats.rutinSelesai}/${stats.rutinAktif} rutin selesai`
            : 'belum ada rutin'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[11.5px] font-bold text-muted-foreground">
          {stats?.tugasJalan ?? 0} tugas jalan
        </span>
        {(stats?.tugasNunggu ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-[11.5px] font-bold text-warning dark:bg-warning/15 dark:text-warning/80">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {stats?.tugasNunggu} nunggu orang
          </span>
        )}
      </div>

      {/* ── Sub-tab internal ── */}
      <Tabs value={subTab} onValueChange={setSubTab} className="gap-4">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="today" className="flex-1 gap-1 whitespace-nowrap text-xs sm:text-sm">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Hari Ini
          </TabsTrigger>
          <TabsTrigger value="routines" className="flex-1 gap-1 whitespace-nowrap text-xs sm:text-sm">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Rutinitas
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 gap-1 whitespace-nowrap text-xs sm:text-sm">
            <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
            Catatan
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-1 whitespace-nowrap text-xs sm:text-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Asisten AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-0">
          <WorkToday
            date={today}
            data={data}
            isLoading={isLoading}
            onEditTask={openTaskEditor}
            onGoTo={setSubTab}
          />
        </TabsContent>
        <TabsContent value="routines" className="mt-0">
          <WorkRoutines date={today} data={data} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="notes" className="mt-0">
          <WorkNotes date={today} data={data} isLoading={isLoading} onOpenTask={(task) => openTaskEditor(task)} />
        </TabsContent>
        <TabsContent value="ai" className="mt-0">
          <WorkAssistant date={today} data={data} />
        </TabsContent>
      </Tabs>

      {/* Editor tugas (Sheet) */}
      <WorkTaskEditor date={today} state={editorState} onClose={() => setEditorState({ task: null })} />
    </div>
  );
}
