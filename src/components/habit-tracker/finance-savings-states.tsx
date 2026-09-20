'use client';

// components/habit-tracker/finance-savings-states.tsx — sektor status
// sub-tab Tabungan: error, loading (skeleton), dan empty state (diekstrak
// verbatim dari finance-savings-goals.tsx, Task 71-i).

import { AlertTriangle, PiggyBank, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function SavingsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="premium-card rounded-2xl mt-4">
      <div className="premium-empty min-h-[16rem]">
        <div className="premium-empty-orb" aria-hidden="true">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold">Gagal memuat target tabungan</p>
        <p className="text-xs text-muted-foreground">Coba lagi dalam sejenak</p>
        <Button size="sm" variant="outline" className="h-8 text-xs mt-1" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" /> Coba lagi
        </Button>
      </div>
    </div>
  );
}

export function SavingsLoadingState() {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
      </div>
    </div>
  );
}

export function SavingsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="premium-card rounded-2xl">
      <div className="premium-empty min-h-[16rem]">
        <div className="premium-empty-orb" aria-hidden="true">
          <PiggyBank className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold">Belum ada target tabungan</p>
        <p className="text-xs text-muted-foreground">
          Simpan untuk liburan, gadget, atau dana darurat — pantau progresnya di sini.
        </p>
        <Button size="sm" className="h-8 text-xs mt-1 btn-primary-gradient" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" /> Buat Target Pertama
        </Button>
      </div>
    </div>
  );
}
