'use client';

// components/habit-tracker/habit-form-schedule-section.tsx — bagian form
// habit: Jadwal Tampil (Task 37 — pilih hari/tanggal kemunculan) + Target
// Lulus (Task 36 — garis finis/wisuda). (Pemecahan habit-master.tsx,
// Task 71-b — markup dipindah apa adanya.)

import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Task 37 — Jadwal Tampil: konstanta hari (0=Minggu..6=Sabtu, urut Senin dulu).
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@/lib/habit-schedule';
import { TARGET_DAYS_OPTIONS } from './habit-master-types';
import type { HabitFormSession } from './use-habit-master-form';

export interface HabitFormScheduleSectionProps {
  session: HabitFormSession;
}

export function HabitFormScheduleSection({
  session,
}: HabitFormScheduleSectionProps) {
  const { form, updateForm, toggleScheduleDay, toggleScheduleDate } = session;

  return (
    <>
      {/* Task 37 — Jadwal Tampil: habit tidak harus muncul tiap hari. */}
      {/* Pilihan: setiap hari (default) · hari tertentu dalam seminggu */}
      {/* (mis. hanya Senin) · tanggal tertentu dalam sebulan (mis. tgl 1 */}
      {/* & 15). Hari di luar jadwal tidak menghitung bolong — streak & */}
      {/* hari aman tetap aman. */}
      <div className="space-y-2">
        <Label className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          Jadwal Tampil
        </Label>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Jenis jadwal tampil">
          {([
            { value: 'daily', label: 'Setiap Hari' },
            { value: 'weekly', label: 'Hari Tertentu' },
            { value: 'monthly', label: 'Tanggal Tertentu' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateForm('scheduleKind', opt.value)}
              aria-pressed={form.scheduleKind === opt.value}
              className={cn(
                'rounded-xl border p-2.5 text-xs font-semibold text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                form.scheduleKind === opt.value
                  ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20'
                  : 'border-border/70 hover:border-teal-500/40 text-muted-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {form.scheduleKind === 'weekly' && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hari terjadwal">
              {WEEKDAY_ORDER.map((d) => {
                const active = form.scheduleDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleScheduleDay(d)}
                    aria-pressed={active}
                    className={cn(
                      'h-9 min-w-11 px-2 rounded-xl border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      active
                        ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                        : 'border-border/70 text-muted-foreground hover:border-teal-500/40',
                    )}
                  >
                    {WEEKDAY_LABELS[d] ?? String(d)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Habit hanya tampil di hari terpilih — hari lain tidak
              menghitung bolong. Pilih minimal satu hari.
            </p>
          </div>
        )}
        {form.scheduleKind === 'monthly' && (
          <div className="space-y-1.5">
            <div
              className="grid grid-cols-7 sm:grid-cols-10 gap-1.5"
              role="group"
              aria-label="Tanggal terjadwal"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => {
                const active = form.scheduleDates.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleScheduleDate(n)}
                    aria-pressed={active}
                    aria-label={`Tanggal ${n}`}
                    className={cn(
                      'h-9 rounded-xl border text-xs font-semibold tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      active
                        ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300'
                        : 'border-border/70 text-muted-foreground hover:border-teal-500/40',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Habit tampil di tanggal terpilih tiap bulan — bulan tanpa
              tanggal tsb. (mis. tgl 31 di bulan pendek) otomatis
              dilewati. Pilih minimal satu tanggal.
            </p>
          </div>
        )}
      </div>
      {/* Task 36: Target Lulus — garis finis habit. Orang yang senang */}
      {/* memulai tapi susah menyelesaikan butuh ENDING yang bisa */}
      {/* dirayakan; tanpa ini semua habit berjalan selamanya dan */}
      {/* tidak pernah "selesai". Habit 'avoid' tidak punya target */}
      {/* lulus (hari tanpa log = bersih, bukan progres). */}
      {form.habitType !== 'avoid' && (
        <div className="space-y-2">
          <Label>Target Lulus 🎓</Label>
          <Select
            value={form.targetDays === null || form.targetDays === undefined ? '__none__' : String(form.targetDays)}
            onValueChange={(v) => updateForm('targetDays', v === '__none__' ? null : Number(v))}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_DAYS_OPTIONS.map((o) => (
                <SelectItem key={o.value === null ? 'none' : String(o.value)} value={o.value === null ? '__none__' : String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Setelah jumlah hari selesai mencapai target, kartu habit
            menawarkan tombol <span className="font-semibold">Lulus</span> —
            perayaan wisuda + habit keluar dari rutinitas harian. Tanpa
            target = habit selamanya.
          </p>
        </div>
      )}
    </>
  );
}
