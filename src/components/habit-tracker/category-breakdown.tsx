'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah, type Transaction } from '@/components/habit-tracker/finance-types';
import { CountUpRupiah, CountUpNumber } from '@/components/habit-tracker/count-up';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { useThemeColor } from '@/hooks/use-theme-color';
import { jakartaDateKey } from '@/lib/timezone';

// ── Period options ───────────────────────────────────────────────────────
// Last 6 full months. The current month (i=0) is the default selection,
// so users immediately see the current month's data without picking "Bulan
// Berjalan" explicitly. For the current month, the end date is capped at
// today so we don't show future dates with no transactions.

function buildPeriodOptions(): { value: string; label: string; start: string; end: string }[] {
  const now = new Date();
  const opts: { value: string; label: string; start: string; end: string }[] = [];

  // Last 6 months (i=0 = current month)
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1);
    // For the current month (i=0), cap end at today; for past months use last day
    const end = i === 0
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(y, m + 1, 0);
    const label = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    opts.push({
      value: `${y}-${String(m + 1).padStart(2, '0')}`,
      label,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  }

  return opts;
}

/** Default period = current month (first option, i=0). Computed once. */
function defaultPeriodValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────

// Build theme gradient from the primary color at runtime (in component).
// This ensures the timeline follows the user's chosen color theme.

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function compactRupiah(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function dateKey(iso: string): string {
  return jakartaDateKey(new Date(iso));
}

/** Group transactions by date, returns array of { key, label, txs, total } */
function groupByDate(txs: Transaction[]) {
  const todayKey = jakartaDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = jakartaDateKey(yesterday);

  const map = new Map<string, Transaction[]>();
  for (const t of txs) {
    const k = dateKey(t.date);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      let label: string;
      if (key === todayKey) label = 'Hari Ini';
      else if (key === yesterdayKey) label = 'Kemarin';
      else label = new Date(key + 'T12:00:00').toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'short',
      });
      const total = items.reduce((s, t) => s + t.amount, 0);
      // sort within group by time desc
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { key, label, txs: items, total };
    });
}

