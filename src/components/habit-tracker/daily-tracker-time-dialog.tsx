'use client';

// components/habit-tracker/daily-tracker-time-dialog.tsx — dialog konfirmasi
// waktu "Sekarang / manual" untuk habit trackTime.
//
// Task 38 (split god file): DIEKSTRAKSI dari daily-tracker.tsx — JSX identik.
// State (habit, tanggal, jam, submitting) + handler submit tetap di parent
// (mereka memanggil toggleHabit dengan dateOverride M2).

import { Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TimePicker } from '@/components/habit-tracker/time-picker';
import { jakartaDateString } from '@/lib/jakarta-date';
import type { Habit } from './daily-tracker-types';

export interface TimeConfirmDialogProps {
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manualDate: string;
  onManualDateChange: (date: string) => void;
  manualTime: string;
  onManualTimeChange: (time: string) => void;
  submitting: boolean;
  /** Jalur "Sekarang" — completedAt = jakartaNowIso(). */
  onNow: () => void;
  /** Jalur manual — completedAt dari manualDate + manualTime (+07:00). */
  onManual: () => void;
}

export function TimeConfirmDialog({
  habit,
  open,
  onOpenChange,
  manualDate,
  onManualDateChange,
  manualTime,
  onManualTimeChange,
  submitting,
  onNow,
  onManual,
}: TimeConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{habit?.emoji}</span>
            {habit?.name}
          </DialogTitle>
          {/* LOW-(a): DialogDescription supaya dialog punya deskripsi
              ter-taut (aria-describedby) — radix tidak lagi memperingatkan
              "Description missing" di konsol. */}
          <DialogDescription>
            Catat kapan habit ini dilakukan
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">

          <button
            type="button"
            onClick={onNow}
            disabled={submitting}
            className="w-full flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-left hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Sekarang</p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleTimeString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </button>

          <div className="relative flex items-center justify-center">
            <span className="text-xs text-muted-foreground bg-background px-2 z-10">
              atau isi manual
            </span>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Tanggal
                </label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => onManualDateChange(e.target.value)}
                  max={jakartaDateString()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Jam
                </label>
                <TimePicker
                  value={manualTime}
                  onChange={(v) => onManualTimeChange(v)}
                />
              </div>
            </div>
            <Button
              onClick={onManual}
              disabled={submitting || !manualTime || !manualDate}
              className="w-full"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Waktu'}
            </Button>
          </div>

          {habit?.reminder && (
            <p className="text-xs text-center text-muted-foreground">
              Pengingat: {habit.reminder}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
