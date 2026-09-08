// ---------------------------------------------------------------------------
// GoalsSkeleton — loading placeholder for the Goals tab.
// Extracted from goals.tsx during PHASE-A-3.
//
// PREMIUM-UI ("Rutina Aurora"): skeleton shapes sekarang mencerminkan layout
// final — stat cards dengan slot chip-icon (rounded-xl) + premium-stat, dan
// goal cards dengan slot chip-icon status avatar di kiri.
// ---------------------------------------------------------------------------

'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function GoalsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      {/* Stats skeleton — chip-icon slot + label + angka premium-stat.
          Div polong premium-card (pola agent 2-a/2-b) meniru kartu stat final
          (rounded-2xl, slot chip 36px, label editorial, angka besar). */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="premium-card rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div>
              <Skeleton className="h-3 w-16 mb-1.5" />
              <Skeleton className="h-7 w-10" />
            </div>
          </div>
        ))}
      </div>
      {/* Goal card skeletons — avatar chip + title row + progress + footer chips */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="premium-card rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-full max-w-[85%]" />
              </div>
              <div className="flex gap-1 shrink-0">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-9" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
