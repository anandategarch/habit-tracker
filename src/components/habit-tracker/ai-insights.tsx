'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Lightbulb,
} from 'lucide-react';

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
    label: 'Positive',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    borderClass: 'border-l-primary',
    iconBg: 'bg-primary/10',
  },
  negative: {
    label: 'Needs Attention',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-800',
    borderClass: 'border-l-red-500',
    iconBg: 'bg-red-100 dark:bg-red-950/50',
  },
  neutral: {
    label: 'Info',
    badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    borderClass: 'border-l-gray-400 dark:border-l-gray-500',
    iconBg: 'bg-gray-100 dark:bg-gray-800',
  },
} as const;

function InsightCard({ insight }: { insight: Insight }) {
  const config = SEVERITY_CONFIG[insight.severity];

  return (
    <Card className={cn('border-l-4', config.borderClass, 'hover:shadow-md transition-shadow duration-200')}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg text-xl shrink-0', config.iconBg)}>
            {insight.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground leading-tight">{insight.title}</h4>
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', config.badgeClass)}>
                {config.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
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

  const config = SEVERITY_CONFIG[severity];
  const colors: Record<string, string> = {
    positive: 'text-primary',
    negative: 'text-red-500',
    neutral: 'text-gray-500 dark:text-gray-400',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', colors[severity])} />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
          {insights.length}
        </Badge>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <InsightCard key={`${insight.type}-${i}`} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Separator />
      {/* Insight cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-4 border-l-gray-300 dark:border-l-gray-600">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
        <span className="text-3xl">🚀</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">Start tracking habits</h3>
      <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
        Start tracking habits to receive personalized AI insights about your patterns and progress.
      </p>
    </div>
  );
}

export default function AIInsights() {
  const refreshKey = useAppStore(s => s.refreshKey);
  const { data: data, isError: fetchError } = useQuery<AIInsightsData>({
    queryKey: ['ai-insights', refreshKey],
    queryFn: async () => {
      const r = await fetch('/api/ai-insights');
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    staleTime: 5 * 60_000,
  });
  const loading = data === undefined && !fetchError;

  const groupedInsights = useMemo(() => {
    if (!data?.insights) return { positive: [], neutral: [], negative: [] };
    return {
      positive: data.insights.filter((i) => i.severity === 'positive'),
      neutral: data.insights.filter((i) => i.severity === 'neutral'),
      negative: data.insights.filter((i) => i.severity === 'negative'),
    };
  }, [data]);

  if (loading) return <LoadingSkeleton />;

  if (!data?.insights || data.insights.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">AI Insights</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Automated pattern analysis</p>
          </div>
        </div>
        <Separator />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">AI Insights</h2>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Automated pattern analysis</p>
        </div>
      </div>

      <Separator />

      {/* Positive insights */}
      <SeveritySection
        severity="positive"
        insights={groupedInsights.positive}
        icon={TrendingUp}
        title="Positive Patterns"
      />

      {groupedInsights.positive.length > 0 && (groupedInsights.neutral.length > 0 || groupedInsights.negative.length > 0) && (
        <Separator />
      )}

      {/* Neutral insights */}
      <SeveritySection
        severity="neutral"
        insights={groupedInsights.neutral}
        icon={Lightbulb}
        title="Observations"
      />

      {groupedInsights.neutral.length > 0 && groupedInsights.negative.length > 0 && (
        <Separator />
      )}

      {/* Negative insights */}
      <SeveritySection
        severity="negative"
        insights={groupedInsights.negative}
        icon={AlertTriangle}
        title="Needs Attention"
      />
    </div>
  );
}