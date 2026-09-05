// ---------------------------------------------------------------------------
// MonthView — Level 1: 6-month overview bar chart.
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import { formatRupiah, compactRupiah } from './finance-types';
import type { MonthData } from './finance-explorer-types';

export interface MonthViewProps {
  monthlyData: MonthData[];
  monthlyError: boolean;
  selectedMonth: string;
  primaryColor: string;
  mutedFgColor: string;
  onDrillToMonth: (month: string) => void;
}

export function MonthView({
  monthlyData,
  monthlyError,
  selectedMonth,
  primaryColor,
  mutedFgColor,
  onDrillToMonth,
}: MonthViewProps) {
  return (
    <div className="fe-card">
      <h3 className="fe-card-title">Ringkasan 6 Bulan</h3>
      {monthlyError ? (
        <p className="text-sm text-destructive text-center py-12">Gagal memuat data. Coba refresh halaman.</p>
      ) : monthlyData.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-2 anim-float-subtle">📊</div>
          <p className="text-sm text-muted-foreground">Belum ada data pengeluaran</p>
        </div>
      ) : (
      <div className="w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: mutedFgColor }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: mutedFgColor }} tickLine={false} axisLine={false} tickFormatter={(v) => compactRupiah(Number(v))} width={40} />
          <RechartsTooltip
            formatter={(value) => [formatRupiah(Number(value)), 'Pengeluaran']}
            labelFormatter={(label) => (label ? String(label) : '')}
            contentStyle={{ borderRadius: '12px', fontSize: '11px', backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
            cursor={{ fill: `${primaryColor}10` }}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48} onClick={(d) => { const m = (d?.payload as MonthData | undefined)?.month; if (m) onDrillToMonth(m); }}>
            {monthlyData.map((entry, i) => (
              <Cell key={i} fill={entry.month === selectedMonth ? primaryColor : `${primaryColor}60`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      )}
      <p className="text-[11px] text-muted-foreground text-center mt-2">Klik bar bulan untuk drill-down ke minggu →</p>
    </div>
  );
}
