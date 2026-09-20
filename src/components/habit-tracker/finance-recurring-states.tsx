'use client';

// components/habit-tracker/finance-recurring-states.tsx — sektor status
// sub-tab Recurring: error, loading (skeleton), dan empty state (diekstrak
// verbatim dari finance-recurring.tsx, Task 71-i).

import { AlertTriangle, Plus, RefreshCw, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function RecurringErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="premium-card rounded-2xl mt-4">
      <div className="premium-empty min-h-[16rem]">
        <div className="premium-empty-orb" aria-hidden="true">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold">Gagal memuat transaksi berulang</p>
        <p className="text-xs text-muted-foreground">Coba lagi dalam sejenak</p>
        <Button size="sm" variant="outline" className="h-8 text-xs mt-1" onClick={onRetry}>
          <RefreshCw className="h-3 w-3" /> Coba lagi
        </Button>
      </div>
    </div>
  );
}

export function RecurringLoadingState() {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40 rounded" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
    </div>
  );
}

export function RecurringEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="premium-card rounded-2xl">
      <div className="premium-empty min-h-[16rem]">
        <div className="premium-empty-orb" aria-hidden="true">
          <Repeat className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold">Belum ada transaksi berulang</p>
        <p className="text-xs text-muted-foreground">
          Otomatiskan pencatatan rutin seperti gaji, sewa, atau langganan.
        </p>
        <Button size="sm" className="h-8 text-xs mt-1 btn-primary-gradient" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" /> Buat Berulang Pertama
        </Button>
      </div>
    </div>
  );
}
