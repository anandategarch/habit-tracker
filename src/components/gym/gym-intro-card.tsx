'use client';

// ---------------------------------------------------------------------------
// src/components/gym/gym-intro-card.tsx — banner setup/aktivasi Peta Otot
// (Task 64). Idempoten — gym-screen hanya merender bila setupDone=false
// (habit zona belum ada). Tombol Aktifkan → POST /api/gym (useGymSetup).
// ---------------------------------------------------------------------------

import { Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GymIntroCard({
  onSetup,
  isPending,
}: {
  onSetup: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Bangun Peta Otot-mu</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Buat 7 habit latihan (6 zona + Full Body) — XP & streak ikut pohon musim mingguan.
        </p>
      </div>
      <Button onClick={onSetup} disabled={isPending} className="cursor-pointer">
        <Dumbbell className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {isPending ? 'Menyiapkan…' : 'Aktifkan'}
      </Button>
    </div>
  );
}
