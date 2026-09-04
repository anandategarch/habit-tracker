'use client';

// ── Add + Edit Budget Dialogs ────────────────────────────────────────────
// Extracted from finance.tsx during SPLIT-PHASE2-UI.
// Two dialogs that share the same form state (budgetForm), each with its
// own open state. Controlled by parent via props.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNominalInput } from './finance-types';
import type { BudgetFormState } from '@/hooks/use-finance-mutations';

interface CategoryOption {
  value: string;
  emoji: string;
  color: string;
}

export interface FinanceBudgetDialogsProps {
  // ── Add Budget Dialog ──
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  // ── Edit Budget Dialog ──
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  // ── Shared form state ──
  budgetForm: BudgetFormState;
  setBudgetForm: React.Dispatch<React.SetStateAction<BudgetFormState>>;
  submitting: boolean;
  onSubmitAdd: () => Promise<void>;
  onSubmitEdit: () => Promise<void>;
  /** Returns the expense category list for the category dropdown. */
  getCategoryList: (type: string) => CategoryOption[];
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
  return (
    <>
      {/* ─── ADD BUDGET DIALOG ─── */}
      <Dialog open={addOpen} onOpenChange={onAddOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Tambah Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Kategori Pengeluaran</Label><Select value={budgetForm.category} onValueChange={v => setBudgetForm(f => ({ ...f, category: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{getCategoryList('expense').map(c => (<SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>))}</SelectContent></Select></div>
            <div><Label className="text-xs">Jumlah Budget (Rp)</Label><Input type="text" inputMode="numeric" placeholder="0" value={budgetForm.amount} onChange={e => setBudgetForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))} className="mt-1" /></div>
            <div><Label className="text-xs">Periode</Label><Select value={budgetForm.period} onValueChange={v => setBudgetForm(f => ({ ...f, period: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Bulanan</SelectItem><SelectItem value="weekly">Mingguan</SelectItem></SelectContent></Select></div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => onAddOpenChange(false)}>Batal</Button><Button className="flex-1" onClick={onSubmitAdd} disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan Budget'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── EDIT BUDGET DIALOG ─── */}
      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Budget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Kategori Pengeluaran</Label><Select value={budgetForm.category} onValueChange={v => setBudgetForm(f => ({ ...f, category: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{getCategoryList('expense').map(c => (<SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>))}</SelectContent></Select></div>
            <div><Label className="text-xs">Jumlah Budget (Rp)</Label><Input type="text" inputMode="numeric" placeholder="0" value={budgetForm.amount} onChange={e => setBudgetForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))} className="mt-1" /></div>
            <div><Label className="text-xs">Periode</Label><Select value={budgetForm.period} onValueChange={v => setBudgetForm(f => ({ ...f, period: v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Bulanan</SelectItem><SelectItem value="weekly">Mingguan</SelectItem></SelectContent></Select></div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => onEditOpenChange(false)}>Batal</Button><Button className="flex-1" onClick={onSubmitEdit} disabled={submitting}>{submitting ? 'Menyimpan...' : 'Perbarui Budget'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
