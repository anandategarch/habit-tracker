'use client';

// ---------------------------------------------------------------------------
// src/components/gym/photo-viewer-dialog.tsx — PENAMPIL FOTO PROGRES (Task 76
// Bonus #3). Dialog gambar PENUH (GET ?id= via useGymPhotoDetail — aktif
// hanya saat viewer terbuka): meta pose/tanggal/berat snapshot/catatan +
// hapus (AlertDialog konfirmasi). Skeleton saat memuat; error → pesan.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { photoDataUrl } from '@/lib/image-compress';
import { GYM_PHOTO_POSE_DEF_BY_KEY } from '@/lib/muscle-map';
import { formatDayKey } from './set-log-format';
import { useGymPhotoDelete, useGymPhotoDetail } from './use-gym-photos';

export function PhotoViewerDialog({ photoId, todayYmd, onClose }: { photoId: string; todayYmd: string; onClose: () => void }) {
  const detail = useGymPhotoDetail(photoId);
  const del = useGymPhotoDelete();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const photo = detail.data ?? null;
  const poseDef = photo ? GYM_PHOTO_POSE_DEF_BY_KEY[photo.pose] : null;
  const busy = del.isPending;

  const handleDelete = () => {
    setConfirmOpen(false);
    del
      .mutateAsync({ id: photoId })
      .then(() => onClose())
      .catch(() => {
        /* toast error sudah ditangani onError di hook */
      });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex w-full flex-col gap-0 overflow-visible p-0 sm:max-w-sm">
        <DialogHeader className="border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-baseline justify-between gap-2 text-left text-base">
            <span>Foto {poseDef?.label ?? 'Progres'}</span>
            {photo && (
              <span className="text-xs font-normal text-muted-foreground">
                {formatDayKey(photo.dayKey, todayYmd)}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-left text-xs">
            {photo
              ? photo.note
                ? photo.note
                : poseDef?.hint ?? 'foto progres tubuhmu'
              : 'memuat foto…'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          {detail.isLoading || !photo ? (
            <div
              className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-border/60 bg-muted/30"
              role="status"
              aria-label="Memuat foto"
            >
              {detail.isError ? (
                <p className="px-4 text-center text-xs text-destructive">
                  Gagal memuat foto. {detail.error instanceof Error ? detail.error.message : ''}
                </p>
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          ) : (
            <img
              src={photoDataUrl(photo.imageBase64)}
              alt={`Foto progres pose ${poseDef?.label ?? photo.pose} — ${photo.dayKey}`}
              className="aspect-[3/4] w-full rounded-xl border border-border/60 bg-muted/30 object-contain"
            />
          )}

          {/* Meta: berat snapshot (bukan berat kini) + tanggal penuh. */}
          {photo && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-muted-foreground">
                📅 {photo.dayKey}
              </span>
              {photo.weightKg !== null && (
                <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 font-medium text-primary">
                  ⚖️ {String(photo.weightKg).replace('.', ',')} kg (saat foto)
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/70 px-5 py-4 sm:flex-row sm:items-center">
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(true)}
              disabled={busy || !photo}
              className="mr-auto cursor-pointer text-muted-foreground hover:text-destructive"
            >
              Hapus Foto
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus foto ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Foto {poseDef?.label ?? 'progres'} {photo ? photo.dayKey : ''} akan dihapus permanen dari riwayat.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={busy} className="cursor-pointer">
                  Hapus
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy} className="cursor-pointer">
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
