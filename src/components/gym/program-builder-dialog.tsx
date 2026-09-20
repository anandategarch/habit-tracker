'use client';

// ---------------------------------------------------------------------------
// src/components/gym/program-builder-dialog.tsx — BUILDER PROGRAM (Task 75 F4).
//
// Buat program sendiri / ubah program tersimpan: nama + emoji + 7 baris hari
// (aktifkan hari, judul bebas, pilih 1–3 zona per hari). Validasi klien
// memakai validateProgramInput() — ATURAN YANG SAMA dengan server (dua sisi
// satu sumber; tombol Simpan aktif hanya bila valid).
//
// Simpan: POST (buat baru — otomatis aktif) atau PUT (ubah; bila program
// sedang aktif, jadwal baru langsung hidup tanpa reset minggu ke-N).
// Dipasang dengan key oleh GymScreen → state selalu segar saat dibuka.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  MUSCLE_ZONE_DEFS,
  PROGRAM_TITLE_MAX,
  PROGRAM_ZONES_PER_DAY_MAX,
  PROGRAM_NAME_MAX,
  dowLabelFull,
  programTitleFromZones,
  validateProgramInput,
  type GymProgramSaved,
  type MuscleZoneKey,
} from '@/lib/muscle-map';
import { useGymProgramCreate, useGymProgramUpdate } from './use-gym-program';

/** State satu hari di builder. */
interface DayDraft {
  dow: number;
  enabled: boolean;
  title: string;
  zones: MuscleZoneKey[];
}

/** Inisialisasi draft: 'new' → Senin+dada aktif; edit → prefill program. */
function initDays(program: GymProgramSaved | null): DayDraft[] {
  const byDow = new Map(program?.days.map((d) => [d.dow, d]) ?? []);
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const day = byDow.get(dow);
    return {
      dow,
      enabled: day !== undefined,
      title: day?.title ?? '',
      zones: day?.zones ?? [],
    };
  });
}

