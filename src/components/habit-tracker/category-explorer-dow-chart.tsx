'use client';

// components/habit-tracker/category-explorer-dow-chart.tsx — pola pengeluaran
// per hari dalam seminggu (Min..Sab): area chart halus + node titik.
// Baris dengan nilai tertinggi (topIdx) di-highlight lewat dot besar.

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { compactRupiah } from './finance-types';

export interface DowPoint {
  day: string;
  total: number;
  count: number;
  pct: number;
}

export function DowLineChart({
  data,
  topIdx,
  color,
}: {
  data: DowPoint[];
  topIdx: number;
  color: string;
}) {
  const gradientId = `dow-grad-${topIdx}`;
  return (
    <div className="h-28 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.35 }}
            formatter={(value: number | string) => [compactRupiah(Number(value)), 'Total']}
            labelFormatter={(label: string) => `Hari ${label}`}
            contentStyle={{
              fontSize: 11,
              borderRadius: 10,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 4.5, fill: color, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
