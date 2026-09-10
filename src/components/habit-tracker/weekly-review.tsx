'use client';

// components/habit-tracker/weekly-review.tsx — "Tinjauan Mingguan": insight
// otomatis dari /api/ai-insights (kontrak: SEMUA teks Indonesia, tiap insight
// boleh membawa habitId). Wiring 4-a: insight dengan habitId → tombol
// "Lihat habit" openHabitFocus(id). Empty + error state premium-empty/orb.

import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarCheck,
  Flame,
  Moon,
  Smile,
  Sparkles,
  TrendingUp,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChartInfo } from './dashboard-helpers';

type InsightType = 'mood' | 'sleep' | 'performance' | 'streak' | 'finance';

interface AiInsight {
  id: string;
  type: InsightType;
  title: string;
  text: string;
  habitId?: string;
}

const TYPE_META: Record<InsightType, { icon: LucideIcon; chip: string; accent: string }> = {
  mood: { icon: Smile, chip: 'chip-soft-rose', accent: '#fb7185' },
  sleep: { icon: Moon, chip: 'chip-soft-violet', accent: '#8b5cf6' },
  performance: { icon: TrendingUp, chip: 'chip-soft-teal', accent: '#14b8a6' },
  streak: { icon: Flame, chip: 'chip-soft-amber', accent: '#f59e0b' },
  finance: { icon: Wallet, chip: 'chip-soft-teal', accent: '#10b981' },
};

export function WeeklyReview() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const openHabitFocus = useAppStore((s) => s.openHabitFocus);

  const { data, isLoading, isError, refetch } = useQuery<AiInsight[]>({
    queryKey: ['ai-insights', refreshKey],
    queryFn: async () => {
      const res = await fetch('/api/ai-insights');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return Array.isArray(json.insights) ? (json.insights as AiInsight[]) : [];
    },
    retry: 1,
  });

  const insights = (data ?? []).filter(
    (i) => i && typeof i === 'object' && typeof i.title === 'string' && typeof i.text === 'string'
  );

  return (
    <section aria-label="Tinjauan mingguan">
      <div className="mb-3 flex items-center gap-2">
        <span className="chip-soft chip-soft-violet h-8 w-8 justify-center" aria-hidden="true">
          <CalendarCheck className="h-4 w-4" />
        </span>
        <h3 className="premium-label flex items-center gap-2">
          Tinjauan Mingguan
          <ChartInfo text="Insight otomatis dari data habit, mood, tidur, streak, dan keuangan kamu. Bila insight terkait habit tertentu, tombol 'Lihat habit' membuka analisisnya di tracker." />
        </h3>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="premium-card rounded-2xl">
          <div className="premium-empty">
            <div className="premium-empty-orb">
              <AlertTriangle className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Gagal memuat insight mingguan</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Coba Lagi
            </Button>
          </div>
        </div>
      ) : insights.length === 0 ? (
        <div className="premium-card rounded-2xl">
          <div className="premium-empty">
            <div className="premium-empty-orb">
              <Sparkles className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Belum ada insight</p>
            <p className="text-xs text-muted-foreground">
              Catat habit dan check-in harian beberapa hari — insight akan muncul di sini.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {insights.slice(0, 6).map((insight) => {
            const meta = TYPE_META[(insight.type ?? 'performance') as InsightType] ?? TYPE_META.performance;
            const Icon = meta.icon;
            const habitId = typeof insight.habitId === 'string' ? insight.habitId : undefined;
            return (
              <article
                key={insight.id}
                className="premium-card premium-card-sheen relative overflow-hidden rounded-2xl p-4"
              >
                {/* Aksen gradien kiri per jenis insight. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, ${meta.accent}, ${meta.accent}22)`,
                  }}
                />
                <div className="flex items-start gap-3 pl-2">
                  <span
                    className={cn('chip-soft h-9 w-9 shrink-0 justify-center', meta.chip)}
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold leading-snug">{insight.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {insight.text}
                    </p>
                    {habitId && (
                      <button
                        type="button"
                        onClick={() => openHabitFocus(habitId)}
                        aria-label={`Lihat habit terkait insight ${insight.title}`}
                        className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        Lihat habit
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