export function ProgramBuilderDialog({
  target,
  onClose,
}: {
  /** 'new' = buat baru; objek = ubah program itu. */
  target: 'new' | { program: GymProgramSaved };
  onClose: () => void;
}) {
  const isEdit = target !== 'new';
  const program = isEdit ? target.program : null;

  const create = useGymProgramCreate();
  const update = useGymProgramUpdate();
  const pending = create.isPending || update.isPending;

  const [name, setName] = useState(program?.name ?? '');
  const [emoji, setEmoji] = useState(program?.emoji ?? '📋');
  const [days, setDays] = useState<DayDraft[]>(() => initDays(program));

  const enabledDays = days.filter((d) => d.enabled);

  // Validasi live — aturan SAMA dengan server (dua sisi satu sumber).
  const validation = useMemo(
    () =>
      validateProgramInput({
        name,
        emoji,
        days: enabledDays.map((d) => ({
          dow: d.dow,
          title: d.title,
          zones: d.zones,
        })),
      }),
    [name, emoji, enabledDays],
  );

  const toggleDay = (dow: number, enabled: boolean) => {
    setDays((prev) => prev.map((d) => (d.dow === dow ? { ...d, enabled } : d)));
  };

  const setTitle = (dow: number, title: string) => {
    if (title.length > PROGRAM_TITLE_MAX) return;
    setDays((prev) => prev.map((d) => (d.dow === dow ? { ...d, title } : d)));
  };

  const toggleZone = (dow: number, zone: MuscleZoneKey) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.dow !== dow || !d.enabled) return d;
        if (d.zones.includes(zone)) {
          return { ...d, zones: d.zones.filter((z) => z !== zone) };
        }
        if (d.zones.length >= PROGRAM_ZONES_PER_DAY_MAX) return d; // batas 1–3
        return { ...d, zones: [...d.zones, zone] };
      }),
    );
  };

  const handleSave = async () => {
    if (!validation.ok) return;
    const vars = {
      name: validation.name,
      emoji: validation.emoji,
      days: validation.days,
    };
    try {
      if (isEdit) await update.mutateAsync({ ...vars, id: program!.id });
      else await create.mutateAsync(vars);
      onClose();
    } catch {
      /* toast error sudah ditangani onError di hook */
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex max-h-[88dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="text-left text-base">
            {isEdit ? 'Ubah Program' : 'Buat Program Sendiri'}
          </DialogTitle>
          <DialogDescription>
            Pilih hari latihan (1–7) + zona per hari (maks{' '}
            {PROGRAM_ZONES_PER_DAY_MAX}). Hari tanpa latihan = istirahat. Judul
            kosong dibuat otomatis dari zona.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Nama + emoji. */}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="program-name" className="text-xs">
                Nama program
              </Label>
              <Input
                id="program-name"
                value={name}
                maxLength={PROGRAM_NAME_MAX}
                placeholder="mis. Split Kuat Musim Ini"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-16 space-y-1.5">
              <Label htmlFor="program-emoji" className="text-xs">
                Emoji
              </Label>
              <Input
                id="program-emoji"
                value={emoji}
                maxLength={8}
                className="text-center text-lg"
                onChange={(e) => setEmoji(e.target.value)}
                aria-label="Emoji program"
              />
            </div>
          </div>

          {/* 7 hari. */}
          <div className="space-y-2">
            {days.map((d) => (
              <div
                key={d.dow}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  d.enabled ? 'border-border/70 bg-card/40' : 'border-border/50 bg-muted/20 opacity-70',
                )}
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={d.enabled}
                    onCheckedChange={(v) => toggleDay(d.dow, v)}
                    aria-label={`Aktifkan ${dowLabelFull(d.dow)} sebagai hari latihan`}
                  />
                  <span className="w-16 shrink-0 text-sm font-semibold">
                    {dowLabelFull(d.dow)}
                  </span>
                  {d.enabled && (
                    <Input
                      value={d.title}
                      maxLength={PROGRAM_TITLE_MAX}
                      placeholder={d.zones.length > 0 ? programTitleFromZones(d.zones) : 'judul (opsional)'}
                      onChange={(e) => setTitle(d.dow, e.target.value)}
                      className="h-9 min-w-0 flex-1 text-xs"
                      aria-label={`Judul latihan ${dowLabelFull(d.dow)}`}
                    />
                  )}
                </div>

                {d.enabled && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {MUSCLE_ZONE_DEFS.map((z) => {
                      const selected = d.zones.includes(z.key);
                      const full = d.zones.length >= PROGRAM_ZONES_PER_DAY_MAX;
                      return (
                        <button
                          key={z.key}
                          type="button"
                          onClick={() => toggleZone(d.dow, z.key)}
                          disabled={!selected && full}
                          aria-pressed={selected}
                          aria-label={`${selected ? 'Hapus' : 'Pilih'} zona ${z.label} untuk ${dowLabelFull(d.dow)}`}
                          className={cn(
                            'inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40',
                            selected
                              ? 'text-white'
                              : 'border-border/70 bg-card/40 text-foreground hover:border-primary/40 hover:bg-primary/5',
                          )}
                          style={selected ? { backgroundColor: z.color, borderColor: z.color } : undefined}
                        >
                          <span aria-hidden="true">{z.emoji}</span>
                          {z.label}
                        </button>
                      );
                    })}
                    {d.zones.length === 0 && (
                      <p className="w-full text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Pilih minimal 1 zona untuk hari ini.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t border-border/70 px-5 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <p
              className="min-w-0 flex-1 truncate text-xs font-medium text-rose-600 dark:text-rose-400"
              role="status"
            >
              {!validation.ok ? validation.error : ''}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={onClose} disabled={pending} className="cursor-pointer">
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={!validation.ok || pending}
                className="cursor-pointer"
              >
                {pending ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat & Aktifkan'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
