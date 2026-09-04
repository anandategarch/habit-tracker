'use client';

// ── Budget Dialog (reusable) ─────────────────────────────────────────────
// Extracted from daily-recap.tsx during SPLIT-PHASE2-UI.
// Extracted so both the empty-state Card and the main Card can render it
// without duplicating the JSX. Controlled by parent via props.

import { Target, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatRupiah } from './finance-types';

export function BudgetDialog({
  open,
  onOpenChange,
  budgetInput,
  setBudgetInput,
  onSave,
  onRemove,
  isPending,
  hasExistingBudget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetInput: string;
  setBudgetInput: (v: string) => void;
  onSave: () => void;
  onRemove: () => void;
  isPending: boolean;
  hasExistingBudget: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Budget Harian
          </DialogTitle>
          <DialogDescription>
            Atur target pengeluaran per hari. Berlaku untuk semua hari.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="daily-budget-input" className="text-xs">
            Nominal (Rp)
          </Label>
          <Input
            id="daily-budget-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="100.000"
            value={budgetInput}
            onChange={(e) => {
              // Format with thousand separators as user types.
              const digits = e.target.value.replace(/[^\d]/g, '');
              if (!digits) {
                setBudgetInput('');
                return;
              }
              setBudgetInput(digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSave();
              }
            }}
            className="text-lg font-semibold tabular-nums"
            autoFocus
          />
          {budgetInput && (() => {
            const digits = budgetInput.replace(/[^\d]/g, '');
            const n = digits ? parseInt(digits, 10) : 0;
            return (
              <p className="text-xs text-muted-foreground">
                Pratinjau: <span className="font-medium text-foreground">{formatRupiah(n)}</span>
              </p>
            );
          })()}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {hasExistingBudget ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={isPending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={isPending || !budgetInput.replace(/[^\d]/g, '')}
            >
              {isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
