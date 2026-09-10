'use client';

// components/habit-tracker/finance-budget-dialogs.tsx — dialog tambah + edit
// budget (state & handler ada di use-finance-mutations). Nominal input live
// formatNominalInput.
//
// M8: opsi Periode (Bulanan/Mingguan) DIHAPUS dari form — schema WeeklyBudget
// tidak punya kolom period (budget selalu bulanan per month yyyy-MM);
// segmented control lama menjanjikan sesuatu yang tidak pernah disimpan.

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRupiah, formatNominalInput, amountFromInput } from './finance-types';
import type { BudgetFormState } from './finance-types';

interface FinanceBudgetDialogsProps {
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  budgetForm: BudgetFormState;
  setBudgetForm: React.Dispatch<React.SetStateAction<BudgetFormState>>;
  submitting: boolean;
  onSubmitAdd: () => void | Promise<void>;
  onSubmitEdit: () => void | Promise<void>;
  getCategoryList: (type: string) => Array<{ value: string; emoji: string; color: string }>;
}

function BudgetFormFields({
  budgetForm,
  setBudgetForm,
  submitting,
  getCategoryList,
}: {
  budgetForm: BudgetFormState;
  setBudgetForm: React.Dispatch<React.SetStateAction<BudgetFormState>>;
  submitting: boolean;
  getCategoryList: (type: string) => Array<{ value: string; emoji: string; color: string }>;
}) {
  const amount = amountFromInput(budgetForm.amount);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="budget-category">Kategori Pengeluaran</Label>
        <Select
          value={budgetForm.category}
          onValueChange={(v) => setBudgetForm(prev => ({ ...prev, category: v }))}
        >
          <SelectTrigger id="budget-category" className="h-9">
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            {getCategoryList('expense').map(c => (
              <SelectItem key={c.value} value={c.value}>
                {c.emoji} {c.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="budget-amount">Jumlah per Bulan</Label>
        <Input
          id="budget-amount"
          inputMode="numeric"
          placeholder="Rp 0"
          value={budgetForm.amount}
          onChange={(e) =>
            setBudgetForm(prev => ({
              ...prev,
              amount: formatNominalInput(e.target.value.replace(/[^\d]/g, '')),
            }))
          }
          disabled={submitting}
          className="h-9 tabular-nums"
        />
        {amount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Pra-tinjau: <span className="font-semibold tabular-nums">{formatRupiah(amount)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function FinanceBudgetDialogs({
  addOpen,
  onAddOpenChange,
  editOpen,
  onEditOpenChange,
  budgetForm,
  setBudgetForm,
  submitting,
  onSubmitAdd,
  onSubmitEdit,
  getCategoryList,
}: FinanceBudgetDialogsProps) {
  const shared = { budgetForm, setBudgetForm, submitting, getCategoryList };

  return (
    <>
      <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="chip-icon chip-teal h-7 w-7" aria-hidden="true">
                <Target className="h-3.5 w-3.5" />
              </span>
              Tambah Budget
            </DialogTitle>
            <DialogDescription>
              Batas belanja bulanan per kategori — dipantau lewat progress di tab Budget.
            </DialogDescription>
          </DialogHeader>
          <BudgetFormFields {...shared} />
          <DialogFooter>
            <Button variant="outline" onClick={() => onAddOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button className="btn-primary-gradient" onClick={() => { void onSubmitAdd(); }} disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="chip-icon chip-amber h-7 w-7" aria-hidden="true">
                <Target className="h-3.5 w-3.5" />
              </span>
              Edit Budget
            </DialogTitle>
            <DialogDescription>
              Perbarui kategori atau nominal budget bulanan ini.
            </DialogDescription>
          </DialogHeader>
          <BudgetFormFields {...shared} />
          <DialogFooter>
            <Button variant="outline" onClick={() => onEditOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button className="btn-primary-gradient" onClick={() => { void onSubmitEdit(); }} disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
