'use client';

// components/habit-tracker/category-explorer-detail-chart.tsx — "Grafik
// Harian" view detail kategori: ComposedChart bar (total harian) + line
// (rata² 7 hari) + ReferenceLine rata² harian (E15). Diekstraksi dari
// category-explorer-detail-view.tsx saat SPLIT god-file (Task 71-g) —
// JSX/konfigurasi recharts/tooltip identik (termasuk FIX-COLOR-P3 var
// tema + guard lebar mobile min-w-0/overflow-hidden).

import type { CSSProperties } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatRupiah } from './finance-types';
import { compactRupiahSafe } from './category-explorer-helpers';
import type { DailyData } from './category-explorer-types';

export interface CategoryDetailChartProps {
  chartData: DailyData[];
  /** Rata² per hari aktif — 0 menyembunyikan ReferenceLine + swatch. */
  dailyAverage: number;
  primaryColor: string;
}

export function CategoryDetailChart({ chartData, dailyAverage, primaryColor }: CategoryDetailChartProps) {
  return (
    <div className="premium-card premium-card-sheen rounded-2xl overflow-hidden anim-stagger contain-card" style={{ '--stagger': 1 } as CSSProperties}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="premium-label flex items-center gap-2">
            <span className="chip-icon h-7 w-7 chip-teal shrink-0" aria-hidden="true">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            Grafik Harian
          </h3>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: primaryColor }} />
              Harian
            </span>
            <span className="flex items-center gap-1">
              {/* FIX-COLOR-P3: was hardcoded #10b981 — now var(--chart-2)
                  so the moving-avg legend swatch matches the Line stroke
                  and follows the user's theme. */}
              <span className="w-4 h-0.5" style={{ backgroundColor: 'var(--chart-2)' }} />
              Rata² 7 hari
            </span>
            {dailyAverage > 0 && (
              <span className="flex items-center gap-1">
                {/* FIX-COLOR-P3: was hardcoded #f59e0b — now var(--warning)
                    so the avg-reference legend swatch matches the
                    ReferenceLine stroke and follows the user's theme. */}
                <span className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: 'var(--warning)' }} />
                Rata²
              </span>
            )}
          </div>
        </div>
        {/* min-w-0 + overflow-hidden: prevents Recharts ResponsiveContainer
            from expanding beyond parent width on mobile (known flex-layout bug) */}
        <div className="w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
            {/* FIX-COLOR-P3: was hardcoded #64748B (slate-500) — now
                var(--muted-foreground) so axis ticks follow the theme. */}
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => compactRupiahSafe(v)} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value, name) => [
                formatRupiah(Number(value)),
                name === 'total' ? 'Harian' : name === 'movingAvg' ? 'Rata² 7 hari' : name,
              ]}
              labelFormatter={(_label, payload: any) => {
                const data = payload?.[0]?.payload;
                return data?.dateLabel || `Tgl ${_label != null ? String(_label) : ''}`;
              }}
            />
            <Bar dataKey="total" fill={primaryColor} radius={[3, 3, 0, 0]} maxBarSize={20} />
            {dailyAverage > 0 && (
              <ReferenceLine
                y={dailyAverage}
                // FIX-COLOR-P3: was hardcoded #f59e0b — now var(--warning)
                // so the avg reference line follows the user's theme.
                stroke="var(--warning)"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                label={{
                  value: `Rata² ${compactRupiahSafe(dailyAverage)}`,
                  position: 'insideTopRight',
                  fill: 'var(--warning)',
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="movingAvg"
              // FIX-COLOR-P3: was hardcoded #10b981 — now var(--chart-2)
              // (teal) so the moving-average line follows the user's theme
              // and stays visually distinct from the primary-green bars.
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              yAxisId={0}
            />
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
