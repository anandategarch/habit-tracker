'use client';

// ── Add/Edit Transaction Dialog ──────────────────────────────────────────
// Extracted from finance.tsx during SPLIT-PHASE2-UI.
//
// Controlled by parent via props. Supports two modes:
//  - Regular: single amount + category + notes
//  - Split: multiple category/amount rows (expense only, create only)

import { ArrowDownRight, ArrowUpRight, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalculatorButton, CalculatorDialog } from './calculator';
import { TimePicker } from './time-picker';
import { formatNominalInput, formatRupiah, parseNominalInput, type Transaction } from './finance-types';
import type {
  TxFormState,
  SplitRow,
} from '@/hooks/use-finance-mutations';

export interface FinanceTxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTx: Transaction | null;
  txForm: TxFormState;
  setTxForm: React.Dispatch<React.SetStateAction<TxFormState>>;
  splitMode: boolean;
  setSplitMode: React.Dispatch<React.SetStateAction<boolean>>;
  splitRows: SplitRow[];
  setSplitRows: React.Dispatch<React.SetStateAction<SplitRow[]>>;
  splitTotal: number;
  addSplitRow: () => void;
  updateSplitRow: (idx: number, field: 'category' | 'amount', value: string) => void;
  removeSplitRow: (idx: number) => void;
  calcOpen: boolean;
  setCalcOpen: (open: boolean) => void;
  submitting: boolean;
  onSubmit: (event?: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
  /** Returns the category list for the given type (expense/income). */
  getCategoryList: (type: string) => Array<{ value: string; emoji: string; color: string }>;
  /** Returns the active source list for the source dropdown. */
  getActiveSources: () => Array<{ id: string; name: string; emoji: string; balance: number; order: number }>;
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
  setSplitRows,
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
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>{editingTx ? 'Edit Transaksi' : 'Tambah Transaksi'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={txForm.type === 'expense' ? 'default' : 'outline'} className={cn(txForm.type === 'expense' && 'bg-destructive hover:bg-destructive text-white')} onClick={() => setTxForm(f => ({ ...f, type: 'expense', category: '' }))} disabled={splitMode}><ArrowDownRight className="h-4 w-4" />Pengeluaran</Button>
              <Button type="button" variant={txForm.type === 'income' ? 'default' : 'outline'} onClick={() => setTxForm(f => ({ ...f, type: 'income', category: '' }))} disabled={splitMode} title={splitMode ? 'Split hanya untuk pengeluaran' : undefined}><ArrowUpRight className="h-4 w-4" />Pemasukan</Button>
            </div>

            {/* Split toggle — only shown when adding (not editing). Split
                children are standalone transactions edited individually. */}
            {!editingTx && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-muted/30">
                <div className="min-w-0">
                  <Label className="text-xs font-medium">Split ke beberapa kategori</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Pisahkan 1 pembayaran ke beberapa kategori sekaligus</p>
                </div>
                <Switch
                  checked={splitMode}
                  // BUG-7 fix: instead of forcing the type to expense when split
                  // is toggled ON (which left the type stuck as expense when
                  // toggled OFF), disable the Switch entirely while the type
                  // is income. The user must switch to expense first, then
                  // enable split — so toggling split off needs no restoration.
                  disabled={txForm.type === 'income'}
                  onCheckedChange={(checked) => {
                    setSplitMode(checked);
                    if (!checked) {
                      // BUG-6 fix: reset split rows to default when turning
                      // split off, so stale category/amount entries from a
                      // previous split session don't persist.
                      setSplitRows([{ category: '', amount: '' }, { category: '', amount: '' }]);
                    }
                  }}
                  aria-label="Aktifkan mode split transaksi"
                  title={txForm.type === 'income' ? 'Split hanya untuk pengeluaran' : undefined}
                />
              </div>
            )}

            {/* Either split rows OR single amount + category. */}
            {splitMode && !editingTx ? (
              <div className="space-y-2">
                <Label className="text-xs">Kategori & Jumlah</Label>
                {splitRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Select value={row.category} onValueChange={v => updateSplitRow(idx, 'category', v)}>
                      <SelectTrigger className="flex-1 min-w-0 h-9"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                      <SelectContent>
                        {/* BUG-8 fix: filter out categories already selected in
                            other split rows to prevent duplicate categories
                            within the same split. */}
                        {getCategoryList('expense').filter(c => !splitRows.some((r, j) => j !== idx && r.category === c.value)).map(c => (<SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={e => updateSplitRow(idx, 'amount', e.target.value)}
                      className="w-28 h-9 shrink-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeSplitRow(idx)}
                      disabled={splitRows.length <= 2}
                      title={splitRows.length <= 2 ? 'Minimal 2 kategori untuk split' : 'Hapus baris'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addSplitRow} disabled={splitRows.length >= 10}>
                    <Plus className="h-3 w-3" />Tambah kategori
                  </Button>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold">{formatRupiah(splitTotal)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Jumlah (Rp)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input type="text" inputMode="numeric" placeholder="0" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: formatNominalInput(e.target.value) }))} className="flex-1" />
                    <CalculatorButton onOpen={() => setCalcOpen(true)} />
                  </div>
                </div>
                <div><Label className="text-xs">Kategori</Label><Select value={txForm.category} onValueChange={v => setTxForm(f => ({ ...f, category: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{getCategoryList(txForm.type).map(c => (<SelectItem key={c.value} value={c.value}>{c.emoji} {c.value}</SelectItem>))}</SelectContent></Select></div>
              </>
            )}
            <div><Label className="text-xs">Sumber Dana</Label><Select value={txForm.source} onValueChange={v => setTxForm(f => ({ ...f, source: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Pilih sumber" /></SelectTrigger><SelectContent>{getActiveSources().map(s => (<SelectItem key={s.id || s.name} value={s.name}>{s.emoji} {s.name}</SelectItem>))}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-2"><div><Label className="text-xs">Tanggal</Label><Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} className="mt-1" /></div><div><Label className="text-xs">Jam</Label><TimePicker value={txForm.time} onChange={v => setTxForm(f => ({ ...f, time: v }))} className="mt-1" /></div></div>
            <div><Label className="text-xs">Deskripsi</Label><Input placeholder="Contoh: Makan siang di kantin" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} className="mt-1" /></div>
            {/* Hide notes field in split mode — each split child gets an
                auto-generated "Split i/n" note, so a manual note doesn't apply. */}
            {!(splitMode && !editingTx) && (
              <div><Label className="text-xs">Catatan (opsional)</Label><Input placeholder="Catatan tambahan..." value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} className="mt-1" /></div>
            )}
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Batal</Button><Button className="flex-1" onClick={onSubmit} disabled={submitting}>{submitting ? 'Menyimpan...' : editingTx ? 'Update' : (splitMode ? 'Simpan Split' : 'Simpan')}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Calculator Dialog ── */}
      <CalculatorDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        // BUG-3 fix: wire the calculator result to the amount field. The
        // raw numeric string (e.g. "1500000") is formatted via
        // formatNominalInput into the id-ID thousand-separated form the
        // amount Input expects.
        onApply={(value) => setTxForm(f => ({ ...f, amount: formatNominalInput(value) }))}
      />
    </>
  );
}

// Re-export so consumers don't need to import parseNominalInput separately
// if they happen to need it (used by the parent for tx filter clearing).
export { parseNominalInput };
