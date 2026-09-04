'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';

interface ArticleData {
  title: string;
  content: string;
  funFact: string;
  topic: string;
  source: string;
  date: string;
}

/**
 * BUG-FINANCE-CAL BUG-2: pick today's topic deterministically from the 6
 * default topics, rotating by day-of-year. The /api/learning/article route
 * short-circuits to DEFAULT_FALLBACK when called WITHOUT a `?topic=` param,
 * so the widget previously ALWAYS showed the same "Pentingnya Literasi
 * Keuangan di Era Digital" article — every day, forever. With this rotation,
 * the API actually fetches fresh web content per topic (Akuntansi, Keuangan,
 * Ekonomi, Pajak, Investasi, Manajemen) and the widget shows a different
 * article each day. The topic is derived from the Jakarta date so it stays
 * stable across a single day (no flicker when crossing midnight in non-WIB
 * timezones) and only changes once per Jakarta day.
 *
 * Order matches the order in src/lib/learning/topic-queries.ts so the
 * rotation feels intentional (finance-related topics first since this is a
 * habit+finance tracker). Kept here (not in topic-queries.ts) to avoid
 * pulling the whole topic-queries module into the client bundle — these 6
 * names are static and unlikely to change.
 */
const DAILY_TOPICS = [
  'Keuangan',
  'Investasi',
  'Akuntansi',
  'Ekonomi',
  'Pajak',
  'Manajemen',
] as const;

function todaysTopic(): string {
  // jakartaDateString() returns yyyy-MM-dd. Hash the date string to a stable
  // index — avoids any timezone-fiddly Date arithmetic.
  const dateStr = jakartaDateString();
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DAILY_TOPICS.length;
  return DAILY_TOPICS[idx];
}

/**
 * ArticleWidget — small "Article of the Day" card for Dashboard.
 * Fetches from /api/learning/article (recovered from Learning feature removal).
 * Displays title + summary + fun fact in a compact card.
 */
export function ArticleWidget() {
  // topic is computed once per mount (and recomputed if the user keeps the
  // app open past Jakarta midnight — rare but cheap to handle). The queryKey
  // includes topic so a topic change re-fetches.
  const topic = todaysTopic();
  const { data, isLoading, refetch, isFetching, isError } = useQuery<ArticleData>({
    queryKey: ['learning-article', topic],
    queryFn: async () => {
      const res = await fetch(`/api/learning/article?topic=${encodeURIComponent(topic)}`);
      if (!res.ok) throw new Error('Failed to fetch article');
      return res.json();
    },
    staleTime: Infinity, // Article is daily — no need to refetch within a day
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Artikel Hari Ini</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-3 w-full bg-muted rounded animate-pulse" />
          <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // BUG-FINANCE-CAL BUG-3: previously this was `if (!data) return null;`
  // which silently hid the widget on fetch failure — the user got no retry
  // affordance. Now we render a compact error state with a retry button.
  // Still returns null if data exists but is genuinely empty (shouldn't
  // happen — API always returns either real content or a fallback).
  if (isError || !data) {
    return (
      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Artikel Hari Ini</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Muat ulang artikel"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Gagal memuat artikel. Ketuk refresh untuk mencoba lagi.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Artikel Hari Ini</span>
          {data.topic && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {data.topic}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Muat ulang artikel"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground leading-snug">{data.title}</h3>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{data.content}</p>
      </div>

      {data.funFact && (
        <div className="flex items-start gap-1.5 pt-2 border-t border-border/50">
          <Sparkles className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Fakta Menarik: </span>
            {data.funFact}
          </p>
        </div>
      )}
    </div>
  );
}
