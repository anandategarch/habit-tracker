'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Wallet, ArrowUpRight, ArrowDownRight, Pencil, ArrowLeftRight } from 'lucide-react';
import { formatRupiah, formatNominalInput, parseNominalInput, type FundSource, type Transaction } from './finance-types';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/timezone';
import { toast } from 'sonner';
import { FlashRupiah } from '@/components/habit-tracker/flash-number';
import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';

// Source accent colors — each source gets a unique vibrant color
const SOURCE_COLORS: Record<string, { bg: string; text: string; gradient: string; sparkline: string }> = {
  'Kas': { bg: '#F97316', text: '#F97316', gradient: 'from-orange-500/10 to-orange-500/5', sparkline: '#F97316' },
  'Bank CIMB': { bg: '#EF4444', text: '#EF4444', gradient: 'from-red-500/10 to-red-500/5', sparkline: '#EF4444' },
  'Bank BRI': { bg: '#3B82F6', text: '#3B82F6', gradient: 'from-blue-500/10 to-blue-500/5', sparkline: '#3B82F6' },
  'Bank Superbank': { bg: '#8B5CF6', text: '#8B5CF6', gradient: 'from-violet-500/10 to-violet-500/5', sparkline: '#8B5CF6' },
  'GoPay': { bg: '#22C55E', text: '#22C55E', gradient: 'from-green-500/10 to-green-500/5', sparkline: '#22C55E' },
  'OVO': { bg: '#8B5CF6', text: '#8B5CF6', gradient: 'from-violet-500/10 to-violet-500/5', sparkline: '#8B5CF6' },
  'DANA': { bg: '#06B6D4', text: '#06B6D4', gradient: 'from-cyan-500/10 to-cyan-500/5', sparkline: '#06B6D4' },
  'ShopeePay': { bg: '#EC4899', text: '#EC4899', gradient: 'from-pink-500/10 to-pink-500/5', sparkline: '#EC4899' },
};

const DEFAULT_COLOR = { bg: '#6366F1', text: '#6366F1', gradient: 'from-indigo-500/10 to-indigo-500/5', sparkline: '#6366F1' };

// ── Types for balance-history API response ───────────────────────────────

interface BalanceHistoryPoint {
  date: string;
  label: string;
  balance: number;
  netFlow: number;
}

interface SourceHistory {
  id: string;
  name: string;
  emoji: string;
  currentBalance: number;
  startBalance: number;
  periodIncome: number;
  periodExpense: number;
  periodChange: number;
  dailyData: BalanceHistoryPoint[];
}

interface BalanceHistoryResponse {
  sources: SourceHistory[];
  period: string;
  days: number;
}

