'use client';

// components/habit-tracker/finance-savings-form-dialog.tsx — dialog
// tambah/edit target tabungan (diekstrak verbatim dari
// finance-savings-goals.tsx, Task 71-i): nama, emoji pilihan, target,
// saldo sekarang, tenggat opsional.

import { CalendarDays, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNominalInput } from './finance-types';
import { cn } from '@/lib/utils';
import type { MouseEvent } from 'react';
import { GOAL_EMOJI_CHOICES, type GoalFormState } from './finance-savings-helpers';

export interface SavingsGoalFormDialogProps {
  open: boolean;
  form: GoalFormState;
  setForm: React.Dispatch<React.SetStateAction<GoalFormState>>;
  submitting: boolean;
  onOpenChange: (next: boolean) => void;
  onSubmit: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}

export function SavingsGoalFormDialog({
  open,
  form,
  setForm,
  submitting,
  onOpenChange,
  onSubmit,
}: SavingsGoalFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn('chip-icon h-7 w-7', form.id ? 'chip-amber' : 'chip-lime')}
              aria-hidden="true"
            >
              <PiggyBank className="h-3.5 w-3.5" />
            </span>
            {form.id ? 'Edit Target Tabungan' : 'Target Tabungan Baru'}
          </DialogTitle>
          <DialogDescription>
            Tetapkan nominal target, saldo sekarang, dan tenggat opsional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Nama Target</Label>
            <Input
              id="goal-name"
              placeholder="mis. Dana Darurat"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              disabled={submitting}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_EMOJI_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, emoji }))}
                  className={cn(
                    'h-9 w-9 rounded-xl grid place-items-center text-base transition-all cursor-pointer',
                    form.emoji === emoji
                      ? 'bg-primary/15 ring-2 ring-primary/50 scale-105'
                      : 'bg-muted/60 hover:bg-muted'
                  )}
                  aria-label={`Pilih emoji ${emoji}`}
                  aria-pressed={form.emoji === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target</Label>
              <Input
                id="goal-target"
                inputMode="numeric"
                placeholder="Rp 0"
                value={form.targetAmount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, targetAmount: formatNominalInput(e.target.value.replace(/[^\d]/g, '')) }))
                }
                disabled={submitting}
                className="h-9 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-current">Sudah Tersimpan</Label>
              <Input
                id="goal-current"
                inputMode="numeric"
                placeholder="Rp 0"
                value={form.currentAmount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, currentAmount: formatNominalInput(e.target.value.replace(/[^\d]/g, '')) }))
                }
                disabled={submitting}
                className="h-9 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-deadline" className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" aria-hidden="true" /> Tenggat (opsional)
            </Label>
            <Input
              id="goal-deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
              disabled={submitting}
              className="h-9"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            className="btn-primary-gradient"
            onClick={(e) => { void onSubmit(e); }}
            disabled={submitting}
          >
            {submitting ? 'Menyimpan…' : form.id ? 'Simpan Perubahan' : 'Tambah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
