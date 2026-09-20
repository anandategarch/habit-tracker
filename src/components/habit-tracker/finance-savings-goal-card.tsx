'use client';

// components/habit-tracker/finance-savings-goal-card.tsx — kartu target
// tabungan (diekstrak verbatim dari finance-savings-goals.tsx, Task 71-i):
// emoji + nama + Progress (premium-progress-fill) + nominal current/target +
// deadline (dibaca via komponen YMD — konvensi tengah malam Jakarta) +
// quick-chips 1-tap (+Rp50rb / +Rp100rb / Sisa → PUT delta di root).
// Quick-chips DISEMBUNYIKAN untuk goal yang sudah 100%.

import {
  CalendarDays,
  CheckCircle2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { jakartaDateKey } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { CSSProperties, MouseEvent } from 'react';
import type { SavingsGoal } from './finance-types';
import { formatRupiah } from './finance-types';
import {
  QUICK_CHIPS,
  formatYMD,
  goalPct,
  isComplete,
} from './finance-savings-helpers';

export interface SavingsGoalCardProps {
  goal: SavingsGoal;
  idx: number;
  pending: boolean;
  onQuickChip: (goal: SavingsGoal, delta: number, e: MouseEvent<HTMLButtonElement>) => void;
  onEdit: (goal: SavingsGoal) => void;
  onDelete: (id: string) => void;
}

export function SavingsGoalCard({ goal, idx, pending, onQuickChip, onEdit, onDelete }: SavingsGoalCardProps) {
  const pct = goalPct(goal);
  const complete = isComplete(goal);
  const remaining = Math.max(0, (goal.targetAmount ?? 0) - (goal.currentAmount ?? 0));
  const deadlineYMD = goal.deadline ? jakartaDateKey(new Date(goal.deadline)) : null;
  return (
    <div
      className="premium-card premium-card-sheen premium-card-hover rounded-2xl p-4 anim-stagger"
      style={{ '--stagger': idx } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="h-11 w-11 rounded-2xl grid place-items-center text-xl shrink-0 ring-1 ring-black/5 dark:ring-white/10 bg-primary/10"
            aria-hidden="true"
          >
            {goal.emoji ?? '🎯'}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{goal.name}</p>
            {complete ? (
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Tercapai 🎉
              </p>
            ) : deadlineYMD ? (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                Target {formatYMD(deadlineYMD)}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Tanpa tenggat</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(goal)}
            aria-label={`Edit target tabungan ${goal.name}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(goal.id)}
            aria-label={`Hapus target tabungan ${goal.name}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Progress
          value={pct}
          className={cn('h-2.5 flex-1', complete && '[&_[data-slot=progress-indicator]]:bg-emerald-500')}
        />
        <span className="text-[11px] font-semibold tabular-nums shrink-0">{pct}%</span>
      </div>

      <div className="mt-2.5">
        <p className="text-sm font-bold tabular-nums">
          {formatRupiah(goal.currentAmount ?? 0)}
          <span className="text-xs font-medium text-muted-foreground">
            {' '}/ {formatRupiah(goal.targetAmount ?? 0)}
          </span>
        </p>
        {!complete && remaining > 0 && (
          <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
            Sisa {formatRupiah(remaining)} lagi
          </p>
        )}
      </div>

      {/* Quick-chips 1-tap — disembunyikan untuk goal 100% */}
      {!complete && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="chip-soft chip-soft-teal text-[11px] font-semibold px-2.5 py-1 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed anim-press"
              onClick={(e) => { void onQuickChip(goal, chip.delta, e); }}
              disabled={pending}
              aria-label={`Tambah ${chip.label} ke ${goal.name}`}
            >
              {chip.label}
            </button>
          ))}
          {remaining > 0 && (
            <button
              type="button"
              className="chip-soft chip-soft-violet text-[11px] font-semibold px-2.5 py-1 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed anim-press"
              onClick={(e) => { void onQuickChip(goal, remaining, e); }}
              disabled={pending}
              aria-label={`Lunasi sisa ${formatRupiah(remaining)} target ${goal.name}`}
            >
              Sisa ({formatRupiah(remaining)})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
