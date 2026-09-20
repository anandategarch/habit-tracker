'use client';

// ---------------------------------------------------------------------------
// src/components/gym/exercise-editor.tsx — EDITOR LATIHAN ZONA (Task 67).
//
// Dialog CRUD penuh daftar gerakan zona: ubah nama/jumlah, tambah baris,
// hapus baris — fleksibel sesuai permintaan user ("semua kegiatan gym bisa
// diganti... itu aku bisa edit hapus atau tambah secara fleksibel").
//
// * Membuka editor = state awal dari daftar EFEKTIF zona (kustom bila sudah
//   dikustomisasi, atau salinan preset default) → user mengubah apa adanya.
// * Simpan (PUT) = replace-all transaksional; daftar kosong = sah.
// * "Kembalikan Default" (DELETE) = buang kustomisasi → preset kembali.
// * Dipasang dengan key={zone.key} oleh GymScreen → state selalu segar saat
//   dibuka ulang (tidak perlu sinkron dengan query yang berjalan).
//
// Prinsip Peta Otot tetap: mengubah latihan tidak menyentuh XP/streak.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Dumbbell, Plus, RotateCcw, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  GYM_EXERCISE_UNITS,
  type GymExerciseItem,
  type GymExerciseUnit,
  type GymZonePayload,
} from '@/lib/muscle-map';
import { useGymExerciseReset, useGymExerciseSave } from './use-gym';

const MAX_ROWS = 20;

/** Baris editable — set/amount disimpan sebagai string (mulus saat diketik). */
interface EditRow {
  key: string;
  name: string;
  sets: string;
  amount: string;
  unit: GymExerciseUnit;
}

let rowKeySeq = 0;
function newRow(partial?: Partial<EditRow>): EditRow {
  rowKeySeq += 1;
  return {
    key: `row-${rowKeySeq}`,
    name: '',
    sets: '3',
    amount: '12',
    unit: 'reps',
    ...partial,
  };
}

/** Validasi klien sebelum PUT (server memvalidasi ulang ketat). */
function validateRows(rows: EditRow[]): GymExerciseItem[] | string {
  const items: GymExerciseItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row.name.trim();
    if (!name) return `Nama gerakan ke-${i + 1} tidak boleh kosong`;
    if (name.length > 60) return `Nama gerakan ke-${i + 1} maksimal 60 karakter`;
    const sets = Number.parseInt(row.sets, 10);
    if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
      return `Set gerakan ke-${i + 1} harus 1–20`;
    }
    const amount = Number.parseInt(row.amount, 10);
    if (!Number.isInteger(amount) || amount < 1 || amount > 9999) {
      return `Jumlah gerakan ke-${i + 1} harus 1–9999`;
    }
    items.push({ name, sets, amount, unit: row.unit });
  }
  return items;
}

export function ExerciseEditorDialog({
  zone,
  initial,
  customized,
  onClose,
}: {
  zone: GymZonePayload;
  /** Daftar efektif zona (kustom atau preset) — jadi titik awal editing. */
  initial: GymExerciseItem[];
  /** true bila zona sudah punya daftar kustom tersimpan. */
  customized: boolean;
  onClose: () => void;
}) {
  const save = useGymExerciseSave();
  const reset = useGymExerciseReset();
  const [rows, setRows] = useState<EditRow[]>(() => initial.map((it) => newRow(it)));
  const pending = save.isPending || reset.isPending;

  const update = (key: string, patch: Partial<EditRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const remove = (key: string) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
  };
  const add = () => {
    if (rows.length >= MAX_ROWS) {
      toast.info(`Maksimal ${MAX_ROWS} gerakan per zona`);
      return;
    }
    setRows((rs) => [...rs, newRow()]);
  };

  const handleSave = () => {
    const result = validateRows(rows);
    if (typeof result === 'string') {
      toast.error(result);
      return;
    }
    save.mutateAsync(
      { zone: zone.key, zoneLabel: zone.label, items: result },
      { onSuccess: () => onClose() },
    ).catch(() => {
      /* toast error sudah ditangani onError di hook */
    });
  };

  const handleReset = () => {
    reset
      .mutateAsync({ zone: zone.key, zoneLabel: zone.label }, { onSuccess: () => onClose() })
      .catch(() => {
        /* toast error sudah ditangani onError di hook */
      });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex max-h-[88dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-3 text-left text-base">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ background: `${zone.color}1f`, border: `1px solid ${zone.color}55` }}
              aria-hidden="true"
            >
              {zone.emoji}
            </span>
            <span className="flex flex-col">
              <span>Ubah Latihan — {zone.label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {rows.length} gerakan{customized ? ' · kustom' : ' · salinan default'}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            Ganti nama &amp; jumlah, tambah gerakan baru, atau hapus yang tidak dipakai — semuanya
            fleksibel.
          </DialogDescription>
        </DialogHeader>

        {/* Daftar baris editable — area scroll mandiri. */}
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 p-6 text-center">
              <Dumbbell className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Belum ada gerakan</p>
              <p className="text-xs text-muted-foreground">
                Tambahkan gerakan pertamamu untuk zona {zone.label}.
              </p>
            </div>
          )}

          {rows.map((row, i) => (
            <div
              key={row.key}
              className="rounded-xl border border-border/70 bg-card/60 p-3"
              role="group"
              aria-label={`Gerakan ke-${i + 1}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: `${zone.color}1f`, color: zone.color }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <Input
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  placeholder="Nama gerakan (mis. Push Up)"
                  maxLength={60}
                  aria-label={`Nama gerakan ke-${i + 1}`}
                  className="h-9 min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(row.key)}
                  aria-label={`Hapus gerakan ${row.name || `ke-${i + 1}`}`}
                  disabled={pending}
                  className="h-9 w-9 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.sets}
                  onChange={(e) => update(row.key, { sets: e.target.value })}
                  min={1}
                  max={20}
                  aria-label={`Jumlah set gerakan ke-${i + 1}`}
                  className="h-8 w-14 text-center"
                />
                <span className="shrink-0 text-xs text-muted-foreground" aria-hidden="true">
                  set ×
                </span>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.amount}
                  onChange={(e) => update(row.key, { amount: e.target.value })}
                  min={1}
                  max={9999}
                  aria-label={`Jumlah per set gerakan ke-${i + 1}`}
                  className="h-8 w-16 text-center"
                />
                <Select
                  value={row.unit}
                  onValueChange={(v) => update(row.key, { unit: v as GymExerciseUnit })}
                  disabled={pending}
                >
                  <SelectTrigger
                    aria-label={`Satuan gerakan ke-${i + 1}`}
                    className="h-8 min-w-0 flex-1 text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GYM_EXERCISE_UNITS.map((u) => (
                      <SelectItem key={u} value={u} className="text-xs">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={pending}
            className={cn('w-full cursor-pointer border-dashed', rows.length === 0 && 'mt-0')}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Tambah Gerakan
          </Button>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:items-center">
          {customized && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={pending}
              className="mr-auto cursor-pointer text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Kembalikan Default
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending} className="cursor-pointer">
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="cursor-pointer"
            aria-label={`Simpan daftar latihan zona ${zone.label}`}
          >
            {save.isPending ? 'Menyimpan…' : 'Simpan Latihan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
