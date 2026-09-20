'use client';

// ---------------------------------------------------------------------------
// src/components/gym/progress-photo-card.tsx — KARTU FOTO PROGRES (Task 76
// Bonus #3). Kartu di tab Gym (setelah Kardio): 3 petak pose (thumbnail
// terakhir per pose — petak kosong = CTA ambil pose itu), strip riwayat
// horizontal (scroll-x), ringkasan perjalanan "X hari · N foto".
// Tap foto → viewer (gambar penuh); tap petak kosong → dialog ambil foto
// dengan pose terpilih. Foto murni lapisan catat — XP/streak tak tersentuh.
// ---------------------------------------------------------------------------

import { Camera, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/habit-tracker/scroll-reveal';
import { photoDataUrl } from '@/lib/image-compress';
import {
  GYM_PHOTO_POSE_LIST,
  type GymPhotoPose,
  type GymPhotosPayload,
} from '@/lib/muscle-map';
import { formatDayKey } from './set-log-format';

function PoseTile({
  pose,
  photo,
  todayYmd,
  onOpen,
  onAdd,
}: {
  pose: (typeof GYM_PHOTO_POSE_LIST)[number];
  photo: GymPhotosPayload['photos'][number] | null;
  todayYmd: string;
  onOpen: (id: string) => void;
  onAdd: (pose: GymPhotoPose) => void;
}) {
  if (photo) {
    return (
      <button
        type="button"
        onClick={() => onOpen(photo.id)}
        aria-label={`Lihat foto pose ${pose.label} terakhir`}
        className="group relative aspect-[3/4] w-1/3 min-w-0 cursor-pointer overflow-hidden rounded-xl border border-border/60"
      >
        <img
          src={photoDataUrl(photo.thumbBase64)}
          alt={`Foto pose ${pose.label} — ${photo.dayKey}`}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-left">
          <span className="block text-[10px] font-semibold text-white">{pose.label}</span>
          <span className="block text-[9px] text-white/80">{formatDayKey(photo.dayKey, todayYmd)}</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onAdd(pose.key)}
      aria-label={`Ambil foto pose ${pose.label}`}
      className="flex aspect-[3/4] w-1/3 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border/80 bg-muted/20 px-1 text-center hover:border-primary/50 hover:bg-primary/5"
    >
      <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-[10px] font-semibold text-muted-foreground">{pose.label}</span>
      <span className="text-[8px] leading-tight text-muted-foreground/70">belum ada</span>
    </button>
  );
}

export function ProgressPhotoCard({
  data,
  onAdd,
  onOpen,
}: {
  data: GymPhotosPayload;
  /** Buka dialog ambil foto — pose pra-pilih (atau null = biarkan pilih). */
  onAdd: (pose: GymPhotoPose | null) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ScrollReveal className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
          Foto Progres
        </h2>
        <p className="text-xs text-muted-foreground">
          {data.count > 0
            ? data.journeyDays !== null && data.journeyDays > 0
              ? `perjalanan ${data.journeyDays} hari · ${data.count} foto`
              : `${data.count} foto`
            : 'lihat perubahan tubuhmu'}
        </p>
      </div>

      {/* 3 petak pose — terakhir per pose (kosong = CTA). */}
      <div className="mt-3 flex gap-2" role="group" aria-label="Foto terakhir per pose">
        {GYM_PHOTO_POSE_LIST.map((pose) => (
          <PoseTile
            key={pose.key}
            pose={pose}
            photo={data.latestByPose[pose.key]}
            todayYmd={data.todayYmd}
            onOpen={onOpen}
            onAdd={onAdd}
          />
        ))}
      </div>

      {/* Strip riwayat horizontal (scroll-x, maks 2 baris tinggi). */}
      {data.photos.length > 3 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Terbaru</p>
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            role="list"
            aria-label="Riwayat foto terbaru"
          >
            {data.photos.slice(0, 12).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p.id)}
                role="listitem"
                aria-label={`Buka foto ${p.dayKey}`}
                className="group relative h-20 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/60"
              >
                <img
                  src={photoDataUrl(p.thumbBase64)}
                  alt={`Foto progres ${p.dayKey}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 py-0.5 text-[8px] font-medium text-white">
                  {p.dayKey.slice(5)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={() => onAdd(null)}
        className="mt-3 h-10 w-full cursor-pointer"
        aria-label="Ambil foto progres baru"
      >
        <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Ambil Foto
      </Button>
    </ScrollReveal>
  );
}
