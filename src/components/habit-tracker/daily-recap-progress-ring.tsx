'use client';

// components/habit-tracker/daily-recap-progress-ring.tsx — ring progres
// melingkar untuk budget harian. Warna mengikuti status: ok (teal), warn
// (amber), over (rose). Anak (angka %) dirender via children.

import type { ReactNode } from 'react';

const STATUS_COLORS: Record<string, [string, string]> = {
  ok: ['#14b8a6', '#0d9488'],
  warn: ['#f59e0b', '#d97706'],
  over: ['#f43f5e', '#e11d48'],
};

export function ProgressRing({
  percentage,
  status = 'ok',
  size = 48,
  children,
}: {
  percentage: number;
  status?: string;
  size?: number;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(percentage, 100));
  const [from, to] = STATUS_COLORS[status] ?? STATUS_COLORS.ok;
  const gradientId = `ring-grad-${status}-${size}`;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);

  return (
    <div
      className="relative grid place-items-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Progres ${Math.round(percentage)} persen`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          opacity={0.6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
