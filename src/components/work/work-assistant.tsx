// ---------------------------------------------------------------------------
// src/components/work/work-assistant.tsx — sub-tab "Asisten AI" (Task 17-a).
// Fitur bintang: chip cepat (susun jadwal / apa yang nunggu — logika klien,
// tanpa LLM) + "Rapikan catatanku" (POST /api/work/ai → terapkan semua).
// ---------------------------------------------------------------------------
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, Check, Clock, Sparkles, StickyNote, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyAiResult, useAiParse } from './use-work-api';
import type { AiParsedPayload, WorkPayload } from './work-types';

type ChatMessage =
  | { id: number; role: 'ai'; kind: 'text'; text: string }
  | { id: number; role: 'ai'; kind: 'list'; title: string; items: { main: string; sub: string }[]; closing?: string }
  | { id: number; role: 'ai'; kind: 'ai-result'; result: AiParsedPayload }
  | { id: number; role: 'user'; kind: 'text'; text: string };

let msgId = 1;
const nextId = () => msgId++;

function AiBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="premium-card max-w-[92%] rounded-2xl rounded-tl-md p-3.5 sm:max-w-[85%]">{children}</div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-gradient-to-br from-teal-500 to-emerald-500 p-3.5 text-[13.5px] leading-relaxed text-white premium-fab-shadow sm:max-w-[85%]">
      {text}
    </div>
  );
}

