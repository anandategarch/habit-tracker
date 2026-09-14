// ---------------------------------------------------------------------------
// src/components/work/work-desk.tsx — TAB "Meja Kerja" (Task 17-a).
// Catatan kerjaan harian: rutinitas berulang + tugas lepas + catatan kilat +
// Asisten AI. Struktur & rasa visual meniru mockup public/meja-kerja.html
// (Aurora teal, badge RUTIN/SEKALI/BARU/MENUNGGU, pratinjau serif Georgia).
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { Briefcase, CalendarDays, Check, Clock, Columns3, NotebookPen, Repeat, Sparkles, Umbrella } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';
import { useSetDayFlag, useWorkBoard, useWorkData } from './use-work-api';
import { WorkToday } from './work-today';
import { WorkRoutines } from './work-routines';
import { WorkNotes } from './work-notes';
import { WorkAssistant } from './work-assistant';
import { WorkBoard } from './work-board';
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
  const boardQuery = useWorkBoard(today);
  const setDayFlag = useSetDayFlag(today);
  const [editorState, setEditorState] = useState<TaskEditorState>({ task: null });

  const stats = data?.stats;
  const holiday = data?.holiday ?? false;
  const allDone =
    !!stats &&
    (holiday || (stats.rutinAktif > 0 && stats.rutinSelesai === stats.rutinAktif)) &&
    stats.tugasTodo + stats.tugasJalan + stats.tugasNunggu === 0;

  const openTaskEditor = (task: WorkTaskItem | null, draftTitle?: string) =>
    setEditorState({ task, draftTitle });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ── Header — Task 41: seragam PageHeader (ikon Briefcase + eyebrow
          tanggal Jakarta), CTA "Tanya AI" tetap menempel kanan. ── */}
      <PageHeader
        title="Meja Kerja"
        subtitle={
          holiday
            ? 'Hari libur — santai dulu, kerjaan nggak ke mana-mana.'
            : allDone
              ? 'Meja bersih. Mantap hari ini!'
              : 'Satu-satu, semua beres.'
        }
        icon={Briefcase}
        eyebrow={formatLongIndoDate(today)}
        chipClassName="chip-emerald"
      >
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
      </PageHeader>

      {/* ── Pil statistik ── */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Ringkasan hari ini">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold',
            holiday
              ? 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80'
              : 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary'
          )}
        >
          {holiday ? (
            <>
              <Umbrella className="h-3 w-3" aria-hidden="true" />
              Mode Libur
            </>
          ) : (
            <>
              <Check className="h-3 w-3" aria-hidden="true" />
              {stats && stats.rutinAktif > 0
                ? `${stats.rutinSelesai}/${stats.rutinAktif} rutin selesai`
                : 'belum ada rutin'}
            </>
          )}
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

      {/* ── Mode Libur (Fase 2) ── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/25 bg-warning/5 px-4 py-3 dark:bg-warning/10">
        <div className="min-w-0">
          <label
            htmlFor="work-mode-libur"
            className="flex items-center gap-1.5 text-[13px] font-bold text-foreground"
          >
            <Umbrella className="h-4 w-4 text-warning" aria-hidden="true" />
            Mode Libur
          </label>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {holiday
              ? 'Rutinitas hari ini diliburkan — tugas & catatan tetap bisa dipakai.'
              : 'Nyalakan kalau hari ini libur / mau istirahat dari rutinitas.'}
          </p>
        </div>
        <Switch
          id="work-mode-libur"
          checked={holiday}
          onCheckedChange={(checked) => setDayFlag.mutate({ holiday: checked })}
          disabled={setDayFlag.isPending}
          aria-label="Mode Libur untuk hari ini"
        />
      </div>

      {/* ── Sub-tab internal ── */}
      {/* BUGFIX MOBILE-CLIP-2 (Task 29): on 390px the 5 triggers' intrinsic
          width (~397px) exceeded the bar — "Asisten AI" was sliced mid-word
          at the right edge with no affordance. Mobile now uses compact
          padding/gap + a shorter label ("Asisten" — peran AI sudah jelas
          dari ikon Sparkles), so all 5 pills fit without horizontal scroll
          down to 360px. */}
      <Tabs value={subTab} onValueChange={setSubTab} className="gap-4">
        <TabsList className="flex w-full gap-0.5 overflow-x-auto scrollbar-hide rounded-xl bg-muted/60 p-1 h-auto">
          <TabsTrigger value="today" className="flex-1 gap-0.5 whitespace-nowrap rounded-lg py-1.5 px-2 text-[11px] sm:gap-1 sm:px-3 sm:text-xs data-[state=active]:shadow-md">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Hari Ini
          </TabsTrigger>
          <TabsTrigger value="routines" className="flex-1 gap-0.5 whitespace-nowrap rounded-lg py-1.5 px-2 text-[11px] sm:gap-1 sm:px-3 sm:text-xs data-[state=active]:shadow-md">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Rutinitas
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 gap-0.5 whitespace-nowrap rounded-lg py-1.5 px-2 text-[11px] sm:gap-1 sm:px-3 sm:text-xs data-[state=active]:shadow-md">
            <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
            Catatan
          </TabsTrigger>
          <TabsTrigger value="board" className="flex-1 gap-0.5 whitespace-nowrap rounded-lg py-1.5 px-2 text-[11px] sm:gap-1 sm:px-3 sm:text-xs data-[state=active]:shadow-md">
            <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
            Papan
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-0.5 whitespace-nowrap rounded-lg py-1.5 px-2 text-[11px] sm:gap-1 sm:px-3 sm:text-xs data-[state=active]:shadow-md">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Asisten
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
        <TabsContent value="board" className="mt-0">
          <WorkBoard
            date={today}
            board={boardQuery.data}
            isLoading={boardQuery.isLoading}
            boardError={boardQuery.isError}
            onRetryBoard={() => {
              void boardQuery.refetch();
            }}
            routines={data?.routines}
            holiday={holiday}
            onEditTask={openTaskEditor}
          />
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
