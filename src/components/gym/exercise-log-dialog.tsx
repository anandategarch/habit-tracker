'use client';

// ---------------------------------------------------------------------------
// src/components/gym/exercise-log-dialog.tsx — CATAT SET AKTUAL (Task 74 F3).
//
// Dialog satu gerakan dari daftar latihan zona (ZoneExerciseList): catat
// berapa set × jumlah yang BENAR-BENAR dikerjakan (rencana = prefill).
// Mencatat ulang hari yang sama = koreksi baris yang sama (upsert server).
//
// Perayaan PR: respons POST membawa isPr + prevBestAmount → toast rekor +
// confetti pelangi + getar perangkat. Saran istirahat (RestTimer) diberi
// tahu lewat onSaved supaya "istirahat antar set" muncul otomatis.
//
// Prinsip tetap: jurnal TIDAK menyentuh XP/streak — murni catatan performa.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { Minus, Plus, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { burstFromElement } from '@/lib/confetti';
import {
  exerciseDisplay,
  exerciseNameKey,
  prLabel,
  validateSetLogInput,
  type GymExerciseUnit,
  type GymZonePayload,
  type GymZoneSetsPayload,
} from '@/lib/muscle-map';
import type { RestSuggestion } from './rest-timer';
import { useGymSetDelete, useGymSetSave } from './use-gym-sets';
import type { GymExerciseView } from './zone-focus-sheet';

