// Extracted from dashboard.tsx — reusable sub-components used across the dashboard.
'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CountUpNumber } from '@/components/habit-tracker/count-up';
import { useTypewriter } from '@/hooks/use-typewriter';
import { Info, RefreshCw, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MotivationalQuote, Period } from './dashboard-types';
import { PERIOD_OPTIONS } from './dashboard-types';

export function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Info">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProgressRing({
  value,
  size = 100,
  strokeWidth = 8,
  color = 'stroke-primary',
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(color, 'anim-ring')}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            '--ring-circumference': circumference,
            '--ring-offset': offset,
          } as React.CSSProperties}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold"><CountUpNumber value={value} suffix="%" /></span>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export function MoodEmoji({ mood }: { mood: string }) {
  // API returns moodAverage as a numeric string (e.g. "3.0", "4.5").
  // Map numeric value to emoji — previously looked up mood WORDS
  // (great/good/okay/bad/terrible) which never matched, always showing 😐.
  const num = Number(mood);
  const rounded = isNaN(num) ? 3 : Math.round(num);
  const emojiMap: Record<number, string> = {
    1: '😢', 2: '😔', 3: '😐', 4: '🙂', 5: '😊',
  };
  const emoji = emojiMap[rounded] || '😐';
  // Literal Tailwind colors (matches the inline version that was rendering
  // before PHASE-A-2 dedup). The earlier extraction used semantic tokens
  // (text-destructive/text-warning/text-success) which drift visually
  // from the inline version — unified here.
  const colorMap: Record<number, string> = {
    1: 'text-red-500', 2: 'text-orange-500', 3: 'text-yellow-500',
    4: 'text-emerald-500', 5: 'text-emerald-500',
  };
  return (
    <span className={cn('text-2xl', colorMap[rounded] || 'text-muted-foreground')}>
      {emoji}
    </span>
  );
}

export function getMoodLabel(mood: string) {
  // Guard against null/undefined input — returns empty string instead of
  // crashing on `mood.charAt(0)`.
  if (!mood) return '';
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

export function PeriodFilter({
  period,
  onPeriodChange,
}: {
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg w-fit">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPeriodChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
            period === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function QuoteDisplay({ quote, onRefresh }: { quote: MotivationalQuote; onRefresh: () => void }) {
  const { typed, done } = useTypewriter(quote.quote, 30, 300);
  // Crossfade key: changes when quote text changes → retriggers CSS animation
  const crossfadeKey = quote.quote;
  return (
    <div className="flex items-start gap-3 anim-crossfade" key={crossfadeKey}>
      <div className="mt-1 shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm md:text-base font-medium text-foreground leading-relaxed italic">
          &ldquo;{typed}
          {!done && <span className="anim-cursor text-primary">|</span>}&rdquo;
        </p>
        {done && quote.translation && quote.translation !== quote.quote && (
          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mt-1.5 animate-in fade-in duration-500">
            {quote.translation}
          </p>
        )}
        {done && (
          <div className="flex items-center justify-between mt-2 animate-in fade-in duration-500">
            <p className="text-xs text-muted-foreground">
              — {quote.author}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onRefresh}
              aria-label="Refresh quote"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
