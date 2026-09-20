'use client';

// components/habit-tracker/finance-tx-dialog.tsx — dialog tambah/edit transaksi
// (SPLIT-PHASE2-UI: state & handler ada di use-finance-mutations; komponen ini
// root komposisi — seksi field ada di finance-tx-dialog-fields.tsx, kalkulator
// di finance-tx-dialog-calculator.tsx, key baris split di
// finance-tx-dialog-split-keys.ts; Task 71-i).
//
// Fitur:
// - Tipe expense/income (premium-segment) + kategori Select per tipe.
// - Nominal input formatNominalInput + kalkulator kecil (calcOpen).
// - Mode Split (hanya tambah): ≥2 baris kategori + nominal, total real-time.
// - FIX-6 (6-b): draft tagInput di-reset saat dialog ditutup (wrapper
//   onOpenChange — event handler, bukan effect).

import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNominalInput, amountFromInput } from './finance-types';
import type { TxFormState, SplitRow, Transaction } from './finance-types';
import { cn } from '@/lib/utils';
import { CalculatorDialog } from './finance-tx-dialog-calculator';
import { useSplitKeys } from './finance-tx-dialog-split-keys';
import {
  SplitModeToggle,
  SplitRowsEditor,
  TxAmountField,
  TxCategoryField,
  TxDateTimeFields,
  TxDescriptionField,
  TxNotesField,
  TxSourceField,
  TxTagsField,
  TxTypeSegment,
} from './finance-tx-dialog-fields';

interface FinanceTxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTx: Transaction | null;
  txForm: TxFormState;
  setTxForm: React.Dispatch<React.SetStateAction<TxFormState>>;
  splitMode: boolean;
  setSplitMode: (mode: boolean) => void;
  splitRows: SplitRow[];
  // NOTE: diterima demi kontrak pemanggil (finance.tsx); mutasi baris split
  // dilakukan lewat addSplitRow/updateSplitRow/removeSplitRow.
  setSplitRows: React.Dispatch<React.SetStateAction<SplitRow[]>>;
  splitTotal: number;
  addSplitRow: () => void;
  updateSplitRow: (idx: number, field: 'category' | 'amount', value: string) => void;
  removeSplitRow: (idx: number) => void;
  calcOpen: boolean;
  setCalcOpen: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (event?: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  getCategoryList: (type: string) => Array<{ value: string; emoji: string; color: string }>;
  getActiveSources: () => Array<{ id: string; name: string; emoji: string }>;
}

export function FinanceTxDialog({
  open,
  onOpenChange,
  editingTx,
  txForm,
  setTxForm,
  splitMode,
  setSplitMode,
  splitRows,
  splitTotal,
  addSplitRow,
  updateSplitRow,
  removeSplitRow,
  calcOpen,
  setCalcOpen,
  submitting,
  onSubmit,
  getCategoryList,
  getActiveSources,
}: FinanceTxDialogProps) {
  // FIX-6 (6-b): draft tag tidak boleh bocor ke pembukaan dialog berikutnya —
  // komponen selalu ter-mount, jadi reset dilakukan di event handler tutup.
  const [tagInput, setTagInput] = useState('');

  const { splitKeys, handleAddSplitRow, handleRemoveSplitRow } = useSplitKeys(
    splitRows,
    addSplitRow,
    removeSplitRow
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) setTagInput('');
    onOpenChange(next);
  };

  const isExpense = txForm.type === 'expense';
  const categories = getCategoryList(txForm.type === 'income' ? 'income' : 'expense');
  const sources = getActiveSources();
  const expenseCategories = getCategoryList('expense');

  const setField = <K extends keyof TxFormState>(key: K, value: TxFormState[K]) => {
    setTxForm(prev => ({ ...prev, [key]: value }));
  };

  const switchType = (type: 'expense' | 'income') => {
    if (txForm.type === type) return;
    setTxForm(prev => ({ ...prev, type, category: '' }));
  };

  const handleAmountChange = (raw: string) => {
    setField('amount', formatNominalInput(raw.replace(/[^\d]/g, '')));
  };

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (!tag) return;
    setTagInput('');
    setTxForm(prev => {
      if (prev.tags.some(t => t.toLowerCase() === tag.toLowerCase())) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
  };

  const removeTag = (idx: number) => {
    setTxForm(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={cn('chip-icon h-7 w-7', isExpense ? 'chip-rose' : 'chip-emerald')}
                aria-hidden="true"
              >
                {isExpense ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
              </span>
              {editingTx ? 'Edit Transaksi' : 'Transaksi Baru'}
            </DialogTitle>
            <DialogDescription>
              {editingTx
                ? 'Perubahan tersimpan sebagai pembaruan transaksi.'
                : 'Catat pemasukan atau pengeluaran pada tanggal Jakarta.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Tipe */}
            <TxTypeSegment isExpense={isExpense} onSwitchType={switchType} />

            {/* Nominal + kalkulator */}
            {!splitMode && (
              <TxAmountField
                value={txForm.amount}
                onValueChange={handleAmountChange}
                disabled={submitting}
                onOpenCalculator={() => setCalcOpen(true)}
              />
            )}

            {/* Mode split (hanya tambah) */}
            {!editingTx && (
              <SplitModeToggle
                active={splitMode}
                onToggle={() => setSplitMode(!splitMode)}
                disabled={submitting}
              />
            )}

            {splitMode && (
              <SplitRowsEditor
                splitRows={splitRows}
                splitKeys={splitKeys}
                expenseCategories={expenseCategories}
                splitTotal={splitTotal}
                isExpense={isExpense}
                submitting={submitting}
                onUpdateRow={updateSplitRow}
                onRemoveRow={handleRemoveSplitRow}
                onAddRow={handleAddSplitRow}
              />
            )}

            {/* Kategori (mode tunggal) */}
            {!splitMode && (
              <TxCategoryField
                value={txForm.category}
                onValueChange={(v) => setField('category', v)}
                categories={categories}
              />
            )}

            {/* Sumber */}
            <TxSourceField
              value={txForm.source}
              onValueChange={(v) => setField('source', v)}
              sources={sources}
            />

            {/* Tanggal + waktu */}
            <TxDateTimeFields
              date={txForm.date}
              time={txForm.time}
              onFieldChange={(field, value) => setField(field, value)}
              disabled={submitting}
            />

            {/* Deskripsi */}
            <TxDescriptionField
              value={txForm.description}
              onValueChange={(v) => setField('description', v)}
              disabled={submitting}
            />

            {/* Catatan */}
            <TxNotesField
              value={txForm.notes}
              onValueChange={(v) => setField('notes', v)}
              disabled={submitting}
            />

            {/* Tags chip input */}
            <TxTagsField
              tags={txForm.tags}
              draftValue={tagInput}
              onDraftChange={setTagInput}
              onAdd={addTag}
              onRemove={removeTag}
              disabled={submitting}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button
              className={cn('btn-primary-gradient', isExpense && 'bg-destructive hover:bg-destructive')}
              onClick={(e) => { void onSubmit(e); }}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : editingTx ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CalculatorDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        initialValue={amountFromInput(txForm.amount)}
        onApply={(result) => setField('amount', formatNominalInput(String(result)))}
      />
    </>
  );
}
