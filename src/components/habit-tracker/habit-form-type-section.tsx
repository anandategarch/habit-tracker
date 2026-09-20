'use client';

// components/habit-tracker/habit-form-type-section.tsx — bagian form habit:
// pemilih tipe habit PHASE3-HABIT (Normal / Hindari / Jumlah) + teks bantu.
// (Pemecahan habit-master.tsx, Task 71-b — markup dipindah apa adanya.)

import { Shield, Ban, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HabitFormSession } from './use-habit-master-form';

export interface HabitFormTypeSectionProps {
  session: HabitFormSession;
}

export function HabitFormTypeSection({
  session,
}: HabitFormTypeSectionProps) {
  const { form, updateForm } = session;

  return (
    <>
      {/* PHASE3-HABIT: Habit type selector (Normal / Avoid / Amount).
          Controls how the daily-tracker interprets the checkbox and
          how the habit card is displayed.
            normal → checking = success (green). Default.
            avoid  → checking = relapse (red). Streak = days WITHOUT
                     a check. Use for "quit" habits (no smoking, no
                     sugar, no social media before noon).
            amount → daily goal with numeric target (e.g. "drink 2L
                     water", "read 30 pages"). HabitLog.value tracks
                     progress toward habit.target. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          {
            value: 'normal',
            label: 'Normal',
            desc: 'Centang = selesai',
            icon: <Shield className="h-4 w-4" />,
            tint: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/10',
            active: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30',
          },
          {
            value: 'avoid',
            label: 'Hindari',
            desc: 'Centang = kambuh (merah)',
            icon: <Ban className="h-4 w-4" />,
            tint: 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10',
            active: 'border-red-500 bg-red-50 dark:bg-red-950/30 ring-2 ring-red-500/30',
          },
          {
            value: 'amount',
            label: 'Jumlah',
            desc: 'Target harian (mis. 2L air)',
            icon: <Gauge className="h-4 w-4" />,
            tint: 'border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/10',
            active: 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 ring-2 ring-sky-500/30',
          },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => updateForm('habitType', opt.value)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all flex items-start gap-2',
              opt.tint,
              form.habitType === opt.value
                ? opt.active
                : 'hover:bg-accent/40',
            )}
          >
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {opt.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {opt.label}
              </span>
              <span className="block text-[11px] text-muted-foreground leading-snug">
                {opt.desc}
              </span>
            </span>
          </button>
        ))}
      </div>
      {form.habitType === 'avoid' && (
        <p className="text-xs text-muted-foreground -mt-2">
          Streak dihitung sebagai hari berturut-turut tanpa centang.
          Cocok untuk &ldquo;berhenti&rdquo; habit (tidak merokok, tidak
          gula, tidak scroll medsos pagi).
        </p>
      )}
      {form.habitType === 'amount' && (
        <p className="text-xs text-muted-foreground -mt-2">
          Gunakan kolom Target di atas untuk menetapkan target harian.
          Pelacakan progres per hari akan tampil di kartu habit.
        </p>
      )}
    </>
  );
}
