// components/habit-tracker/finance-skeleton.tsx — skeleton bersama area finance.
// Meniru layout final tiap sub-tab (header + grid kartu / daftar baris) supaya
// perpindahan chunk dynamic() → konten tidak "loncat" (pola FIX-TIER2 / Fix 6).

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function FinanceHeaderSkeleton({ actionWidth = 'w-36' }: { actionWidth?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mt-4">
      <Skeleton className="h-7 w-40 rounded" />
      <Skeleton className={cn('h-9 rounded-md', actionWidth)} />
    </div>
  );
}

export function FinanceCardsSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}

export function FinanceRowsSkeleton({ count = 4, rowHeight = 'h-20' }: { count?: number; rowHeight?: string }) {
  return (
    <div className="space-y-2 mt-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-xl', rowHeight)} />
      ))}
    </div>
  );
}

export function FinanceKpiSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
