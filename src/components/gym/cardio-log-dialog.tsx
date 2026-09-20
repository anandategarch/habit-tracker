'use client';

// ---------------------------------------------------------------------------
// src/components/gym/cardio-log-dialog.tsx — CATAT SESI KARDIO (Task 76 Bonus
// #2). Dialog dari tombol "Catat Kardio" di kartu: pilih jenis (chip 2×2),
// durasi (stepper ±5 menit), jarak opsional (input km koma desimal + chip
// cepat), estimasi kcal/pace LANGSUNG memakai aturan yang sama dengan server
// (estimateCardioKcal + berat payload — dua sisi satu aturan).
// Validasi memakai validateCardioInput() — Simpan ter-disable bila invalid.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  CARDIO_KIND_LIST,
  estimateCardioKcal,
  formatCardioDuration,
  formatPace,
  validateCardioInput,
  type GymCardioKind,
  type GymCardioPayload,
} from '@/lib/muscle-map';
import { useGymCardioSave } from './use-gym-cardio';

const QUICK_KM = [1, 3, 5, 10];

/** Stepper durasi: tombol −/+ 5 menit (ramah sentuh) + input numerik. */
function DurationStepper({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  const step = (delta: number) => {
    const n = Number(value);
    const next = Number.isFinite(n) ? Math.min(600, Math.max(1, n + delta)) : 1;
    onChange(String(next));
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-card/60 p-3" role="group" aria-label="Durasi menit">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Durasi (menit)</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => step(-5)}
          disabled={disabled}
          aria-label="Kurangi 5 menit"
          className="h-11 w-11 shrink-0 cursor-pointer"
        >
          −5
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={1}
          max={600}
          disabled={disabled}
          aria-label="Durasi dalam menit (ketik angka)"
          className="h-11 text-center text-base font-bold tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => step(5)}
          disabled={disabled}
          aria-label="Tambah 5 menit"
          className="h-11 w-11 shrink-0 cursor-pointer"
        >
          +5
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Berapa lama kamu bergerak?</p>
    </div>
  );
}

/** Parse input km koma/dot desimal → number | null. */
function parseKm(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function CardioLogDialog({
  payload,
  onClose,
}: {
  /** Payload kartu — berat terakhir untuk estimasi kcal klien. */
  payload: GymCardioPayload;
  onClose: () => void;
}) {
  const save = useGymCardioSave();

  const [kind, setKind] = useState<GymCardioKind>('walk');
  const [duration, setDuration] = useState('30');
  const [kmRaw, setKmRaw] = useState('');

  const durationNum = Number(duration);
  const kmNum = parseKm(kmRaw);

  const validated = validateCardioInput({
    kind,
    durationMin: Number.isFinite(durationNum) ? durationNum : Number.NaN,
    distanceKm: kmRaw.trim() === '' ? null : (kmNum ?? Number.NaN),
  });

  // Estimasi langsung — aturan SAMA dengan server (MET × berat × jam).
  const kcalPreview =
    validated.ok ? estimateCardioKcal(kind, validated.durationMin, payload.weightKg) : null;
  const pacePreview = validated.ok ? formatPace(validated.durationMin, validated.distanceKm) : null;
  const kindDef = CARDIO_KIND_LIST.find((k) => k.key === kind);

  const handleSave = () => {
    if (!validated.ok) {
      toast.error(validated.error);
      return;
    }
    save
      .mutateAsync({ kind: validated.kind, durationMin: validated.durationMin, distanceKm: validated.distanceKm })
      .then(() => {
        toast.success(
          `${kindDef?.label ?? 'Kardio'} tercatat — ${formatCardioDuration(validated.durationMin)}${
            validated.distanceKm !== null ? ` · ${String(validated.distanceKm).replace('.', ',')} km` : ''
          }`,
        );
        onClose();
      })
      .catch(() => {
        /* toast error sudah ditangani onError di hook */
      });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <DialogContent className="flex w-full flex-col gap-0 overflow-visible p-0 sm:max-w-sm">
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-3 text-left text-base">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg"
              aria-hidden="true"
            >
              🏃
            </span>
            <span className="flex min-w-0 flex-col">
              <span>Catat Kardio</span>
              <span className="text-xs font-normal text-muted-foreground">
                jalan · lari · sepeda · renang
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            Satu sesi = satu catatan. Jalan pagi + lari sore boleh dua catatan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          {/* Jenis kardio — chip 2×2. */}
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Jenis kardio">
            {CARDIO_KIND_LIST.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                disabled={save.isPending}
                aria-pressed={kind === k.key}
                aria-label={`Jenis ${k.label}`}
                className={cn(
                  'flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-colors',
                  kind === k.key
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  {k.emoji}
                </span>
                <span className="text-[10px] font-medium leading-tight">{k.label}</span>
              </button>
            ))}
          </div>

          <DurationStepper value={duration} onChange={setDuration} disabled={save.isPending} />

          {/* Jarak opsional — koma desimal Indonesia. */}
          <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-card/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Jarak (km) — opsional
            </p>
            <Input
              type="text"
              inputMode="decimal"
              value={kmRaw}
              onChange={(e) => setKmRaw(e.target.value)}
              disabled={save.isPending}
              placeholder="mis. 4,2 — kosongkan bila tanpa jarak"
              aria-label="Jarak dalam kilometer (opsional)"
              className="h-11 text-center text-base font-bold tabular-nums"
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jarak cepat">
              {QUICK_KM.map((km) => (
                <Button
                  key={km}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setKmRaw(String(km))}
                  disabled={save.isPending}
                  className="h-8 cursor-pointer px-2.5 text-[11px] tabular-nums"
                >
                  +{km} km
                </Button>
              ))}
              {kmRaw.trim() !== '' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setKmRaw('')}
                  disabled={save.isPending}
                  className="h-8 cursor-pointer px-2.5 text-[11px] text-muted-foreground"
                >
                  Tanpa jarak
                </Button>
              )}
            </div>
          </div>

          {/* Estimasi langsung — aturan sama dengan server. */}
          <div
            className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground"
            role="status"
          >
            {kcalPreview !== null ? (
              <>
                <span className="font-semibold tabular-nums">≈ {kcalPreview} kkal</span>
                {pacePreview && <span className="text-muted-foreground">· {pacePreview}</span>}
                {payload.weightKg === null && (
                  <span className="text-muted-foreground">(berat default 65 kg)</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{validated.ok ? '' : validated.error}</span>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:items-center">
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending} className="cursor-pointer">
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={save.isPending || !validated.ok}
            className="cursor-pointer"
            aria-label="Simpan sesi kardio"
          >
            {save.isPending ? 'Menyimpan…' : 'Catat Sesi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