/** Aggregate transactions by day for the trend chart */
function dailyTrend(txs: Transaction[], startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const map = new Map<string, number>();

  // Build full date range (so chart shows gaps as 0)
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
    const k = cursor.toISOString().slice(0, 10);
    map.set(k, 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const t of txs) {
    const k = dateKey(t.date);
    map.set(k, (map.get(k) || 0) + t.amount);
  }

  return Array.from(map.entries()).map(([k, v]) => ({
    date: k,
    label: new Date(k + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    amount: v,
  }));
}

// ── Category gradient (logo background) — premium palette ──────────────

const CATEGORY_GRADIENTS: Record<string, string> = {
  red: 'from-violet-600 to-indigo-600',
  orange: 'from-amber-500 to-orange-500',
  amber: 'from-amber-500 to-orange-500',
  purple: 'from-fuchsia-500 to-purple-600',
  pink: 'from-pink-500 to-fuchsia-500',
  blue: 'from-blue-600 to-cyan-500',
  gray: 'from-slate-400 to-indigo-400',
};

function merchantEmoji(desc: string, catEmoji: string): string {
  const d = (desc || '').toLowerCase();
  if (/starbucks|starbuck/.test(d)) return '☕';
  if (/kenangan/.test(d)) return '☕';
  if (/janji jiwa/.test(d)) return '☕';
  if (/kopi|coffee/.test(d)) return '☕';
  if (/makan|nasi|ayam|geprek|warteg|goreng/.test(d)) return '🍽️';
  if (/dating|kencan/.test(d)) return '💖';
  if (/transport|gojek|grab|bensin/.test(d)) return '🚗';
  if (/belanja|indomaret|alfamart/.test(d)) return '🛒';
  return catEmoji || '💳';
}

// ── Custom chart tooltip ────────────────────────────────────────────────

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; amount: number } }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  if (p.amount === 0) return null;
  return (
    <div className="cb-tooltip">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{p.label}</p>
      <p className="text-sm font-bold tabular-nums">{formatRupiah(p.amount)}</p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

interface CategoryBreakdownProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

export default function CategoryBreakdown({ getCategoryMeta }: CategoryBreakdownProps) {
  const periodOptions = useMemo(() => buildPeriodOptions(), []);
  const [periodValue, setPeriodValue] = useState(defaultPeriodValue); // 'yyyy-MM'
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const isMobile = useIsMobile();

  // Read the theme's primary color dynamically so the timeline follows
  // the user's chosen color theme (not hardcoded violet/blue).
  const primaryHex = useThemeColor('primary');
  const THEME = useMemo(() => ({
    from: primaryHex,
    to: primaryHex,
    fromSoft: hexToRgba(primaryHex, 0.08),
    toSoft: hexToRgba(primaryHex, 0.06),
  }), [primaryHex]);

  const period = useMemo(
    () => periodOptions.find((o) => o.value === periodValue) || periodOptions[0],
    [periodOptions, periodValue],
  );

  // Fetch ALL expense transactions for the period (no category filter) so we
  // can derive the category dropdown + switch categories instantly.
  // Query key is namespaced under ['finance', ...] so that invalidateFinance()
  // (which invalidates { queryKey: ['finance'] }) refetches this query
  // immediately when a new transaction is added/edited/deleted.
  const { data: allTx = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['finance', 'cb-transactions', period.start, period.end],
    queryFn: async () => {
      const res = await fetch(
        `/api/finance/transactions?type=expense&startDate=${period.start}&endDate=${period.end}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10_000,
  });

  // Categories that have transactions (dropdown only shows these)
  const categoriesWithTx = useMemo(() => {
    const set = new Set(allTx.map((t) => t.category));
    return Array.from(set).sort();
  }, [allTx]);

  // Derive the effective category during render — if the stored selection is
  // no longer valid (period changed, category has no tx), fall back to the
  // first available. This avoids setState-in-effect lint violations and is
  // the React 19 recommended pattern for "adjusting state when derived data changes".
  const effectiveCategory =
    selectedCategory && categoriesWithTx.includes(selectedCategory)
      ? selectedCategory
      : (categoriesWithTx[0] ?? null);

  // Filter to selected category
  const txs = useMemo(
    () => allTx.filter((t) => t.category === effectiveCategory),
    [allTx, effectiveCategory],
  );

  // Stats
  const stats = useMemo(() => {
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const count = txs.length;
    const max = txs.reduce((m, t) => Math.max(m, t.amount), 0);
    const avg = count > 0 ? Math.round(total / count) : 0;
    return { total, count, max, avg };
  }, [txs]);

  // Daily trend
  const trend = useMemo(
    () => (txs.length > 0 ? dailyTrend(txs, period.start, period.end) : []),
    [txs, period.start, period.end],
  );

  // Top 3
  const top3 = useMemo(
    () => [...txs].sort((a, b) => b.amount - a.amount).slice(0, 3),
    [txs],
  );

  // All transactions grouped by date
  const groups = useMemo(() => groupByDate(txs), [txs]);

  // ── Render ──

  return (
    <section className="cb-section">
      {/* ── Top Row: Category + Period dropdowns ── */}
      <header className="cb-top-row">
        <Select
          value={effectiveCategory ?? undefined}
          onValueChange={setSelectedCategory}
          disabled={categoriesWithTx.length === 0}
        >
          <SelectTrigger className="cb-dropdown cb-dropdown-cat">
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            {categoriesWithTx.map((c) => {
              const m = getCategoryMeta(c);
              return (
                <SelectItem key={c} value={c}>
                  {m.emoji} {c}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Select value={periodValue} onValueChange={setPeriodValue}>
            <SelectTrigger className="cb-dropdown">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {periodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {isLoading ? (
        <div className="cb-loading">
          <div className="cb-skeleton-line" />
          <div className="cb-skeleton-line" />
          <div className="cb-skeleton-line" />
          <div className="cb-skeleton-block" />
          <div className="cb-skeleton-block" />
        </div>
      ) : txs.length === 0 ? (
        <div className="cb-empty">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm font-medium text-muted-foreground">Tidak ada transaksi</p>
          <p className="text-xs text-muted-foreground mt-1">
            {effectiveCategory ? `Kategori "${effectiveCategory}" di ${period.label}` : 'Pilih kategori untuk melihat rincian'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Statistics: thin gradient divider lines ── */}
          <div className="cb-stats">
            <div className="cb-stat">
              <div className="cb-stat-line cb-grad-purple" />
              <div className="cb-stat-body">
                <span className="cb-stat-label">Total</span>
                <span className="cb-stat-value"><CountUpRupiah amount={stats.total} /></span>
              </div>
            </div>
            <div className="cb-stat">
              <div className="cb-stat-line cb-grad-blue" />
              <div className="cb-stat-body">
                <span className="cb-stat-label">Transaksi</span>
                <span className="cb-stat-value"><CountUpNumber value={stats.count} /> <span className="cb-stat-unit">trx</span></span>
              </div>
            </div>
            <div className="cb-stat">
              <div className="cb-stat-line cb-grad-orange" />
              <div className="cb-stat-body">
                <span className="cb-stat-label">Tertinggi</span>
                <span className="cb-stat-value"><CountUpRupiah amount={stats.max} /></span>
              </div>
            </div>
          </div>

          {/* ── Daily Trend: line chart ── */}
          <div className="cb-card">
            <div className="cb-card-head">
              <div>
                <h3 className="cb-card-title">Tren Harian</h3>
                <p className="cb-card-sub">Pengeluaran per hari · {period.label}</p>
              </div>
              <div className="cb-trend-legend">
                <span className="cb-trend-avg">Avg {compactRupiah(stats.avg)}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 130 : 180}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="cb-stroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="50%" stopColor="#4F46E5" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                  <linearGradient id="cb-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: isMobile ? 8 : 9, fill: 'oklch(0.55 0.01 120)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={isMobile ? 12 : 20}
                  dy={4}
                />
                <YAxis
                  tick={{ fontSize: isMobile ? 8 : 9, fill: 'oklch(0.55 0.01 120)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => compactRupiah(Number(v))}
                  width={isMobile ? 34 : 40}
                />
                <RechartsTooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'oklch(0.7 0.01 120)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.5 }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="url(#cb-stroke)"
                  strokeWidth={2.5}
                  fill="url(#cb-fill)"
                  dot={{ r: 3, fill: '#4F46E5', strokeWidth: 0, opacity: 0 }}
                  activeDot={{ r: 5, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={800}
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Top 3 Transactions ── */}
          <div className="cb-card">
            <div className="cb-card-head cb-top3-head">
              <h3 className="cb-card-title">Top 3 Terbesar</h3>
              <span className="cb-top3-badge">🏆</span>
            </div>
            <div className="cb-top3-list">
              {top3.map((t, i) => {
                const m = getCategoryMeta(t.category);
                const grad = CATEGORY_GRADIENTS[m.color] || CATEGORY_GRADIENTS.gray;
                const trophies = ['🥇', '🥈', '🥉'];
                return (
                  <div key={t.id} className="cb-top3-item">
                    <div className={cn('cb-top3-rank', grad)}>
                      <span>{trophies[i]}</span>
                    </div>
                    <div className="cb-top3-logo">
                      {merchantEmoji(t.description || '', m.emoji)}
                    </div>
                    <div className="cb-top3-info">
                      <p className="cb-top3-name">{t.description || t.category}</p>
                      <p className="cb-top3-date">
                        {formatDateShort(t.date)} · {formatTime(t.date)}
                      </p>
                    </div>
                    <span className="cb-top3-amount">{formatRupiah(t.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── All Transactions (expandable timeline) ── */}
          <div className="cb-card">
            <button
              type="button"
              className="cb-card-head cb-expand-trigger"
              onClick={() => setAllExpanded((v) => !v)}
            >
              <div>
                <h3 className="cb-card-title">Semua Transaksi</h3>
                <p className="cb-card-sub">{txs.length} transaksi · {period.label}</p>
              </div>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', allExpanded && 'rotate-180')} />
            </button>

            {/* Expandable timeline — uses grid-template-rows for smooth height animation */}
            <div className={cn('anim-expand', !allExpanded && 'anim-expand-collapsed')}>
              <div>
                <div className="cb-timeline">
                  {groups.map((g) => (
                    <div key={g.key} className="cb-timeline-group">
                      {/* Day header — clean, single theme gradient tint */}
                      <div
                        className="cb-timeline-date cb-timeline-date-colorful"
                        style={{ background: `linear-gradient(90deg, ${THEME.fromSoft}, ${THEME.toSoft})` }}
                      >
                        <span
                          className="cb-timeline-pill"
                          style={{ background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` }}
                        />
                        <span className="cb-timeline-day-label">{g.label}</span>
                        <span
                          className="cb-timeline-count cb-timeline-count-color"
                          style={{ color: THEME.from }}
                        >
                          {g.txs.length} trx · {formatRupiah(g.total)}
                        </span>
                      </div>
                      <div className="cb-timeline-items">
                        {g.txs.map((t) => {
                          const m = getCategoryMeta(t.category);
                          return (
                            <div
                              key={t.id}
                              className="cb-tx-row-theme"
                            >
                              <span
                                className="cb-tx-dot-theme"
                                style={{ background: `linear-gradient(135deg, ${THEME.from}, ${THEME.to})` }}
                              />
                              <div className="cb-tx-logo-theme">
                                {merchantEmoji(t.description || '', m.emoji)}
                              </div>
                              <div className="cb-tx-info">
                                <p className="cb-tx-name">{t.description || t.category}</p>
                                <p className="cb-tx-time">
                                  <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                                  {formatTime(t.date)}
                                </p>
                              </div>
                              <span className="cb-tx-amount-theme">
                                {formatRupiah(t.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {!allExpanded && (
              <button
                type="button"
                className="cb-expand-hint cb-expand-hint-colorful"
                onClick={() => setAllExpanded(true)}
              >
                <span className="cb-expand-hint-gradient" />
                <span className="relative">Lihat semua {txs.length} transaksi</span>
                <ChevronDown className="h-3.5 w-3.5 relative" />
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
