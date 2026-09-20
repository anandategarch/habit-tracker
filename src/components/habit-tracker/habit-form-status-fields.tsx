'use client';

// components/habit-tracker/habit-form-status-fields.tsx — bagian form habit:
// pengingat + status, tanggal mulai, Track Waktu, Mode Liburan (PHASE1-HABIT),
// dan catatan. (Pemecahan habit-master.tsx, Task 71-b — markup dipindah apa
// adanya.)

import { Clock, Palmtree } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { jakartaDateString } from '@/lib/jakarta-date';
import { STATUSES } from './habit-master-types';
import type { HabitFormSession } from './use-habit-master-form';

export interface HabitFormStatusFieldsProps {
  session: HabitFormSession;
}

export function HabitFormStatusFields({
  session,
}: HabitFormStatusFieldsProps) {
  const { form, updateForm } = session;

  return (
    <>
      {/* Row: Reminder + Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pengingat</Label>
          <Input
            placeholder="misal 08:00"
            value={form.reminder ?? ''}
            onChange={(e) => updateForm('reminder', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v) => updateForm('status', v as 'active' | 'paused')}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'active' ? 'Aktif' : 'Dijeda'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row: Start Date (schema tidak punya endDate) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="habit-start">Tanggal Mulai</Label>
          <Input
            id="habit-start"
            type="date"
            value={form.startDate}
            onChange={(e) => updateForm('startDate', e.target.value)}
            className="rounded-xl"
          />
        </div>
      </div>

      {/* Track Time */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="track-time" className="cursor-pointer">Track Waktu</Label>
          </div>
          <Switch
            id="track-time"
            checked={form.trackTime}
            onCheckedChange={(v) => updateForm('trackTime', v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Catat waktu saat habit dicentang. Cocok untuk bangun pagi, olahraga, dll.
        </p>
      </div>

      {/* PHASE1-HABIT: Vacation Mode */}
      <div className="rounded-xl border p-4 space-y-3 bg-sky-50/40 dark:bg-sky-950/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palmtree className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <Label htmlFor="vacation-mode" className="cursor-pointer">
              Mode Liburan
            </Label>
          </div>
          <Switch
            id="vacation-mode"
            checked={form.vacationMode}
            onCheckedChange={(v) => updateForm('vacationMode', v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Jeda habit tanpa memutus streak. Habit tidak dihitung sebagai
          &ldquo;belum selesai&rdquo; selama liburan. Streak dipertahankan
          dan akan menyala kembali otomatis setelah tanggal berakhir.
        </p>
        {form.vacationMode && (
          <div className="space-y-2 pt-1">
            <Label htmlFor="vacation-end">
              Berakhir Pada{' '}
              <span className="text-muted-foreground text-xs">
                (opsional — kosongkan untuk liburan tanpa batas)
              </span>
            </Label>
            <Input
              id="vacation-end"
              type="date"
              value={form.vacationEnd ?? ''}
              onChange={(e) => updateForm('vacationEnd', e.target.value)}
              min={jakartaDateString()}
              className="w-48 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Setelah tanggal ini, mode liburan otomatis nonaktif dan habit
              kembali ditrack normal.
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Catatan</Label>
        <Textarea
          placeholder="Catatan tambahan tentang habit ini..."
          value={form.notes ?? ''}
          onChange={(e) => updateForm('notes', e.target.value)}
          rows={3}
          className="rounded-xl"
        />
      </div>
    </>
  );
}
