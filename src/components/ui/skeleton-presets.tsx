import { cn } from '@/lib/utils';

/**
 * Hybrid Skeleton System (Opsi 5)
 *
 * Content-aware skeleton shapes + shimmer sweep + stagger entrance.
 * Matches actual component layouts for zero CLS (layout shift).
 *
 * Usage:
 *   <HabitCardSkeleton />
 *   <HabitCardSkeleton count={4} />  // renders 4 with 60ms stagger
 *
 *   <StatsCardSkeleton />
 *   <FinanceOverviewSkeleton />
 *   <DashboardSkeleton />
 *   <TransactionListSkeleton count={3} />
 */

// ── Base skeleton block ──────────────────────────────────────────────
function Skel({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('skel-hybrid skel-stagger', className)}
      style={style}
      aria-hidden="true"
    />
  );
}

// ── Habit Card Skeleton ──────────────────────────────────────────────
// Matches: FlipCard front layout (icon, name, category, progress ring, streak)
export function HabitCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="skel-card skel-hybrid skel-stagger p-4 border border-border/50"
      style={{ animationDelay: `${index * 60}ms` }}
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        {/* Icon circle */}
        <Skel className="h-10 w-10 skel-circle shrink-0" style={{ animationDelay: `${index * 60}ms` }} />
        <div className="flex-1 min-w-0 space-y-2">
          {/* Habit name */}
          <Skel className="h-4 w-2/3" style={{ animationDelay: `${index * 60 + 30}ms` }} />
          {/* Category + time */}
          <Skel className="h-3 w-1/2" style={{ animationDelay: `${index * 60 + 60}ms` }} />
        </div>
        {/* Progress ring placeholder */}
        <Skel className="h-8 w-8 skel-circle shrink-0" style={{ animationDelay: `${index * 60 + 90}ms` }} />
      </div>
      {/* Streak footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
        <Skel className="h-3 w-16" style={{ animationDelay: `${index * 60 + 120}ms` }} />
        <Skel className="h-3 w-12" style={{ animationDelay: `${index * 60 + 150}ms` }} />
      </div>
    </div>
  );
}

export function HabitListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <HabitCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

// ── Stats / KPI Card Skeleton ────────────────────────────────────────
// Matches: KPI card (icon, value, label)
export function StatsCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="skel-card skel-hybrid skel-stagger p-4"
      style={{ animationDelay: `${index * 60}ms` }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Skel className="h-3 w-3 skel-circle" style={{ animationDelay: `${index * 60}ms` }} />
        <Skel className="h-3 w-20" style={{ animationDelay: `${index * 60 + 30}ms` }} />
      </div>
      <Skel className="h-7 w-16 mb-1" style={{ animationDelay: `${index * 60 + 60}ms` }} />
      <Skel className="h-3 w-24" style={{ animationDelay: `${index * 60 + 90}ms` }} />
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

// ── Finance Overview Skeleton ────────────────────────────────────────
// Matches: finance-overview (balance card, income/expense, sources)
export function FinanceOverviewSkeleton() {
  return (
    <div className="space-y-3">
      {/* Total balance card */}
      <div className="skel-card skel-hybrid skel-stagger p-5" aria-hidden="true">
        <Skel className="h-3 w-24 mb-2" />
        <Skel className="h-8 w-40 mb-3" style={{ animationDelay: '30ms' }} />
        <div className="flex gap-4">
          <div className="flex-1">
            <Skel className="h-3 w-16 mb-1" style={{ animationDelay: '60ms' }} />
            <Skel className="h-5 w-24" style={{ animationDelay: '90ms' }} />
          </div>
          <div className="flex-1">
            <Skel className="h-3 w-16 mb-1" style={{ animationDelay: '120ms' }} />
            <Skel className="h-5 w-24" style={{ animationDelay: '150ms' }} />
          </div>
        </div>
      </div>
      {/* Sources grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="skel-card skel-hybrid skel-stagger p-3"
            style={{ animationDelay: `${200 + i * 60}ms` }}
            aria-hidden="true"
          >
            <div className="flex items-center gap-2 mb-2">
              <Skel className="h-6 w-6 skel-circle" />
              <Skel className="h-3 flex-1" />
            </div>
            <Skel className="h-5 w-20" style={{ animationDelay: `${230 + i * 60}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Transaction List Skeleton ────────────────────────────────────────
// Matches: transaction item (icon, category, amount, date)
export function TransactionItemSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ animationDelay: `${index * 60}ms` }}
      aria-hidden="true"
    >
      <Skel className="h-9 w-9 skel-circle shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skel className="h-3.5 w-2/3" style={{ animationDelay: `${index * 60 + 30}ms` }} />
        <Skel className="h-3 w-1/3" style={{ animationDelay: `${index * 60 + 60}ms` }} />
      </div>
      <Skel className="h-4 w-20" style={{ animationDelay: `${index * 60 + 90}ms` }} />
    </div>
  );
}

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-border/30">
      {Array.from({ length: count }).map((_, i) => (
        <TransactionItemSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

// ── Dashboard Skeleton ───────────────────────────────────────────────
// Matches: dashboard layout (header, quote, KPI grid, chart, leaderboard)
export function DashboardSkeleton() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Quote card */}
      <div className="skel-card skel-hybrid skel-stagger p-5" aria-hidden="true">
        <div className="flex items-start gap-3">
          <Skel className="h-8 w-8 skel-circle shrink-0" />
          <div className="flex-1 space-y-2">
            <Skel className="h-4 w-full" style={{ animationDelay: '30ms' }} />
            <Skel className="h-4 w-3/4" style={{ animationDelay: '60ms' }} />
          </div>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Skel className="h-4 w-14" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skel
            key={i}
            className="h-7 w-16 skel-circle"
            style={{ animationDelay: `${100 + i * 40}ms` }}
          />
        ))}
      </div>

      {/* KPI grid */}
      <StatsGridSkeleton count={4} />

      {/* Chart placeholder */}
      <div
        className="skel-card skel-hybrid skel-stagger h-48"
        style={{ animationDelay: '400ms' }}
        aria-hidden="true"
      />

      {/* Leaderboard */}
      <div className="space-y-2">
        <Skel className="h-5 w-32" style={{ animationDelay: '500ms' }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 skel-card skel-hybrid skel-stagger"
            style={{ animationDelay: `${560 + i * 60}ms` }}
            aria-hidden="true"
          >
            <Skel className="h-6 w-6 skel-circle" />
            <Skel className="h-4 flex-1" />
            <Skel className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic Page Skeleton (fallback) ─────────────────────────────────
export function PageSkeleton() {
  return (
    <div className="space-y-4 max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skel className="h-7 w-40" />
        <Skel className="h-9 w-24 skel-card" style={{ animationDelay: '30ms' }} />
      </div>
      {/* Content blocks */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="skel-card skel-hybrid skel-stagger h-32"
          style={{ animationDelay: `${60 + i * 60}ms` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
