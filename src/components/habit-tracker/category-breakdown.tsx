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
import { SlidersHorizontal, ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah, type Transaction } from '@/components/habit-tracker/finance-types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { jakartaDateKey } from '@/lib/timezone';

// ── Period options ───────────────────────────────────────────────────────
// "Bulan Berjalan" = 1st of current month → today (MTD).
// Plus the last 6 named months for full-month review.

function buildPeriodOptions(): { value: string; label: string; start: string; end: string }[] {
  const now = new Date();
  const opts: { value: string; label: string; start: string; end: string }[] = [];

  // Bulan Berjalan (MTD)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  opts.push({
    value: 'current',
    label: 'Bulan Berjalan',
    start: monthStart.toISOString().slice(0, 10),
    end: now.toISOString().slice(0, 10),
  });

  // Last 6 full months
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0); // last day of month
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

// ── Helpers ─────────────────────────────────────────────────────────────

// Premium fintech gradient palette — each weekday gets its own gradient.
// Inspired by Linear / Stripe / Arc / Raycast / Apple interfaces.
// Mapping (per user spec):
//   Yesterday / Sun → Violet       (#7C3AED → #4F46E5)
//   Monday          → Indigo-Blue  (#4F46E5 → #2563EB)
//   Tuesday         → Cyan-Blue    (#06B6D4 → #3B82F6)
//   Wednesday       → Pink-Purple  (#EC4899 → #A855F7)
//   Thursday        → Emerald      (#10B981 → #34D399)
//   Friday          → Orange-Peach (#F59E0B → #FB923C)
//   Saturday        → Blue-Cyan    (#2563EB → #06B6D4)
const DAY_GRADIENTS = [
  { name: 'violet',       from: '#7C3AED', to: '#4F46E5', tint: 'rgba(124,58,237,0.08)' },  // Sun / Yesterday
  { name: 'indigo-blue',  from: '#4F46E5', to: '#2563EB', tint: 'rgba(79,70,229,0.08)' },   // Mon
  { name: 'cyan-blue',    from: '#06B6D4', to: '#3B82F6', tint: 'rgba(6,182,212,0.08)' },   // Tue
  { name: 'pink-purple',  from: '#EC4899', to: '#A855F7', tint: 'rgba(236,72,153,0.08)' },  // Wed
  { name: 'emerald',      from: '#10B981', to: '#34D399', tint: 'rgba(16,185,129,0.08)' },  // Thu
  { name: 'orange-peach', from: '#F59E0B', to: '#FB923C', tint: 'rgba(245,158,11,0.08)' },  // Fri
  { name: 'blue-cyan',    from: '#2563EB', to: '#06B6D4', tint: 'rgba(37,99,235,0.08)' },   // Sat
];

/** Weekday-based color assignment: the day-of-week (0=Sun ... 6=Sat)
 *  determines the gradient. Same weekday always gets the same color,
 *  different weekdays get different colors — consistent & predictable. */
function dayGradient(dateKeyStr: string) {
  // dateKeyStr = "yyyy-MM-dd"
  const d = new Date(dateKeyStr + 'T12:00:00');
  const weekday = d.getDay(); // 0=Sun, 6=Sat
  return DAY_GRADIENTS[weekday % DAY_GRADIENTS.length];
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
      const gradient = dayGradient(key);
      return { key, label, txs: items, total, gradient };
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
  const [periodValue, setPeriodValue] = useState('current'); // 'current' or 'yyyy-MM'
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  const isMobile = useIsMobile();

  const period = useMemo(
    () => periodOptions.find((o) => o.value === periodValue) || periodOptions[0],
    [periodOptions, periodValue],
  );

  // Fetch ALL expense transactions for the period (no category filter) so we
  // can derive the category dropdown + switch categories instantly.
  const { data: allTx = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['cb-transactions', period.start, period.end],
    queryFn: async () => {
      const res = await fetch(
        `/api/finance/transactions?type=expense&startDate=${period.start}&endDate=${period.end}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
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

  const catMeta = effectiveCategory ? getCategoryMeta(effectiveCategory) : { emoji: '💳', color: 'gray' };

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
            <span className="text-sm leading-none">{catMeta.emoji}</span>
            <SelectValue placeholder="Pilih kategori" />
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
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
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
            </SelectTrigger>
            <SelectContent align="end">
              {periodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button type="button" aria-label="Filter" className="cb-icon-btn">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
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
                <span className="cb-stat-value">{formatRupiah(stats.total)}</span>
              </div>
            </div>
            <div className="cb-stat">
              <div className="cb-stat-line cb-grad-blue" />
              <div className="cb-stat-body">
                <span className="cb-stat-label">Transaksi</span>
                <span className="cb-stat-value">{stats.count} <span className="cb-stat-unit">trx</span></span>
              </div>
            </div>
            <div className="cb-stat">
              <div className="cb-stat-line cb-grad-orange" />
              <div className="cb-stat-body">
                <span className="cb-stat-label">Tertinggi</span>
                <span className="cb-stat-value">{formatRupiah(stats.max)}</span>
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

            {allExpanded && (
              <div className="cb-timeline">
                {groups.map((g) => {
                  const grad = g.gradient;
                  return (
                  <div
                    key={g.key}
                    className="cb-timeline-group"
                    style={{
                      '--day-from': grad.from,
                      '--day-to': grad.to,
                      '--day-tint': grad.tint,
                    } as React.CSSProperties}
                  >
                    {/* Colorful day header with gradient pill + left bar */}
                    <div
                      className="cb-timeline-date cb-timeline-date-colorful"
                      style={{ background: `linear-gradient(90deg, ${grad.from}14, ${grad.to}08)` }}
                    >
                      <span className="cb-timeline-pill" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }} />
                      <span className="cb-timeline-day-label">{g.label}</span>
                      <span
                        className="cb-timeline-count cb-timeline-count-color"
                        style={{ color: grad.from }}
                      >
                        {g.txs.length} trx · {formatRupiah(g.total)}
                      </span>
                    </div>
                    <div
                      className="cb-timeline-items cb-timeline-items-tinted"
                      style={{ background: grad.tint }}
                    >
                      {g.txs.map((t) => {
                        const m = getCategoryMeta(t.category);
                        return (
                          <div
                            key={t.id}
                            className="cb-tx-row cb-tx-row-colorful"
                            style={{ borderLeftColor: grad.from }}
                          >
                            <span
                              className="cb-tx-dot cb-tx-dot-day"
                              style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
                            />
                            <div
                              className="cb-tx-logo cb-tx-logo-colorful"
                              style={{ background: `${grad.from}1a` }}
                            >
                              {merchantEmoji(t.description || '', m.emoji)}
                            </div>
                            <div className="cb-tx-info">
                              <p className="cb-tx-name">{t.description || t.category}</p>
                              <p className="cb-tx-time">
                                <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                                {formatTime(t.date)}
                              </p>
                            </div>
                            <span
                              className="cb-tx-amount cb-tx-amount-colorful"
                              style={{
                                background: `linear-gradient(135deg, ${grad.from}1f, ${grad.to}1f)`,
                                color: grad.from,
                              }}
                            >
                              {formatRupiah(t.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
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