/** Stepper angka: tombol −/+ besar (ramah sentuh) + input numerik. */
function Stepper({
  value,
  onChange,
  min,
  max,
  label,
  suffix,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  min: number;
  max: number;
  label: string;
  suffix?: string;
  disabled?: boolean;
}) {
  const step = (delta: number) => {
    const n = Number(value);
    const next = Number.isFinite(n) ? Math.min(max, Math.max(min, n + delta)) : min;
    onChange(String(next));
  };
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-card/60 p-3"
      role="group"
      aria-label={label}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        {/* Task 70 (audit 70-d MAJOR #2): 44px touch target. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => step(-1)}
          disabled={disabled}
          aria-label={`Kurangi ${label}`}
          className="h-11 w-11 shrink-0 cursor-pointer"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="relative min-w-0 flex-1">
          <Input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            disabled={disabled}
            aria-label={`${label} (ketik angka)`}
            className="h-11 text-center text-base font-bold tabular-nums"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => step(1)}
          disabled={disabled}
          aria-label={`Tambah ${label}`}
          className="h-11 w-11 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {suffix && <p className="text-[10px] text-muted-foreground">{suffix}</p>}
    </div>
  );
}

export function ExerciseLogDialog({
  zone,
  exercise,
  setsPayload,
  onSaved,
  onClose,
}: {
  zone: GymZonePayload;
  /** Gerakan rencana (nama + rencana set × jumlah + satuan). */
  exercise: GymExerciseView;
  setsPayload: GymZoneSetsPayload | undefined;
  /** Dipanggil SETELAH simpan sukses — pemicu saran RestTimer (opsional). */
  onSaved?: (suggest: RestSuggestion) => void;
  onClose: () => void;
}) {
  const save = useGymSetSave();
  const del = useGymSetDelete();

  const todayYmd = setsPayload?.todayYmd ?? '';
  const nameKey = exerciseNameKey(exercise.name);
  // Koreksi: catatan hari ini gerakan ini (satuan apa pun) jadi prefill.
  const todayLog = setsPayload?.logs.find((r) => r.nameKey === nameKey && r.dayKey === todayYmd) ?? null;
  const isCorrection = todayLog !== null;
  const pr = setsPayload?.prs.find((p) => p.nameKey === nameKey && p.unit === exercise.unit) ?? null;

  const [sets, setSets] = useState(() => String(todayLog?.sets ?? exercise.sets));
  const [amount, setAmount] = useState(() => String(todayLog?.amount ?? exercise.amount));
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const saveBtnRef = useRef<HTMLButtonElement | null>(null);
  const pending = save.isPending || del.isPending;

  const unit: GymExerciseUnit = exercise.unit;
  const planText = exerciseDisplay({ sets: exercise.sets, amount: exercise.amount, unit });

  const handleSave = () => {
    const validated = validateSetLogInput({
      zone: zone.key,
      exercise: exercise.name,
      sets: Number(sets),
      amount: Number(amount),
      unit,
    });
    if (!validated.ok) {
      toast.error(validated.error);
      return;
    }
    save
      .mutateAsync({
        zone: zone.key,
        zoneLabel: zone.label,
        exercise: exercise.name,
        sets: validated.sets,
        amount: validated.amount,
        unit: validated.unit,
      })
      .then((result) => {
        if (result.isPr) {
          toast.success(
            `🏆 Rekor baru! ${exercise.name} — ${result.log.amount} ${result.log.unit}${
              result.prevBestAmount !== null ? ` (rekor lama ${prLabel(result.prevBestAmount, result.log.unit)})` : ''
            }`,
          );
          burstFromElement(saveBtnRef.current, { count: 26, rainbow: true });
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
              navigator.vibrate([80, 60, 80]);
            } catch {
              /* perangkat menolak getaran — abaikan */
            }
          }
        } else {
          toast.success(`${exercise.name} tercatat — ${result.log.sets} × ${result.log.amount} ${result.log.unit}`);
        }
        onSaved?.({ zoneKey: zone.key, label: exercise.name, emoji: '⏱️' });
        onClose();
      })
      .catch(() => {
        /* toast error sudah ditangani onError di hook */
      });
  };

  const handleDelete = () => {
    if (!todayLog) return;
    setDeleteConfirmOpen(false);
    del
      .mutateAsync({ id: todayLog.id, zone: zone.key })
      .then(() => onClose())
      .catch(() => {
        /* toast error sudah ditangani onError di hook */
      });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex w-full flex-col gap-0 overflow-visible p-0 sm:max-w-sm">
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-3 text-left text-base">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ background: `${zone.color}1f`, border: `1px solid ${zone.color}55` }}
              aria-hidden="true"
            >
              {zone.emoji}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{exercise.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {zone.label} · rencana {planText}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            {isCorrection
              ? 'Kamu sudah mencatat gerakan ini hari ini — menyimpan akan mengoreksi catatan itu.'
              : 'Catat performa aslimu hari ini (rencana hanya titik awal).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          {/* Konteks PR — motivasi "berapa lagi untuk rekor". */}
          <div
            className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5"
            role="status"
          >
            <Trophy className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <div className="min-w-0 text-xs">
              {pr ? (
                <>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    Rekor kamu: {prLabel(pr.bestAmount, pr.unit)} · {pr.bestSets} set
                  </p>
                  <p className="text-muted-foreground">
                    {Number(amount) > pr.bestAmount
                      ? 'Angka saat ini MELAMPAUI rekor — simpan untuk PR baru! 🔥'
                      : `Butuh ${pr.bestAmount + 1}+ ${pr.unit} untuk PR baru.`}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">Belum ada rekor</p>
                  <p className="text-muted-foreground">Catatan pertama menjadi rekor awalmu 🏆</p>
                </>
              )}
            </div>
          </div>

          <Stepper
            value={sets}
            onChange={setSets}
            min={1}
            max={50}
            label="Set"
            suffix="Berapa putaran kamu selesaikan?"
            disabled={pending}
          />
          <Stepper
            value={amount}
            onChange={setAmount}
            min={1}
            max={9999}
            label={`Jumlah per set (${unit})`}
            suffix={
              unit === 'detik' || unit === 'menit'
                ? 'Durasi tiap set sesuai rencanamu.'
                : 'Reps/taps/putaran per set.'
            }
            disabled={pending}
          />
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:items-center">
          {isCorrection && todayLog && (
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  className="mr-auto cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  Hapus Catatan
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus catatan hari ini?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Catatan {exercise.name} hari ini akan dihapus dari jurnal. Rekor dihitung ulang dari
                    sisa riwayat.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={pending}
                    className="cursor-pointer"
                  >
                    Hapus
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending} className="cursor-pointer">
            Batal
          </Button>
          <Button
            ref={saveBtnRef}
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="cursor-pointer"
            aria-label={`Simpan catatan ${exercise.name}`}
          >
            {save.isPending ? 'Menyimpan…' : isCorrection ? 'Koreksi Catatan' : 'Catat Set'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
