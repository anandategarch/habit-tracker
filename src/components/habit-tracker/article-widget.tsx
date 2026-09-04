'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ArticleData {
  title: string;
  content: string;
  funFact: string;
  topic: string;
  source: string;
  date: string;
}

/**
 * ArticleWidget — small "Article of the Day" card for Dashboard.
 * Fetches from /api/learning/article (recovered from Learning feature removal).
 * Displays title + summary + fun fact in a compact card.
 */
export function ArticleWidget() {
  const { data, isLoading, refetch, isFetching } = useQuery<ArticleData>({
    queryKey: ['learning-article'],
    queryFn: async () => {
      const res = await fetch('/api/learning/article');
      if (!res.ok) throw new Error('Failed to fetch article');
      return res.json();
    },
    staleTime: Infinity, // Article is daily — no need to refetch
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

  if (!data) return null;

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
