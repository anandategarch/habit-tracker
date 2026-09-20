'use client';

// ---------------------------------------------------------------------------
// src/components/gym/photo-capture-dialog.tsx — AMBIL FOTO PROGRES (Task 76
// Bonus #3). Dialog dari kartu foto: pilih pose (3 chip), pilih file (kamera/
// galeri — accept image/*), KOMPRESI DI KLIEN (canvas JPEG 720px + thumb
// 144px — src/lib/image-compress.ts), catatan opsional, hint snapshot berat
// otomatis (DailyLog terakhir — synergy F2), lalu simpan lewat useGymPhotoSave
// (invalidasi cache ['gym-photos'] ditangani hook).
// Kompresi async → state terpisah (mengompres/menyimpan) supaya tombol jelas.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
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
import { compressPhotoFile, photoDataUrl, type CompressedPhoto } from '@/lib/image-compress';
import {
  GYM_PHOTO_POSE_LIST,
  PHOTO_NOTE_MAX,
  type GymPhotoPose,
  type GymPhotosPayload,
} from '@/lib/muscle-map';
import { useGymPhotoSave } from './use-gym-photos';

export function PhotoCaptureDialog({
  payload,
  initialPose,
  onClose,
}: {
  /** Payload kartu — berat terakhir untuk hint snapshot. */
  payload: GymPhotosPayload;
  /** Pose pra-pilih (dari petak kosong); null = pilih manual. */
  initialPose: GymPhotoPose | null;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const save = useGymPhotoSave();

  const [pose, setPose] = useState<GymPhotoPose>(initialPose ?? 'depan');
  const [photo, setPhoto] = useState<CompressedPhoto | null>(null);
  const [note, setNote] = useState('');
  const [compressing, setCompressing] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setCompressing(true);
    try {
      const result = await compressPhotoFile(file);
      setPhoto(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memproses foto');
    } finally {
      setCompressing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (!photo) return;
    save
      .mutateAsync({
        pose,
        note: note.trim() || null,
        imageBase64: photo.imageBase64,
        thumbBase64: photo.thumbBase64,
      })
      .then(() => {
        toast.success('Foto progres tersimpan 📸');
        onClose();
      })
      .catch(() => {
        /* toast error sudah ditangani onError di hook */
      });
  };

  const busy = compressing || save.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex w-full flex-col gap-0 overflow-visible p-0 sm:max-w-sm">
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-3 text-left text-base">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg"
              aria-hidden="true"
            >
              📸
            </span>
            <span className="flex min-w-0 flex-col">
              <span>Ambil Foto Progres</span>
              <span className="text-xs font-normal text-muted-foreground">
                foto terkompres otomatis di perangkatmu
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            Pose sama + pencahayaan mirip = perbandingan paling jujur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          {/* Pose — 3 chip. */}
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Pose foto">
            {GYM_PHOTO_POSE_LIST.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPose(p.key)}
                disabled={busy}
                aria-pressed={pose === p.key}
                aria-label={`Pose ${p.label}`}
                className={cn(
                  'flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-colors',
                  pose === p.key
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/70 bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <span className="text-[11px] font-semibold leading-tight">{p.label}</span>
                <span className="text-[8px] leading-tight text-muted-foreground/80">{p.hint}</span>
              </button>
            ))}
          </div>

          {/* Pilih file / pratinjau. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
            aria-hidden="true"
            tabIndex={-1}
          />
          {photo ? (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-2.5">
              <img
                src={photoDataUrl(photo.imageBase64)}
                alt="Pratinjau foto progres"
                className="h-24 w-20 shrink-0 rounded-lg border border-border/60 object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Siap disimpan
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="h-8 w-fit cursor-pointer text-[11px]"
                >
                  Ganti Foto
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="h-20 w-full cursor-pointer flex-col gap-1 border-dashed"
              aria-label="Pilih atau ambil foto"
            >
              {compressing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">Mengompres…</span>
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">Pilih / Ambil Foto</span>
                </>
              )}
            </Button>
          )}

          {/* Catatan opsional. */}
          <div className="flex flex-col gap-1.5">
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, PHOTO_NOTE_MAX))}
              disabled={busy}
              placeholder="catatan opsional (mis. minggu ke-4 cutting)"
              aria-label="Catatan foto (opsional)"
              className="h-10 text-xs"
            />
            {note.length > 0 && (
              <p className="text-right text-[10px] text-muted-foreground">
                {note.length}/{PHOTO_NOTE_MAX}
              </p>
            )}
          </div>

          {/* Hint snapshot berat — synergy Fase 2. */}
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
            {payload.latestWeightKg !== null
              ? `Berat terakhirmu ${String(payload.latestWeightKg).replace('.', ',')} kg akan tercatat otomatis di foto ini.`
              : 'Belum ada berat tercatat — foto tetap tersimpan tanpa snapshot berat (catat berat di Beranda agar terhubung).'}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:items-center">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy} className="cursor-pointer">
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={busy || !photo}
            className="cursor-pointer"
            aria-label="Simpan foto progres"
          >
            {save.isPending ? 'Menyimpan…' : 'Simpan Foto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
