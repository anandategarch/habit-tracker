'use client';

// ---------------------------------------------------------------------------
// src/components/gym/cardio-card.tsx — KARTU KARDIO (Task 76 Bonus #2).
//
// Kartu ringkasan di tab Gym (setelah Timer Istirahat): statistik minggu
// berjalan (sesi/menit/km/kcal), jarak terjauh per jenis (PR-flavor), daftar
// riwayat 30 hari (hapus per baris), dan CTA buka dialog catat sesi.
// Estimasi kcal diturunkan server dari MET × berat terakhir (synergy F2) —
// kardio murni lapisan catat, XP/streak tak tersentuh.
// ---------------------------------------------------------------------------

import { Footprints, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import {
  CARDIO_KIND_DEF_BY_KEY,
  formatCardioDuration,
  formatKm,
  type GymCardioEntry,
  type GymCardioPayload,
} from '@/lib/muscle-map';
import { formatDayKey } from './set-log-format';
import { useGymCardioDelete } from './use-gym-cardio';

function cardioLine(e: GymCardioEntry): string {
  const km = formatKm(e.distanceKm);
  return `${formatCardioDuration(e.durationMin)}${e.distanceKm !== null ? ` · ${km}` : ''} · ~${e.kcal} kkal`;
}

function CardioRow({ entry, todayYmd, onDelete }: { entry: GymCardioEntry; todayYmd: string; onDelete: (id: string) => void }) {
  const def = CARDIO_KIND_DEF_BY_KEY[entry.kind];
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/40 px-3 py-2">
      <span className="text-lg leading-none" aria-hidden="true">
        {def?.emoji ?? '🏃'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          {def?.label ?? entry.kind} <span className="font-normal text-muted-foreground">· {cardioLine(entry)}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">{formatDayKey(entry.dayKey, todayYmd)}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDelete(entry.id)}
        aria-label={`Hapus sesi ${def?.label ?? entry.kind}`}
        className="h-9 w-9 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function CardioCard({ data, onLog }: { data: GymCardioPayload; onLog: () => void }) {
  const del = useGymCardioDelete();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const confirmEntry = confirmId ? data.entries.find((e) => e.id === confirmId) ?? null : null;

  const handleDelete = () => {
    if (!confirmId) return;
    setConfirmId(null);
    del.mutate({ id: confirmId });
  };

  const { sessions, totalMin, totalKm, totalKcal } = data.thisWeek;

  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Footprints className="h-4 w-4 text-primary" aria-hidden="true" />
          Kardio
        </h2>
        <p className="text-xs text-muted-foreground">jalan · lari · sepeda · renang</p>
      </div>

      {/* Statistik minggu berjalan. */}
      <div className="mt-3 grid grid-cols-4 gap-1.5 text-center" aria-label="Ringkasan kardio minggu ini">
        {[
          { label: 'sesi', value: String(sessions) },
          { label: 'menit', value: String(totalMin) },
          { label: 'km', value: totalKm === null ? '—' : formatKm(totalKm).replace(' km', '') },
          { label: 'kkal', value: sessions > 0 ? `~${totalKcal}` : '—' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card/40 px-1 py-2">
            <p className="text-sm font-bold tabular-nums text-foreground">{s.value}</p>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Jarak satu sesi terjauh per jenis. */}
      {data.bests.length > 0 && (
        <p className="mt-2.5 truncate text-[11px] text-muted-foreground">
          🏆 Terjauh:{' '}
          {data.bests
            .slice(0, 2)
            .map((b) => `${CARDIO_KIND_DEF_BY_KEY[b.kind]?.label ?? b.kind} ${formatKm(b.distanceKm)}`)
            .join(' · ')}
        </p>
      )}

      {/* Riwayat (max-h + custom-scrollbar — pola zone-set-history). */}
      {data.entries.length > 0 ? (
        <div className="custom-scrollbar mt-3 max-h-44 space-y-2 overflow-y-auto pr-0.5">
          {data.entries.map((e) => (
            <CardioRow key={e.id} entry={e} todayYmd={data.todayYmd} onDelete={setConfirmId} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
          Belum ada kardio 30 hari terakhir — catat jalan pagi pertamamu? 🚶
        </p>
      )}

      <Button type="button" onClick={onLog} className="mt-3 h-10 w-full cursor-pointer" aria-label="Catat sesi kardio baru">
        Catat Kardio
      </Button>

      {/* Konfirmasi hapus (pola AlertDialog ExerciseLogDialog). */}
      <AlertDialog open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus sesi kardio?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmEntry
                ? `${CARDIO_KIND_DEF_BY_KEY[confirmEntry.kind]?.label ?? confirmEntry.kind} — ${cardioLine(confirmEntry)} akan dihapus dari jurnal.`
                : 'Sesi ini akan dihapus dari jurnal kardio.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Batal</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={del.isPending} className="cursor-pointer">
              Hapus
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollReveal>
  );
}
