'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Brain, Sparkles, TrendingUp, Lightbulb, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useAppStore } from '@/store/app-store';

interface Insight {
  type: string;
  icon: string;
  title: string;
  description: string;
  severity: 'positive' | 'negative' | 'neutral';
  // ONE-CLICK (4-a): optional habit deep-link — when present (habit-specific
  // insights like best/worst habit), the card renders a "Lihat habit" link
  // that calls openHabitFocus(habitId).
  habitId?: string;
}

interface AIInsightsData {
  insights: Insight[];
}

// PREMIUM UI v2 ("Rutina Aurora"): soft tinted tokens instead of full
// borders — the old border-l-4 accent survives as a 3px gradient bar child
// (teal→emerald / rose) so the severity hierarchy is kept without the harsh
// solid border.
const SEVERITY_CONFIG = {
  positive: {
    label: 'Positif',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    chipSoftClass: 'chip-soft-teal',
    accentClass: 'bg-gradient-to-b from-teal-400 to-emerald-500',
  },
  negative: {
    label: 'Perlu Perhatian',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
    chipSoftClass: 'chip-soft-rose',
    accentClass: 'bg-gradient-to-b from-rose-400 to-rose-600',
  },
  neutral: {
    label: 'Info',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    chipSoftClass: 'chip-soft-violet',
    accentClass: 'bg-muted-foreground/40',
  },
} as const;

function InsightCard({ insight }: { insight: Insight }) {
  const config = SEVERITY_CONFIG[insight.severity];
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);
  const habitId = insight.habitId;
  return (
    <div className="premium-card premium-card-sheen relative overflow-hidden rounded-xl p-3.5">
      {/* Aurora accent — 3px gradient bar replacing the old border-l-4. */}
      <span
        aria-hidden="true"
        className={cn('pointer-events-none absolute bottom-3 left-0 top-3 w-[3px] rounded-full', config.accentClass)}
      />
      <div className="flex items-start gap-3 pl-2.5">
        <span
          className={cn('chip-soft grid h-9 w-9 place-items-center text-lg', config.chipSoftClass)}
          aria-hidden="true"
        >
          {insight.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold leading-tight">{insight.title}</h4>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', config.badgeClass)}>
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
          {habitId && (
            <button
              type="button"
              onClick={() => openHabitFocus(habitId)}
              aria-label={`Lihat detail habit terkait insight ${insight.title}`}
              className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              Lihat habit
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SeveritySection({
  severity,
  insights,
  icon: Icon,
  title,
}: {
  severity: 'positive' | 'negative' | 'neutral';
  insights: Insight[];
  icon: React.ElementType;
  title: string;
}) {
  if (insights.length === 0) return null;
  const colors: Record<string, string> = {
    positive: 'text-primary',
    negative: 'text-destructive',
    neutral: 'text-muted-foreground',
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', colors[severity])} aria-hidden="true" />
        <h3 className="premium-label">{title}</h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{insights.length}</Badge>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <InsightCard key={`${insight.type}-${i}`} insight={insight} />
        ))}
      </div>
    </div>
  );
}

export function WeeklyReview() {
  const { data, isLoading, isError } = useQuery<AIInsightsData>({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const r = await fetch('/api/ai-insights');
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const groupedInsights = useMemo(() => {
    if (!data?.insights) return { positive: [], neutral: [], negative: [] };
    return {
      positive: data.insights.filter((i) => i.severity === 'positive'),
      neutral: data.insights.filter((i) => i.severity === 'neutral'),
      negative: data.insights.filter((i) => i.severity === 'negative'),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // PREMIUM UI v2: previously returned null (empty hole in the dashboard
  // layout) — now renders a premium-empty state so the section keeps its
  // slot and the user gets guidance instead of nothing.
  if (isError || !data?.insights || data.insights.length === 0) {
    return (
      <div className="premium-card premium-card-sheen rounded-2xl">
        <div className="premium-empty">
          <div className="premium-empty-orb">
            <Brain className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">Belum ada insight mingguan</p>
          <p className="max-w-sm text-center text-xs text-muted-foreground">
            Insight otomatis muncul setelah beberapa hari habit tercatat. Centang habit
            di tracker untuk mulai mengumpulkan pola.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card premium-card-sheen rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="chip-soft chip-soft-teal h-8 w-8" aria-hidden="true">
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="premium-label">Review Mingguan</h3>
              <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
            </div>
            <p className="text-[10px] text-muted-foreground">Analisis pola otomatis</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
          {data.insights.length} insight
        </Badge>
      </div>

      <div className="premium-divider" />

      {/* Insights grouped by severity */}
      <div className="space-y-4">
        <SeveritySection
          severity="positive"
          insights={groupedInsights.positive}
          icon={TrendingUp}
          title="Pola Positif"
        />
        <SeveritySection
          severity="neutral"
          insights={groupedInsights.neutral}
          icon={Lightbulb}
          title="Observasi"
        />
        <SeveritySection
          severity="negative"
          insights={groupedInsights.negative}
          icon={AlertTriangle}
          title="Perlu Perhatian"
        />
      </div>
    </div>
  );
}