export function WorkAssistant({ date, data }: { date: string; data: WorkPayload | undefined }) {
  const aiParse = useAiParse();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rapikanOpen, setRapikanOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedIds, setAppliedIds] = useState<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sapaan = derivasi render (bukan effect) supaya tidak cascading render.
  const greeting = useMemo(() => {
    const hello = 'Halo! Aku asisten meja kerjam.';
    if (!data) return [hello];
    const pendingRoutines = data.stats.rutinAktif - data.stats.rutinSelesai;
    if (pendingRoutines > 0) {
      return [hello, `Ada ${pendingRoutines} rutinitas yang belum selesai hari ini. Mau kususun urutannya dari yang paling ringan dulu?`];
    }
    if (data.stats.tugasTodo + data.stats.tugasJalan > 0) {
      return [hello, 'Rutinitas hari ini sudah rapi. Ada beberapa tugas lepas — mau kubantu susun?'];
    }
    return [hello, 'Meja kerjamu bersih. Ada yang bisa kubantu?'];
  }, [data]);

  // Auto-scroll ke bawah saat pesan baru.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, rapikanOpen, aiParse.isPending]);

  const push = (message: Omit<ChatMessage, 'id'> & { id?: number }) =>
    setMessages((prev) => [...prev, { ...message, id: message.id ?? nextId() } as ChatMessage]);

  const handleSusunJadwal = () => {
    push({ role: 'user', kind: 'text', text: 'Susun jadwalku' });
    if (!data) return;
    const routinesLeft = data.routines
      .filter((r) => r.active && !r.doneToday)
      .sort((a, b) => {
        const order = { pagi: 0, siang: 1, sore: 2 } as Record<string, number>;
        return (order[a.timeOfDay] ?? 3) - (order[b.timeOfDay] ?? 3);
      });
    const tasksLeft = data.tasks.filter((t) => t.status !== 'selesai');
    if (routinesLeft.length === 0 && tasksLeft.length === 0) {
      push({ role: 'ai', kind: 'text', text: 'Semua sudah beres hari ini. Mantap! Waktunya istirahat sebentar — besok rutinitasmu muncul lagi sendiri.' });
      return;
    }
    const items: { main: string; sub: string }[] = [];
    for (const r of routinesLeft) {
      items.push({ main: r.title, sub: `rutin ${r.timeOfDay}` });
    }
    for (const t of tasksLeft) {
      items.push({
        main: t.title,
        sub: t.overdue ? 'lewat tenggat — prioritaskan ini' : t.kapanSaja ? 'kapan saja' : 'tugas hari ini',
      });
    }
    push({
      role: 'ai',
      kind: 'list',
      title: `Ini urutan kerjamu hari ini — ${items.length} hal, mulai dari atas:`,
      items,
      closing: 'Satu-satu ya — beres satu, baru lanjut satu. Semangat!',
    });
  };

  const handleApaNunggu = () => {
    push({ role: 'user', kind: 'text', text: 'Apa yang nunggu?' });
    if (!data) return;
    const nunggu = data.tasks.filter((t) => t.status === 'nunggu');
    if (nunggu.length === 0) {
      push({ role: 'ai', kind: 'text', text: 'Nggak ada yang nunggu orang sekarang — semua di tanganmu sendiri. Kalau ada balasan masuk, ubah statusnya jadi “nunggu” biar kepingin kucek.' });
      return;
    }
    push({
      role: 'ai',
      kind: 'list',
      title: `${nunggu.length} tugas sedang menunggu orang lain:`,
      items: nunggu.map((t) => ({
        main: t.title,
        sub: t.notes ? t.notes : 'belum ada catatan',
      })),
      closing: 'Sambil nunggu, kerjakan yang lain dulu — jangan disimpen doang di kepala.',
    });
  };

  const handleRapikan = () => {
    setRapikanOpen(true);
    push({ role: 'user', kind: 'text', text: 'Rapikan catatanku' });
    push({ role: 'ai', kind: 'text', text: 'Oke — tempel catatan berantakanmu di kotak bawah (apa adanya boleh). Nanti kupilah jadi tugas & catatan.' });
  };

  const submitRapikan = () => {
    const text = draft.trim();
    if (!text) return;
    setRapikanOpen(false);
    push({ role: 'user', kind: 'text', text });
    aiParse.mutate(text, {
      onSuccess: (result) => {
        push({ role: 'ai', kind: 'ai-result', result });
        setDraft('');
      },
      // Error sudah ditampilkan sebagai toast oleh hook.
    });
  };

  const handleTerapkan = (messageId: number, result: AiParsedPayload) => {
    if (applying || appliedIds.includes(messageId)) return;
    setApplying(true);
    applyAiResult(result, date).then((counts) => {
      queryClient.invalidateQueries({ queryKey: ['work'] });
      setAppliedIds((prev) => [...prev, messageId]);
      toast.success(`${counts.tasks} tugas & ${counts.notes} catatan ditambahkan`);
      push({
        role: 'ai',
        kind: 'text',
        text: 'Sudah kuterapkan ke meja kerjamu — tugas ada di tab Hari Ini, catatan ada di tab Catatan. Kalau ada yang salah, tinggal edit.',
      });
      if (counts.tasks + counts.notes < result.tasks.length + result.notes.length) {
        toast.error('Sebagian item gagal ditambahkan — coba lagi sebentar');
      }
      setApplying(false);
    });
  };

  return (
    <div className="pt-1">
      {/* Kepala asisten */}
      <div className="premium-card flex items-center gap-3 rounded-2xl p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white premium-fab-shadow">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold tracking-tight text-foreground">Asisten Meja Kerja</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            online — siap bantu kapan saja
          </p>
        </div>
      </div>

      {/* Alur chat */}
      <div
        ref={scrollRef}
        className="mt-3 flex max-h-[52dvh] flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1 custom-scrollbar"
        role="log"
        aria-label="Percakapan dengan asisten"
        aria-live="polite"
      >
        {greeting.map((text, i) => (
          <div key={`greet-${i}`} className="flex flex-col gap-2.5">
            <AiBubble>
              <p className="text-[13.5px] leading-relaxed text-foreground">{text}</p>
            </AiBubble>
          </div>
        ))}
        {messages.map((message) => (
          <div key={message.id} className={cn('flex flex-col gap-2.5', message.role === 'user' && 'items-end')}>
            {message.role === 'user' ? (
              <UserBubble text={message.text} />
            ) : message.kind === 'text' ? (
              <AiBubble>
                <p className="text-[13.5px] leading-relaxed text-foreground">{message.text}</p>
              </AiBubble>
            ) : message.kind === 'list' ? (
              <AiBubble>
                <p className="text-[13.5px] font-semibold leading-relaxed text-foreground">{message.title}</p>
                <ul className="mt-2.5 space-y-2.5">
                  {message.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-primary/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold leading-snug text-foreground">{item.main}</p>
                        <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {message.closing && (
                  <p className="mt-2.5 border-t border-dashed border-border pt-2 text-[12px] leading-relaxed text-muted-foreground">
                    {message.closing}
                  </p>
                )}
              </AiBubble>
            ) : (
              <AiBubble>
                <p className="text-[13.5px] leading-relaxed text-foreground">{message.result.summary}</p>
                <ul className="mt-2.5 space-y-2">
                  {message.result.tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold leading-snug text-foreground">{task.title}</p>
                        <p className="text-[11px] text-muted-foreground">Tugas · masuk ke Hari Ini</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {message.result.notes.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {message.result.notes.map((note, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl bg-warning/10 px-2.5 py-2 text-warning dark:bg-warning/15 dark:text-warning/80">
                        <StickyNote className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <p className="work-serif min-w-0 flex-1 truncate text-[13px]">{note.content}</p>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide opacity-80">Catatan</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleTerapkan(message.id, message.result)}
                  disabled={applying || appliedIds.includes(message.id)}
                  className={cn(
                    'mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    appliedIds.includes(message.id)
                      ? 'bg-muted text-muted-foreground'
                      : 'btn-primary-gradient text-white premium-fab-shadow active:scale-[0.98]'
                  )}
                >
                  {appliedIds.includes(message.id) ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" /> Sudah diterapkan
                    </>
                  ) : applying ? (
                    'Menerapkan…'
                  ) : (
                    <>
                      Terapkan semua <Check className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </AiBubble>
            )}
          </div>
        ))}

        {aiParse.isPending && (
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="grid h-11 w-11 place-items-center rounded-2xl rounded-tl-md bg-muted">
              <Sparkles className="h-4 w-4 animate-pulse text-primary" aria-hidden="true" />
            </span>
            Memilah catatanmu…
          </div>
        )}

        {rapikanOpen && (
          <div className="premium-card rounded-2xl p-3.5">
            <label htmlFor="ai-draft" className="text-xs font-bold text-foreground">
              Tempel catatan berantakanmu di sini
            </label>
            <Textarea
              id="ai-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={'contoh:\nrevisi poster warna merah\njangan lupa beli kopi kantor\nkirim laporan jam 4\ntanya budi soal invoice'}
              className="mt-2 work-serif text-[13px]"
            />
            <div className="mt-2.5 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRapikanOpen(false)}>
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={submitRapikan}
                disabled={!draft.trim() || aiParse.isPending}
                className="btn-primary-gradient"
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                Rapikan
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Chip cepat */}
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Aksi cepat asisten">
        {[
          { label: 'Susun jadwalku', icon: CalendarClock, onClick: handleSusunJadwal },
          { label: 'Apa yang nunggu?', icon: Clock, onClick: handleApaNunggu },
          { label: 'Rapikan catatanku', icon: Wand2, onClick: handleRapikan },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.onClick}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-bold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <chip.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {chip.label}
          </button>
        ))}
      </div>

      <p className="mt-3 px-1 text-center text-[11px] text-muted-foreground/70">
        Jalan di server Rutina — catatanmu tetap milikmu.
      </p>
    </div>
  );
}
