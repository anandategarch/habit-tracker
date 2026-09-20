'use client';

// ---------------------------------------------------------------------------
// src/components/gym/use-gym-photos.ts — query & mutasi FOTO PROGRES
// (Task 76 Bonus).
//
// * useGymPhotos()     : GET /api/gym/photos — daftar thumbnail + pose
//                        terakhir + ringkasan perjalanan. Payload bisa ~ratusan
//                        KB (36 thumb) → staleTime lebih panjang (2 mnt).
// * useGymPhotoDetail(): GET ?id=… — SATU foto gambar penuh. Aktif hanya saat
//                        viewer terbuka (enabled = id != null, pola
//                        useGymZoneSets Task 74).
// * useGymPhotoSave()  : POST — simpan foto terkompresi (dialog Ambil Foto).
//                        Tanpa optimistic: latestByPose/journeyDays disusun
//                        server; invalidasi + refetch (payload kecil).
// * useGymPhotoDelete(): DELETE ?id= — hapus foto. Optimistic: buang baris +
//                        bersihkan cache detail foto itu.
// ---------------------------------------------------------------------------

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type GymPhotoDetail,
  type GymPhotoPose,
  type GymPhotoRow,
  type GymPhotosPayload,
} from '@/lib/muscle-map';

const KEY = ['gym-photos'] as const;

/** Query daftar foto progres (tab Gym). */
export function useGymPhotos() {
  return useQuery<GymPhotosPayload>({
    queryKey: KEY,
    staleTime: 120_000,
    queryFn: async () => {
      const res = await fetch('/api/gym/photos');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal memuat foto progres');
      }
      return json as GymPhotosPayload;
    },
  });
}

/** Query detail satu foto — aktif hanya saat viewer terbuka. */
export function useGymPhotoDetail(id: string | null) {
  return useQuery<GymPhotoDetail>({
    queryKey: ['gym-photo', id],
    enabled: id !== null,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/gym/photos?id=${encodeURIComponent(id as string)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal memuat foto');
      }
      return (json as { photo: GymPhotoDetail }).photo;
    },
  });
}

export interface GymPhotoSaveVars {
  pose: GymPhotoPose;
  note: string | null;
  imageBase64: string;
  thumbBase64: string;
  weightKg?: number | null;
}

export function useGymPhotoSave() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: GymPhotoSaveVars): Promise<{ photo: GymPhotoRow }> => {
      const res = await fetch('/api/gym/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menyimpan foto');
      }
      return json as { photo: GymPhotoRow };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGymPhotoDelete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      const res = await fetch(`/api/gym/photos?id=${encodeURIComponent(vars.id)}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menghapus foto');
      }
      return json as { ok: boolean };
    },
    onSuccess: (_data, vars) => {
      const prev = qc.getQueryData<GymPhotosPayload>(KEY);
      if (prev) {
        qc.setQueryData<GymPhotosPayload>(KEY, {
          ...prev,
          photos: prev.photos.filter((p) => p.id !== vars.id),
          count: Math.max(0, prev.count - 1),
        });
      }
      qc.removeQueries({ queryKey: ['gym-photo', vars.id] });
      qc.invalidateQueries({ queryKey: KEY });
      toast.info('Foto dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
