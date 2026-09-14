'use client';

// components/habit-tracker/daily-tracker-skeleton.tsx — skeleton meniru layout
// tab Tracker (TASK 45 urutan baru: segment → pill tanggal → KPI+pohon → grid
// habit → check-in → catatan — “DO first”).

import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSkeleton() {
  return (
    <div
      className="space-y-5 max-w-6xl mx-auto"
      aria-busy="true"
      aria-label="Memuat tracker harian"
      role="status"
    >
      {/* Toggle Hari Ini / Riwayat */}
      <Skeleton className="h-9 w-44 rounded-full" />

      {/* Pill navigasi tanggal */}
      <Skeleton className="h-16 rounded-full" />

      {/* 4 KPI + pohon + progress bar */}
      <div className="premium-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-4 sm:gap-5">
          <Skeleton className="h-[72px] w-[72px] rounded-full shrink-0" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded-md" />
                  <Skeleton className="h-5 w-12 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-2 rounded-full" />
      </div>

      {/* Grid habit — kini SEBELUM refleksi (DO first) */}
      <div className="habit-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-24 sm:h-28 rounded-2xl"
            style={{ animationDelay: `${(i % 3) * 90}ms` }}
          />
        ))}
      </div>

      {/* Check-in harian (mood/energi/tidur) — refleksi di bawah */}
      <div className="premium-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3"
          >
            <Skeleton className="h-4 w-14 rounded-md" />
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-8 w-8 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Catatan harian */}
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}
