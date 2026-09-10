'use client';

// components/habit-tracker/daily-recap-sparkline.tsx — sparkline pengeluaran
// 7 hari terakhir (line halus + area gradient teal). Label tanggal pendek
// dirender di dalam komponen (satu per titik data).

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from 'recharts';
import { compactRupiah } from './finance-types';
import type { SparkPoint } from './daily-recap-types';

export function MiniSparkline({ data }: { data: SparkPoint[] }) {
  if (data.length === 0) return null;
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <Tooltip
            cursor={{ stroke: '#14b8a6', strokeOpacity: 0.4 }}
            formatter={(value: number | string) => [compactRupiah(Number(value)), 'Pengeluaran']}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload as SparkPoint | undefined;
              return point ? `${point.dow}, ${point.date}` : '';
            }}
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
            stroke="#14b8a6"
            strokeWidth={2}
            fill="url(#spark-grad)"
            dot={{ r: 2, fill: '#14b8a6', strokeWidth: 0 }}
            activeDot={{ r: 4, fill: '#14b8a6', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
