'use client';

import { useQuery } from '@tanstack/react-query';
import { Brain, Sparkles, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface Insight {
  type: string;
  icon: string;
  title: string;
  description: string;
  severity: 'positive' | 'negative' | 'neutral';
}

interface AIInsightsData {
  insights: Insight[];
}

const SEVERITY_CONFIG = {
  positive: {
    label: 'Positif',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    borderClass: 'border-l-primary',
    iconBg: 'bg-primary/10',
  },
  negative: {
    label: 'Perlu Perhatian',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    borderClass: 'border-l-destructive',
    iconBg: 'bg-destructive/10',
  },
  neutral: {
    label: 'Info',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    borderClass: 'border-l-muted-foreground',
    iconBg: 'bg-muted',
  },
} as const;

function InsightCard({ insight }: { insight: Insight }) {
  const config = SEVERITY_CONFIG[insight.severity];
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border border-border border-l-4', config.borderClass, 'bg-card hover:shadow-sm transition-shadow')}>
      <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg text-lg shrink-0', config.iconBg)}>
        {insight.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight">{insight.title}</h4>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', config.badgeClass)}>
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
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
        <Icon className={cn('h-3.5 w-3.5', colors[severity])} />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
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
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
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

  if (isError || !data?.insights || data.insights.length === 0) {
    return null; // Silently hide if no insights or error
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-4 bg-gradient-to-br from-primary/5 to-transparent">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold">Review Mingguan</h3>
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground">Analisis pola otomatis</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
          {data.insights.length} insight
        </Badge>
      </div>

      <Separator />

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
