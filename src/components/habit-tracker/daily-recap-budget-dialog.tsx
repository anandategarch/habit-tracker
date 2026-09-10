'use client';

// components/habit-tracker/daily-recap-budget-dialog.tsx — dialog atur/ubah
// budget harian (PUT /api/settings { dailyBudgetTarget }). Dari partial
// finance-overview lama — perilaku dipertahankan: prefill terformat ribuan,
// hapus non-digit saat parse, Enter = simpan, tombol Hapus saat sudah ada.

import { useEffect } from 'react';
import { Target } from 'lucide-react';
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

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetInput: string;
  setBudgetInput: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
  isPending: boolean;
  hasExistingBudget: boolean;
}

export function BudgetDialog({
  open,
  onOpenChange,
  budgetInput,
  setBudgetInput,
  onSave,
  onRemove,
  isPending,
  hasExistingBudget,
}: BudgetDialogProps) {
  // Format live "100.000" saat mengetik (hanya digit).
  const handleAmountChange = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) {
      setBudgetInput('');
      return;
    }
    setBudgetInput(digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  };

  // Enter pada input = simpan (guard double-submit di onSave milik pemanggil).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isPending) onSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, isPending, onSave]);

  const handleOpenChange = (next: boolean) => {
    if (isPending) return; // dialog tak bisa ditutup saat penyimpanan berjalan
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="chip-icon chip-amber h-7 w-7" aria-hidden="true">
              <Target className="h-3.5 w-3.5" />
            </span>
            Budget Harian
          </DialogTitle>
          <DialogDescription>
            Target pengeluaran maksimal per hari. Ring progres akan tampil di kartu rekap.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="daily-budget-input">Target per hari</Label>
          <Input
            id="daily-budget-input"
            inputMode="numeric"
            placeholder="mis. 100.000"
            value={budgetInput}
            onChange={(e) => handleAmountChange(e.target.value)}
            disabled={isPending}
            className="h-9 tabular-nums"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Maksimal Rp 100.000.000. Kosongkan lalu Hapus untuk menonaktifkan.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          {hasExistingBudget ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8"
              onClick={onRemove}
              disabled={isPending}
            >
              Hapus
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Batal
            </Button>
            <Button className="btn-primary-gradient" onClick={onSave} disabled={isPending}>
              {isPending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
