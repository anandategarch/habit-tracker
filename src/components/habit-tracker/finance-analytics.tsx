'use client';

import { useState, useEffect } from 'react';
import { AnalyticsData, CHART_COLORS, formatRupiah } from '@/components/habit-tracker/finance-types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// ── ChartInfo Helper ────────────────────────────────────────────────────

function ChartInfo({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0" aria-label="Info">
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

// ── Props ───────────────────────────────────────────────────────────────

interface FinanceAnalyticsProps {
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

// ── Component ───────────────────────────────────────────────────────────

export default function FinanceAnalytics({ getCategoryMeta }: FinanceAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/finance/analytics?months=6')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Skeleton className="h-[250px] w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        Gagal memuat data analitik
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Monthly Trend */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            Tren Bulanan (6 Bulan Terakhir)
            <ChartInfo text="Grafik garis pemasukan (hijau), pengeluaran (merah), dan saldo (biru putus-putus) selama 6 bulan terakhir. Sumbu Y dalam juta (jt). Saldo = pemasukan − pengeluaran." />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ResponsiveContainer width="100%" height={280}>
            <RechartsLineChart data={data.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
              <RechartsTooltip
                formatter={(value: number, name: string) => [formatRupiah(value), name === 'income' ? 'Pemasukan' : name === 'expense' ? 'Pengeluaran' : 'Saldo']}
                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
              />
              <Legend formatter={(value) => value === 'income' ? 'Pemasukan' : value === 'expense' ? 'Pengeluaran' : 'Saldo'} />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
            </RechartsLineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Categories */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Kategori Pengeluaran Teratas
            <ChartInfo text="5 kategori dengan total pengeluaran terbesar dalam 6 bulan terakhir." />
          </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.topCategories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    formatter={(value: number) => [formatRupiah(value), 'Total']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                    {data.topCategories.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                Belum ada data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Income Sources Pie */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Sumber Pemasukan
            <ChartInfo text="Distribusi pemasukan berdasarkan kategori dalam 6 bulan terakhir. Persentase dihitung dari total pemasukan." />
          </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.incomeSources.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <RechartsPieChart>
                    <Pie
                      data={data.incomeSources}
                      dataKey="amount"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {data.incomeSources.map((_, i) => (
                        <Cell key={i} fill={['#22c55e', '#06b6d4', '#f59e0b', '#8b5cf6', '#78716c'][i % 5]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => formatRupiah(value)}
                      contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {data.incomeSources.map((s, i) => (
                    <div key={s.source} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ['#22c55e', '#06b6d4', '#f59e0b', '#8b5cf6', '#78716c'][i % 5] }} />
                      <span className="flex-1 truncate">{s.source}</span>
                      <span className="font-semibold">{s.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                Belum ada data pemasukan
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── NEW CHARTS ─── */}

      {/* 1. Stacked Bar Chart - Monthly Composition by Category */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
          Komposisi Pengeluaran Bulanan
          <ChartInfo text="Komposisi pengeluaran per bulan, ditumpuk berdasarkan kategori. 5 kategori teratas ditampilkan terpisah, sisanya digabungkan menjadi 'Lainnya'. Memudahkan melihat perubahan proporsi tiap bulan." />
        </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {(() => {
            const comp = data.monthlyComposition;
            if (!comp || comp.length === 0) return <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data</div>;
            // Get all categories across all months, find top 5
            const allCatsMap: Record<string, number> = {};
            comp.forEach(m => Object.entries(m.categories).forEach(([c, v]) => { allCatsMap[c] = (allCatsMap[c] || 0) + v; }));
            const sortedCats = Object.entries(allCatsMap).sort(([, a], [, b]) => b - a);
            const topCats = sortedCats.slice(0, 5).map(([c]) => c);
            const otherCats = sortedCats.slice(5).map(([c]) => c);

            const stackedData = comp.map(m => {
              const row: Record<string, string | number> = { month: m.monthLabel };
              let otherTotal = 0;
              topCats.forEach(c => { row[c] = Math.round(m.categories[c] || 0); });
              otherCats.forEach(c => { otherTotal += (m.categories[c] || 0); });
              row['Lainnya'] = Math.round(otherTotal);
              return row;
            });

            const allKeys = [...topCats, 'Lainnya'];

            return (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stackedData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                  <RechartsTooltip
                    formatter={(value: number) => formatRupiah(value)}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} iconSize={8} />
                  {allKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 3. Savings Trend */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Tren Tabungan
            <ChartInfo text="Selisih pemasukan dan pengeluaran per bulan. Bar hijau = surplus (menabung), bar merah = defisit (pengeluaran melebihi pemasukan). Persentase perubahan vs bulan sebelumnya ditampilkan." />
          </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.monthlySavings && data.monthlySavings.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthlySavings}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                  <RechartsTooltip
                    formatter={(value: number) => [formatRupiah(Math.abs(value)), value >= 0 ? 'Surplus' : 'Defisit']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload;
                      if (item && item.changePercent !== undefined && item.changePercent !== 0) {
                        return `${label} (${item.changePercent > 0 ? '+' : ''}${item.changePercent}%)`;
                      }
                      return String(label);
                    }}
                  />
                  <ReferenceLine y={0} stroke="#78716c" strokeDasharray="3 3" />
                  <Bar dataKey="savings" name="savings" radius={[4, 4, 0, 0]}>
                    {(data.monthlySavings || []).map((entry, index) => (
                      <Cell key={index} fill={entry.savings >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data</div>
            )}
          </CardContent>
        </Card>

        {/* 4. Tornado/Butterfly Chart */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Perbandingan Bulan Ini vs Bulan Lalu
            <ChartInfo text="Perbandingan pengeluaran per kategori antara bulan ini dan bulan lalu. Bar ke kanan = bulan ini, bar ke kiri = bulan lalu. Memudahkan melihat kategori mana yang naik atau turun." />
          </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.categoryComparison && data.categoryComparison.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.categoryComparison.slice(0, 8).map(c => ({
                  category: c.category,
                  'Bulan Lalu': -c.lastMonth,
                  'Bulan Ini': c.thisMonth,
                }))} layout="vertical" margin={{ left: 90, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Math.abs(v) / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="category" width={105} tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [formatRupiah(Math.abs(value)), name]}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Bulan Lalu" fill="#f97316" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Bulan Ini" fill="#ef4444" radius={[4, 0, 0, 4]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                Belum cukup data untuk perbandingan
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. Radar Chart - Financial Health Score */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
          Skor Kesehatan Keuangan
          <ChartInfo text="5 dimensi keuangan masing-masing dinilai 0-100: (1) Rasio Tabungan: persentase pemasukan yang tersimpan, (2) Diversifikasi: jumlah kategori pengeluaran yang digunakan, (3) Disiplin Budget: persentase anggaran yang tidak terlampaui, (4) Konsistensi: hari dengan transaksi / hari di bulan, (5) Keseimbangan: rasio kategori pemasukan vs pengeluaran. Skor keseluruhan = rata-rata kelima dimensi." />
        </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {data.financialHealth ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-[200px] h-[200px] sm:w-[260px] sm:h-[260px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={[
                    { dim: 'Tabungan', score: data.financialHealth.rasioTabungan },
                    { dim: 'Diversifikasi', score: data.financialHealth.diversifikasi },
                    { dim: 'Budget', score: data.financialHealth.disiplinBudget },
                    { dim: 'Konsistensi', score: data.financialHealth.konsistensi },
                    { dim: 'Keseimbangan', score: data.financialHealth.keseimbangan },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} style={{ overflow: 'visible' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar
                      name="Skor"
                      dataKey="score"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold" style={{ color: data.financialHealth.overallScore >= 70 ? '#22c55e' : data.financialHealth.overallScore >= 40 ? '#f59e0b' : '#ef4444' }}>
                    {data.financialHealth.overallScore}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Skor Total</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 w-full max-w-xs">
                {[
                  { label: 'Rasio Tabungan', score: data.financialHealth.rasioTabungan, desc: 'Pemasukan vs pengeluaran' },
                  { label: 'Diversifikasi', score: data.financialHealth.diversifikasi, desc: 'Variasi kategori' },
                  { label: 'Disiplin Budget', score: data.financialHealth.disiplinBudget, desc: 'Ketaatan budget' },
                  { label: 'Konsistensi', score: data.financialHealth.konsistensi, desc: 'Frekuensi transaksi' },
                  { label: 'Keseimbangan', score: data.financialHealth.keseimbangan, desc: 'Kategori masuk vs keluar' },
                ].map(item => (
                  <div key={item.label} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{item.label}</span>
                      <span className={cn('font-semibold', item.score >= 70 ? 'text-primary' : item.score >= 40 ? 'text-amber-600' : 'text-red-500')}>
                        {item.score}/100
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${item.score}%`,
                          backgroundColor: item.score >= 70 ? '#22c55e' : item.score >= 40 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Pattern */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Pola Pengeluaran per Hari
            <ChartInfo text="Total dan rata-rata pengeluaran per hari dalam seminggu selama 6 bulan terakhir. Berguna untuk melihat pola: hari mana biasanya pengeluaran lebih tinggi." />
          </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.weeklyPattern}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [formatRupiah(value), name === 'total' ? 'Total' : 'Rata-rata']}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="total" fill="#a855f7" radius={[4, 4, 0, 0]} name="total" />
                <Bar dataKey="avg" fill="#c084fc" radius={[4, 4, 0, 0]} name="avg" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Summary Stats + Largest Expenses */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Ringkasan & Pengeluaran Terbesar
            <ChartInfo text="Total pemasukan dan pengeluaran 6 bulan terakhir. Rasio tabungan = (pemasukan − pengeluaran) / pemasukan × 100%. Top 5 transaksi pengeluaran terbesar dalam periode." />
          </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-[10px] text-muted-foreground mb-1">Total Masuk</p>
                <p className="text-sm font-bold text-primary">{formatRupiah(data.totalIncomeInRange)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="text-[10px] text-muted-foreground mb-1">Total Keluar</p>
                <p className="text-sm font-bold text-red-500">{formatRupiah(data.totalExpenseInRange)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-[10px] text-muted-foreground mb-1">Rasio Tabungan</p>
                <p className={cn('text-sm font-bold', data.savingsRate >= 0 ? 'text-primary' : 'text-red-500')}>
                  {data.savingsRate}%
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">5 Pengeluaran Terbesar</p>
              <div className="space-y-1.5">
                {data.largestExpenses.length > 0 ? data.largestExpenses.map((tx, i) => {
                  const meta = getCategoryMeta(tx.category);
                  return (
                    <div key={tx.id} className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      <span>{meta.emoji}</span>
                      <span className="flex-1 truncate">{tx.description || tx.category}</span>
                      <span className="font-semibold text-red-500 shrink-0">{formatRupiah(tx.amount)}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Belum ada data</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}