export default function SourceBalanceSection() {
  const queryClient = useQueryClient();
  const [balanceEditId, setBalanceEditId] = useState<string | null>(null);
  const [balanceEditValue, setBalanceEditValue] = useState('');
  // Transfer dialog state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferring, setTransferring] = useState(false);

  const { data: sources = [], isLoading: loading } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15_000,
  });

  // Inline balance edit — same logic as finance.tsx SourcesTab.
  // PATCH /api/finance/sources/[id]/balance creates an adjustment
  // transaction (income if diff > 0, expense if diff < 0) + atomically
  // increments the balance. See route.ts for details.
  //
  // Bug fix: previously fired PATCH even when the value didn't change
  // (user clicked nominal then clicked away without editing). Now we
  // compare the new value with the current balance FIRST — if same,
  // just close edit mode silently (no network call, no toast).
  const handleSaveBalance = async (sourceId: string) => {
    const raw = parseNominalInput(balanceEditValue);
    const val = parseFloat(raw);
    if (isNaN(val)) { setBalanceEditId(null); setBalanceEditValue(''); return; }

    // Find the current balance for this source. If the new value equals
    // the current balance, skip the PATCH entirely — no change needed.
    const source = sources.find((s) => s.id === sourceId);
    const currentBalance = source?.balance ?? 0;
    if (val === currentBalance) {
      // No change — close edit mode silently (no toast, no network call)
      setBalanceEditId(null);
      setBalanceEditValue('');
      return;
    }

    try {
      const res = await fetch(`/api/finance/sources/${sourceId}/balance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: val }),
      });
      if (res.ok) {
        const data = await res.json();
        queryClient.invalidateQueries({ queryKey: ['finance', 'sources'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'daily-recap'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'balance-history'] });
        if (data?.adjustment) {
          const adj = data.adjustment;
          const sign = adj.type === 'income' ? '+' : '−';
          toast.success(`Saldo diupdate — transaksi "${sign}${formatRupiah(adj.amount)}" dibuat`);
        } else {
          toast.success('Saldo diupdate');
        }
      } else {
        toast.error('Gagal update saldo');
      }
    } catch { toast.error('Gagal update saldo'); }
    setBalanceEditId(null);
    setBalanceEditValue('');
  };

  // Transfer between fund sources — creates 2 linked transactions
  // (expense from + income to) atomically via POST /api/finance/transfer.
  // Transfer transactions use category "Transfer Antar Sumber" and are
  // excluded from Daily Recap stats (internal movement, not real income/expense).
  const handleTransfer = async () => {
    if (!transferFrom || !transferTo) { toast.error('Pilih sumber asal dan tujuan'); return; }
    if (transferFrom === transferTo) { toast.error('Sumber asal dan tujuan tidak boleh sama'); return; }
    const raw = parseNominalInput(transferAmount);
    const val = parseFloat(raw);
    if (isNaN(val) || val <= 0) { toast.error('Masukkan jumlah yang valid'); return; }
    setTransferring(true);
    try {
      const res = await fetch('/api/finance/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromSourceId: transferFrom,
          toSourceId: transferTo,
          amount: val,
          description: transferDesc || undefined,
        }),
      });
      if (res.ok) {
        // BUG-9 fix: removed unused `data` variable (was captured but never read).
        // Query invalidation refetches fresh data instead.
        queryClient.invalidateQueries({ queryKey: ['finance', 'sources'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'daily-recap'] });
        queryClient.invalidateQueries({ queryKey: ['finance', 'balance-history'] });
        toast.success(`Transfer ${formatRupiah(val)} berhasil`);
        setTransferOpen(false);
        setTransferFrom(''); setTransferTo(''); setTransferAmount(''); setTransferDesc('');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Transfer gagal');
      }
    } catch { toast.error('Transfer gagal'); }
    setTransferring(false);
  };

  const today = jakartaDateString();
  const { data: todayTx = [] } = useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions-today', today],
    queryFn: async () => {
      // Send full ISO datetime strings (not date-only) to avoid UTC midnight
      // truncation. Previously sent "2026-08-01" which API parsed as UTC
      // midnight → transactions after midnight excluded.
      const startDate = `${today}T00:00:00+07:00`;
      const endDate = `${today}T23:59:59+07:00`;
      const res = await fetch(`/api/finance/transactions?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10_000,
  });

  // Fetch REAL balance history (30 days) for the charts — replaces fake
  // Math.sin() data that previously showed misleading sinusoidal curves.
  const { data: balanceHistory } = useQuery<BalanceHistoryResponse | null>({
    queryKey: ['finance', 'balance-history', '1m'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources/balance-history?period=1m');
      if (!res.ok) return null;
      const data = await res.json();
      // API returns [] on error, { sources, period, days } on success
      if (Array.isArray(data) || !data.sources) return null;
      return data as BalanceHistoryResponse;
    },
    staleTime: 30_000,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (sources.length === 0) return null;

  const totalBalance = sources.reduce((s, src) => s + src.balance, 0);
  // Exclude "Penyesuaian Saldo" and "Transfer Antar Sumber" from
  // today's income/expense display — these are internal movements,
  // not real income/expense.
  const realTodayTx = todayTx.filter(
    t => t.category !== 'Penyesuaian Saldo' && t.category !== 'Transfer Antar Sumber'
  );
  const todayTotalIncome = realTodayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const todayTotalExpense = realTodayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Build REAL summary chart data: sum all sources' daily balances per date.
  // All sources share the same date range from the API, so we iterate by index.
  const historySources = balanceHistory?.sources ?? [];
  const firstSourceData = historySources[0]?.dailyData ?? [];
  const summaryChartData = firstSourceData.map((point, i) => ({
    v: historySources.reduce((sum, s) => sum + (s.dailyData[i]?.balance || 0), 0),
  }));

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Sumber Dana</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola seluruh saldo dari berbagai sumber dana dalam satu tampilan.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTransferOpen(true)}
          disabled={sources.length < 2}
          className="shrink-0"
        >
          <ArrowLeftRight className="h-4 w-4 mr-1.5" />
          Transfer
        </Button>
      </div>

      {/* ── Main Summary Card (glassmorphism + gradient) ── */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 anim-gradient-shift"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(6, 182, 212, 0.06), rgba(139, 92, 246, 0.05), rgba(99, 102, 241, 0.06))',
          backgroundSize: '200% 200%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(99, 102, 241, 0.06)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(99, 102, 241, 0.1)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Balance + stats */}
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Saldo</p>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 break-words">
                <FlashRupiah amount={totalBalance} />
              </p>
            </div>

            {/* Stat chips */}
            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  Pemasukan {formatRupiah(todayTotalIncome)}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                  Pengeluaran {formatRupiah(todayTotalExpense)}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {sources.length} Akun
                </span>
              </div>
            </div>
          </div>

          {/* Right: Mini chart — REAL 30-day total balance trend */}
          {summaryChartData.length > 1 && (
            <div className="w-full lg:w-48 h-20 lg:h-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summaryChartData}>
                  <defs>
                    <linearGradient id="summaryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    fill="url(#summaryGrad)"
                    dot={false}
                  />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Account Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {sources.map((src, idx) => {
          const color = SOURCE_COLORS[src.name] || DEFAULT_COLOR;
          const isPositive = src.balance >= 0;

          // REAL sparkline data: this source's 30-day balance history
          const sourceHistory = historySources.find((h) => h.name === src.name);
          const sparklineData = (sourceHistory?.dailyData ?? []).map((d) => ({ v: d.balance }));

          return (
            <div
              key={src.id}
              className={cn(
                'group relative bg-white dark:bg-card rounded-2xl p-4 sm:p-5 transition-all duration-300',
                'hover:-translate-y-1 hover:shadow-md anim-stagger'
              )}
              style={{
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                animationDelay: `${idx * 60}ms`,
              }}
            >
              {/* Icon container */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg mb-3 transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${color.bg}15` }}
              >
                {src.emoji}
              </div>

              {/* Name */}
              <p className="text-sm font-semibold text-muted-foreground truncate mb-0.5">
                {src.name}
              </p>

              {/* Balance — clickable for inline edit (creates adjustment tx) */}
              {balanceEditId === src.id ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">Rp</span>
                  <Input
                    autoFocus
                    className="h-11 text-base font-bold w-40 px-2"
                    value={balanceEditValue}
                    onChange={e => setBalanceEditValue(formatNominalInput(e.target.value))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveBalance(src.id);
                      if (e.key === 'Escape') { setBalanceEditId(null); setBalanceEditValue(''); }
                    }}
                    onBlur={() => handleSaveBalance(src.id)}
                  />
                </div>
              ) : (
                <button
                  className="group/balance inline-flex items-center gap-1 text-xl font-bold tracking-tight hover:opacity-70 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBalanceEditId(src.id);
                    // BUG-4 fix: use signed value (not Math.abs) so negative
                    // balances are preserved. Previously Math.abs stripped
                    // the minus sign, causing a click+blur to flip -500k → +500k.
                    setBalanceEditValue(src.balance ? String(src.balance) : '');
                  }}
                  title="Klik untuk adjust saldo"
                >
                  <span className={isPositive ? 'text-foreground' : 'text-red-500'}>
                    {formatRupiah(src.balance)}
                  </span>
                  <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover/balance:opacity-100 transition-opacity" />
                </button>
              )}

              {/* Indicator + sparkline */}
              <div className="flex items-center justify-between mt-2">
                <div className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  isPositive ? 'text-green-500' : 'text-red-500'
                )}>
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {isPositive ? 'Active' : 'Minus'}
                </div>

                {/* Tiny sparkline — REAL 30-day balance history */}
                {sparklineData.length > 1 ? (
                  <div className="w-16 h-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparklineData}>
                        <defs>
                          <linearGradient id={`spark-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color.sparkline} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={color.sparkline} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke={color.sparkline}
                          strokeWidth={1.5}
                          fill={`url(#spark-${idx})`}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  /* If no history (new source, <2 data points), show a subtle
                     flat placeholder instead of a fake wave. */
                  <div className="w-16 h-6 flex items-center">
                    <div className="w-full h-px bg-muted-foreground/20" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Transfer Dialog ── */}
      <Dialog open={transferOpen} onOpenChange={(open) => { if (!open && !transferring) setTransferOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Transfer Antar Sumber
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Dari</Label>
              <Select value={transferFrom} onValueChange={(v) => { setTransferFrom(v); setTransferTo(''); /* BUG-8: clear stale "Ke" value */ }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih sumber asal" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.emoji} {s.name} ({formatRupiah(s.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Ke</Label>
              <Select value={transferTo} onValueChange={setTransferTo}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih sumber tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {sources.filter(s => s.id !== transferFrom).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.emoji} {s.name} ({formatRupiah(s.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Jumlah</Label>
              <Input
                placeholder="0"
                value={transferAmount}
                onChange={e => setTransferAmount(formatNominalInput(e.target.value))}
                className="text-base font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Catatan (opsional)</Label>
              <Input
                placeholder="Contoh: Tarik tunai ATM"
                value={transferDesc}
                onChange={e => setTransferDesc(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setTransferOpen(false)} disabled={transferring}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleTransfer} disabled={transferring || !transferFrom || !transferTo || !transferAmount}>
              {transferring ? 'Memproses...' : 'Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
