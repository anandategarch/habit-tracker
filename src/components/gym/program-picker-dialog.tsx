'use client';

// ---------------------------------------------------------------------------
// src/components/gym/program-picker-dialog.tsx — dialog PILIH PROGRAM
// (Task 75 F4).
//
// Dua seksi: "Template Siap Pakai" (PROGRAM_PRESETS murni kode — memakai
// template = POST salinan jadi baris GymProgram aktif) dan "Program
// Tersimpan" (baris GymProgram milik user: aktifkan ulang / ubah lewat
// builder / hapus dengan konfirmasi). Footer: gerbang "Buat Program
// Sendiri" → builder (via callback screen-state, picker ditutup).
// ---------------------------------------------------------------------------

import { CalendarCheck, Check, Pencil, Trash2 } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  PROGRAM_PRESETS,
  programScheduleSummary,
  type GymProgramSaved,
  type GymProgramPreset,
} from '@/lib/muscle-map';
import {
  useGymProgramActivate,
  useGymProgramCreate,
  useGymProgramDelete,
} from './use-gym-program';

/** Ringkasan singkat hari-hari program (judul dipisah titik). */
function daysSummary(days: GymProgramSaved['days']): string {
  if (days.length === 0) return '—';
  return days.map((d) => d.title).join(' · ');
}

export function ProgramPickerDialog({
  open,
  onOpenChange,
  saved,
  onBuildNew,
  onEditSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Program tersimpan milik user (payload GET /api/gym/program). */
  saved: GymProgramSaved[];
  onBuildNew: () => void;
  onEditSaved: (program: GymProgramSaved) => void;
}) {
  const create = useGymProgramCreate();
  const activate = useGymProgramActivate();
  const remove = useGymProgramDelete();

  const applyTemplate = (preset: GymProgramPreset) => {
    create.mutate(
      { name: preset.name, emoji: preset.emoji, days: preset.days },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Pilih Program Latihan
          </DialogTitle>
          <DialogDescription>
            Template siap pakai atau program buatanmu — progres terbaca otomatis dari
            Peta Otot (XP & streak tetap mengalir lewat zona seperti biasa).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {/* ── Template siap pakai ── */}
          <section aria-label="Template siap pakai">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Template Siap Pakai
            </h3>
            <ul className="mt-2 space-y-2">
              {PROGRAM_PRESETS.map((preset) => (
                <li
                  key={preset.id}
                  className="rounded-xl border border-border/60 bg-card/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-lg"
                      aria-hidden="true"
                    >
                      {preset.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{preset.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{preset.desc}</p>
                      <p className="mt-1 truncate text-[11px] font-medium text-primary">
                        {programScheduleSummary(preset.days)} — {daysSummary(preset.days)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => applyTemplate(preset)}
                      disabled={create.isPending}
                      className="shrink-0 cursor-pointer"
                    >
                      Pakai
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Program tersimpan milik user ── */}
          {saved.length > 0 && (
            <section aria-label="Program tersimpan">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Program Tersimpan
              </h3>
              <ul className="mt-2 space-y-2">
                {saved.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      'rounded-xl border p-3',
                      p.isActive
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/60 bg-card/40',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-lg"
                        aria-hidden="true"
                      >
                        {p.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-semibold">
                          {p.name}
                          {p.isActive && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check className="h-2.5 w-2.5" aria-hidden="true" />
                              AKTIF
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {programScheduleSummary(p.days)} — {daysSummary(p.days)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!p.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              activate.mutate(
                                { id: p.id, name: p.name },
                                { onSuccess: () => onOpenChange(false) },
                              )
                            }
                            disabled={activate.isPending}
                            className="cursor-pointer"
                          >
                            Aktifkan
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Ubah program ${p.name}`}
                          onClick={() => {
                            onOpenChange(false);
                            onEditSaved(p);
                          }}
                          className="h-9 w-9 shrink-0 cursor-pointer text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Hapus program ${p.name}`}
                              disabled={remove.isPending}
                              className="h-9 w-9 shrink-0 cursor-pointer text-muted-foreground hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus "{p.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Jadwal & program ini dihapus permanen
                                {p.isActive
                                  ? ' — program aktifmu juga berakhir (latihan zona tetap aman).'
                                  : '.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="cursor-pointer">Batal</AlertDialogCancel>
                              <Button
                                variant="destructive"
                                onClick={() =>
                                  remove.mutate(
                                    { id: p.id, name: p.name },
                                    { onSuccess: () => onOpenChange(false) },
                                  )
                                }
                                disabled={remove.isPending}
                                className="cursor-pointer"
                              >
                                Hapus
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false);
            onBuildNew();
          }}
          className="w-full cursor-pointer"
        >
          ✨ Buat Program Sendiri
        </Button>
      </DialogContent>
    </Dialog>
  );
}
