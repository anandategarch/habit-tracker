// ---------------------------------------------------------------------------
// LoadingSkeleton — daily tracker loading placeholder.
// Extracted from daily-tracker.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

export function LoadingSkeleton() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 skel-hybrid skel-stagger skel-card" style={{ animationDelay: '0ms' }} />
          <div className="space-y-1.5">
            <div className="h-5 w-24 skel-hybrid skel-stagger" style={{ animationDelay: '30ms' }} />
            <div className="h-3 w-32 skel-hybrid skel-stagger" style={{ animationDelay: '60ms' }} />
          </div>
          <div className="h-9 w-9 skel-hybrid skel-stagger skel-card" style={{ animationDelay: '90ms' }} />
        </div>
      </div>

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skel-card skel-hybrid skel-stagger p-4"
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            <div className="h-3 w-16 skel-hybrid skel-stagger mb-2" style={{ animationDelay: `${150 + i * 60}ms` }} />
            <div className="h-7 w-20 skel-hybrid skel-stagger mb-1" style={{ animationDelay: `${180 + i * 60}ms` }} />
            <div className="h-2 w-full skel-hybrid skel-stagger" style={{ animationDelay: `${210 + i * 60}ms` }} />
          </div>
        ))}
      </div>

      {/* Notes card skeleton */}
      <div className="daily-notes-card">
        <div className="h-4 w-24 skel-hybrid skel-stagger mb-3" style={{ animationDelay: '400ms' }} />
        <div className="h-16 w-full skel-hybrid skel-stagger" style={{ animationDelay: '430ms' }} />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-20 skel-hybrid skel-stagger" style={{ animationDelay: '500ms' }} />
        <div className="h-8 w-28 skel-hybrid skel-stagger skel-card" style={{ animationDelay: '530ms' }} />
      </div>

      {/* Habit cards skeleton (content-aware) */}
      <div className="habit-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skel-card skel-hybrid skel-stagger p-5"
            style={{ animationDelay: `${600 + i * 60}ms` }}
          >
            <div className="h-12 w-12 skel-hybrid skel-stagger skel-card mb-3" style={{ animationDelay: `${630 + i * 60}ms` }} />
            <div className="h-4 w-28 skel-hybrid skel-stagger mb-2" style={{ animationDelay: `${660 + i * 60}ms` }} />
            <div className="h-3 w-20 skel-hybrid skel-stagger mb-4" style={{ animationDelay: `${690 + i * 60}ms` }} />
            <div className="flex items-center justify-between">
              <div className="h-12 w-12 skel-hybrid skel-stagger skel-circle" style={{ animationDelay: `${720 + i * 60}ms` }} />
              <div className="space-y-1.5">
                <div className="h-3 w-14 skel-hybrid skel-stagger ml-auto" style={{ animationDelay: `${750 + i * 60}ms` }} />
                <div className="h-3 w-10 skel-hybrid skel-stagger ml-auto" style={{ animationDelay: `${780 + i * 60}ms` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
