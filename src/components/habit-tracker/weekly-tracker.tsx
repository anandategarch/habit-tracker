'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings2, TrendingUp, Copy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from './finance-types';
import { toast } from 'sonner';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useCountUp } from '@/hooks/use-count-up';
import { jakartaDateString } from '@/lib/jakarta-date';

// ── Types ───────────────────────────────────────────────────────────────

interface WeekData {
  week: number;
  label: string;
  dateRange: string;
  target: number;
  effectiveTarget: number;
  spent: number;
  remaining: number;
  rollover: boolean;
  rolloverIn: number;
  percentage: number;
  status: 'unset' | 'active' | 'past' | 'future';
  isOverBudget: boolean;
  isCurrentWeek: boolean;
}

interface WeeklyBudgetData {
  month: string;
  weeks: WeekData[];
  totalTarget: number;
  totalSpent: number;
  totalPercentage: number;
  suggestedTarget: number;
  currentWeek: number;
}

// ── Component ───────────────────────────────────────────────────────────

export default function WeeklyTracker() {
  const queryClient = useQueryClient();
  const primaryColor = useThemeColor('primary');
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState('');
  const [editRollover, setEditRollover] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentMonth = jakartaDateString().slice(0, 7); // "yyyy-MM"

  const { data, isLoading } = useQuery<WeeklyBudgetData>({
    queryKey: ['finance', 'weekly-budget', currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/weekly-budget?month=${currentMonth}`);
      if (!res.ok) throw new Error('Failed to fetch weekly budget');
      return res.json();
    },
    staleTime: 15_000,
  });

  // ── Handlers ──

  const openEditDialog = (week: WeekData) => {
    setEditingWeek(week.week);
    setEditTarget(week.target > 0 ? String(week.target) : String(data?.suggestedTarget || '500000'));
    setEditRollover(week.rollover);
  };

  const handleSave = async () => {
    if (!editingWeek || !data) return;
    setSaving(true);
    try {
      const res = await fetch('/api/finance/weekly-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: data.month,
          week: editingWeek,
          target: parseInt(editTarget) || 0,
          rollover: editRollover,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(`Target Week ${editingWeek} disimpan`);
      queryClient.invalidateQueries({ queryKey: ['finance', 'weekly-budget'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      setEditingWeek(null);
    } catch {
      toast.error('Gagal menyimpan target');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFromLastMonth = async () => {
    if (!data) return;
    // For now, just set all weeks to the suggested target
    try {
      const target = data.suggestedTarget;
      for (let w = 1; w <= 4; w++) {
        await fetch('/api/finance/weekly-budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: data.month, week: w, target, rollover: true }),
        });
      }
      toast.success('Target disalin ke semua minggu');
      queryClient.invalidateQueries({ queryKey: ['finance', 'weekly-budget'] });
    } catch {
      toast.error('Gagal menyalin target');
    }
  };

  const handleDistributeEvenly = async (total: number) => {
    if (!data) return;
    const perWeek = Math.round(total / 4);
    try {
      for (let w = 1; w <= 4; w++) {
        await fetch('/api/finance/weekly-budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: data.month, week: w, target: perWeek, rollover: true }),
        });
      }
      toast.success(`Rp ${formatRupiah(perWeek)} per minggu`);
      queryClient.invalidateQueries({ queryKey: ['finance', 'weekly-budget'] });
    } catch {
      toast.error('Gagal membagi target');
    }
  };

  // ── Loading ──

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-6 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data) {
    // Fallback: show empty state instead of null so the section is always
    // visible (even if the API fails or the DB table doesn't exist yet).
    return (
      <section className="anim-stagger">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold tracking-tight">📊 Weekly Tracker</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Set target pengeluaran per minggu</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((w, i) => (
            <div
              key={w}
              className="wt-card wt-card-unset anim-stagger"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-bold">Week {w}</p>
                  <p className="text-[10px] text-muted-foreground">—</p>
                </div>
              </div>
              <div className="text-center py-3 rounded-xl border-2 border-dashed border-border">
                <p className="text-[10px] text-muted-foreground">Loading...</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── Render ──

  return (
    <section className="anim-stagger">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight">📊 Weekly Tracker</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.month} · Total: {formatRupiah(data.totalSpent)} / {formatRupiah(data.totalTarget)} ({data.totalPercentage}%)
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleCopyFromLastMonth}
            title="Set all weeks to suggested target"
          >
            <Sparkles className="h-3 w-3" />
            Auto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => handleDistributeEvenly(data.suggestedTarget * 4)}
            title="Distribute evenly across 4 weeks"
          >
            <Copy className="h-3 w-3" />
            Split
          </Button>
        </div>
      </div>

      {/* 4-Week Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.weeks.map((w, idx) => (
          <WeekCard
            key={w.week}
            week={w}
            primaryColor={primaryColor}
            staggerIndex={idx}
            onEdit={() => openEditDialog(w)}
          />
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editingWeek !== null} onOpenChange={(open) => !open && setEditingWeek(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Target Week {editingWeek}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Smart Suggestion */}
            {data.suggestedTarget > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-primary/5 p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs font-medium">Saran Target</p>
                    <p className="text-sm font-bold">{formatRupiah(data.suggestedTarget)}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditTarget(String(data.suggestedTarget))}
                >
                  Pakai
                </Button>
              </div>
            )}

            {/* Target Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Target Pengeluaran</Label>
              <Input
                type="number"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                placeholder="500000"
                className="text-lg font-bold"
              />
              <p className="text-xs text-muted-foreground">Masukkan maks pengeluaran untuk minggu ini</p>
            </div>

            {/* Rollover Toggle */}
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <Label className="text-sm font-medium">Rollover</Label>
                <p className="text-xs text-muted-foreground">Sisa budget masuk ke minggu depan</p>
              </div>
              <Switch checked={editRollover} onCheckedChange={setEditRollover} />
            </div>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving || !editTarget}
            >
              {saving ? 'Menyimpan...' : 'Simpan Target'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── WeekCard sub-component ──────────────────────────────────────────────

function WeekCard({
  week,
  primaryColor,
  staggerIndex,
  onEdit,
}: {
  week: WeekData;
  primaryColor: string;
  staggerIndex: number;
  onEdit: () => void;
}) {
  const spentDisplay = useCountUp(week.spent, 800, 0);
  const isUnset = week.status === 'unset';
  const isPast = week.status === 'past';
  const isFuture = week.status === 'future';
  const isActive = week.status === 'active';
  const isOver = week.isOverBudget;

  // Status badge
  const badge = isUnset ? null : isOver ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600">
      Over {week.percentage}%
    </span>
  ) : week.percentage >= 80 ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
      {week.percentage}%
    </span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
      {week.percentage}%
    </span>
  );

  return (
    <div
      className={cn(
        'wt-card anim-stagger anim-lift',
        isActive && 'wt-card-active',
        isPast && 'wt-card-past',
        isFuture && 'wt-card-future',
        isUnset && 'wt-card-unset',
      )}
      style={{ animationDelay: `${staggerIndex * 60}ms` }}
    >
      {/* Header: Week label + date range */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-bold">{week.label}</p>
          <p className="text-[10px] text-muted-foreground">{week.dateRange}</p>
        </div>
        {badge}
      </div>

      {/* Spent / Target */}
      {isUnset ? (
        <button
          onClick={onEdit}
          className="w-full text-center py-3 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Settings2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Set Target</span>
        </button>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-bold tabular-nums">{formatRupiah(spentDisplay)}</span>
            <span className="text-[10px] text-muted-foreground">/ {formatRupiah(week.effectiveTarget)}</span>
          </div>

          {/* Rollover indicator */}
          {week.rolloverIn > 0 && (
            <div className="flex items-center gap-0.5 mb-1">
              <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
              <span className="text-[9px] text-emerald-600">+{formatRupiah(week.rolloverIn)} rollover</span>
            </div>
          )}

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                isOver ? 'bg-red-500' : week.percentage >= 80 ? 'bg-amber-500' : '',
              )}
              style={{
                width: `${Math.min(week.percentage, 100)}%`,
                backgroundColor: (!isOver && week.percentage < 80) ? primaryColor : undefined,
              }}
            />
          </div>

          {/* Remaining + status */}
          <div className="flex items-center justify-between mt-2">
            <span className={cn(
              'text-[10px] font-medium',
              week.remaining >= 0 ? 'text-muted-foreground' : 'text-red-500',
            )}>
              {week.remaining >= 0 ? `Sisa ${formatRupiah(week.remaining)}` : `Over ${formatRupiah(Math.abs(week.remaining))}`}
            </span>
            {isActive && (
              <span className="text-[9px] font-bold text-primary flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Active
              </span>
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={onEdit}
            className="w-full mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            Edit target
          </button>
        </>
      )}
    </div>
  );
}

// ── WeeklyTrendChart: Premium area chart with KPI cards ─────────────────

export function WeeklyTrendChart() {
  const primaryColor = useThemeColor('primary');
  const currentMonth = jakartaDateString().slice(0, 7);

  const { data } = useQuery<WeeklyBudgetData>({
    queryKey: ['finance', 'weekly-budget', currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/finance/weekly-budget?month=${currentMonth}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 15_000,
  });

  if (!data || data.weeks.every((w) => w.target === 0 && w.spent === 0)) {
    return null;
  }

  // Build chart data
  const hasTarget = data.weeks.some((w) => w.target > 0);
  const chartData = data.weeks.map((w) => ({
    label: `W${w.week}`,
    spent: w.spent,
    target: w.target > 0 ? w.target : undefined,
  }));

  const maxVal = Math.max(
    ...chartData.map((d) => Math.max(d.spent, d.target || 0)),
    1,
  );

  // KPI values
  const totalTarget = data.totalTarget || 0;
  const totalSpend = data.totalSpent;
  const vsTarget = totalTarget > 0 ? Math.round((totalSpend / totalTarget) * 100) : 0;
  const avgPerWeek = data.weeks.length > 0 ? Math.round(totalSpend / data.weeks.length) : 0;
  const isOverTarget = totalTarget > 0 && totalSpend > totalTarget;

  // Convert month "2026-07" to "Juli 2026"
  const [yr, mo] = data.month.split('-');
  const monthLabel = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <section className="wt-premium anim-stagger" style={{ animationDelay: '100ms' }}>
      {/* ── Header ── */}
      <header className="wt-premium-header">
        <div className="flex items-center gap-3">
          {/* Gradient icon */}
          <div className="wt-premium-icon">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="wt-premium-title">Tren Mingguan</h3>
            <p className="wt-premium-subtitle">{monthLabel} · Total {formatRupiah(totalSpend)}</p>
          </div>
        </div>
      </header>

      {/* ── Main Chart ── */}
      <div className="wt-premium-chart-area">
        {/* Soft glow behind chart */}
        <div className="wt-premium-glow" style={{ background: `radial-gradient(ellipse at center, ${primaryColor}15 0%, transparent 70%)` }} />

        {/* Chart */}
        <div className="relative h-40 flex items-end justify-around gap-2 z-10">
          {chartData.map((d, i) => {
            const spentHeight = maxVal > 0 ? (d.spent / maxVal) * 80 : 0; // 80% max for breathing room
            const targetHeight = d.target && maxVal > 0 ? (d.target / maxVal) * 80 : 0;
            const isOver = d.target && d.spent > d.target;
            const isCurrent = data.currentWeek === i + 1;
            const hasData = d.spent > 0;

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                {/* Value label above marker */}
                {hasData && (
                  <span className="text-[10px] font-bold tabular-nums text-foreground whitespace-nowrap">
                    {formatRupiah(d.spent).replace('Rp ', '')}
                  </span>
                )}

                {/* Bar + marker + target line container */}
                <div className="relative w-full flex-1 flex items-end justify-center">
                  {/* Target dashed line */}
                  {d.target && d.target > 0 && (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-dashed z-20"
                      style={{
                        bottom: `${targetHeight}%`,
                        borderColor: '#8B5CF6',
                        opacity: 0.5,
                      }}
                    />
                  )}

                  {/* Spent bar with gradient + rounded top */}
                  <div
                    className="wt-premium-bar anim-stagger"
                    style={{
                      height: `${spentHeight}%`,
                      background: isOver
                        ? 'linear-gradient(180deg, #ef4444, #f87171)'
                        : `linear-gradient(180deg, ${primaryColor}, ${primaryColor}99)`,
                      minHeight: hasData ? '6px' : '0',
                      animationDelay: `${i * 80}ms`,
                    }}
                  />

                  {/* Floating circular marker on top of bar */}
                  {hasData && (
                    <div
                      className="wt-premium-marker anim-stagger"
                      style={{
                        bottom: `${spentHeight}%`,
                        backgroundColor: isOver ? '#ef4444' : primaryColor,
                        animationDelay: `${i * 80 + 200}ms`,
                      }}
                    />
                  )}

                  {/* Current week indicator */}
                  {isCurrent && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                {/* Week label */}
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    isCurrent ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Target line label */}
        {hasTarget && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-muted-foreground">Target: {formatRupiah(data.weeks.find(w => w.target > 0)?.target || 0)}</span>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="wt-premium-legend">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="text-[11px] font-medium text-muted-foreground">Spent</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: '#8B5CF6' }} />
          <span className="text-[11px] font-medium text-muted-foreground">Target</span>
        </span>
      </div>

      {/* ── Bottom KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Target Mingguan */}
        <div className="wt-kpi-card anim-stagger" style={{ animationDelay: '200ms' }}>
          <div className="wt-kpi-icon" style={{ background: 'linear-gradient(135deg, #6366F1, #818cf8)' }}>
            🎯
          </div>
          <div className="flex-1 min-w-0">
            <p className="wt-kpi-label">Target Mingguan</p>
            <p className="wt-kpi-value">{totalTarget > 0 ? formatRupiah(totalTarget) : '—'}</p>
          </div>
        </div>

        {/* Total Spend */}
        <div className="wt-kpi-card anim-stagger" style={{ animationDelay: '260ms' }}>
          <div className="wt-kpi-icon" style={{ background: 'linear-gradient(135deg, #8B5CF6, #a78bfa)' }}>
            📈
          </div>
          <div className="flex-1 min-w-0">
            <p className="wt-kpi-label">Total Spend</p>
            <p className="wt-kpi-value">{formatRupiah(totalSpend)}</p>
          </div>
        </div>

        {/* Vs Target */}
        <div className="wt-kpi-card anim-stagger" style={{ animationDelay: '320ms' }}>
          <div
            className="wt-kpi-icon"
            style={{ background: isOverTarget ? 'linear-gradient(135deg, #ef4444, #f87171)' : 'linear-gradient(135deg, #10B981, #34d399)' }}
          >
            {isOverTarget ? '⬆️' : '⬇️'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="wt-kpi-label">Vs Target</p>
            <p className={cn('wt-kpi-value', isOverTarget ? 'text-red-500' : 'text-emerald-500')}>
              {totalTarget > 0 ? `${vsTarget > 0 ? '+' : ''}${vsTarget}%` : '—'}
            </p>
          </div>
        </div>

        {/* Average per Week */}
        <div className="wt-kpi-card anim-stagger" style={{ animationDelay: '380ms' }}>
          <div className="wt-kpi-icon" style={{ background: 'linear-gradient(135deg, #60A5FA, #93c5fd)' }}>
            💳
          </div>
          <div className="flex-1 min-w-0">
            <p className="wt-kpi-label">Avg / Week</p>
            <p className="wt-kpi-value">{formatRupiah(avgPerWeek)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
