'use client';

// components/habit-tracker/finance-tx-dialog.tsx — dialog tambah/edit transaksi
// (SPLIT-PHASE2-UI: state & handler ada di use-finance-mutations; komponen ini
// murni presentasional).
//
// Fitur:
// - Tipe expense/income (premium-segment) + kategori Select per tipe.
// - Nominal input formatNominalInput + kalkulator kecil (calcOpen).
// - Sumber Select, tanggal (yyyy-MM-dd) + waktu sederhana (input type="time").
// - Deskripsi, catatan, tags chip input.
// - Mode Split (hanya tambah): ≥2 baris kategori + nominal, total real-time.
// - FIX-6 (6-b): draft tagInput di-reset saat dialog ditutup (wrapper
//   onOpenChange — event handler, bukan effect).

import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Calculator, Trash2, Plus, X, Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import type { TxFormState, SplitRow, Transaction } from './finance-types';
import { cn } from '@/lib/utils';

// Task 61-f (audit 61-a P3): penghasil key stabil baris split — counter uid
// modul (unik sepanjang sesi, tanpa dependency baru).
let splitRowUid = 0;

interface FinanceTxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTx: Transaction | null;
  txForm: TxFormState;
  setTxForm: React.Dispatch<React.SetStateAction<TxFormState>>;
  splitMode: boolean;
  setSplitMode: (mode: boolean) => void;
  splitRows: SplitRow[];
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

  // Task 61-f (audit 61-a P3): key stabil baris split. splitRows dimiliki
  // parent (use-finance-mutations) tanpa id — dialog memelihara daftar key
  // paralel: tambah/hapus lewat wrapper lokal (idx persis), perubahan panjang
  // eksternal (reset saat dialog dibuka ulang) disinkronkan lewat pola
  // adjust-state-during-render (pola prevOpen CalculatorDialog di bawah).
  const [splitKeys, setSplitKeys] = useState<string[]>(() =>
    splitRows.map(() => `split-${++splitRowUid}`)
  );
  const [prevSplitCount, setPrevSplitCount] = useState(splitRows.length);
  if (splitRows.length !== prevSplitCount) {
    setPrevSplitCount(splitRows.length);
    setSplitKeys((prev) => {
      if (splitRows.length >= prev.length) {
        return [
          ...prev,
          ...Array.from({ length: splitRows.length - prev.length }, () => `split-${++splitRowUid}`),
        ];
      }
      return prev.slice(0, splitRows.length);
    });
  }

  const handleAddSplitRow = () => {
    setSplitKeys((prev) => [...prev, `split-${++splitRowUid}`]);
    addSplitRow();
  };

  const handleRemoveSplitRow = (idx: number) => {
    setSplitKeys((prev) => prev.filter((_, i) => i !== idx));
    removeSplitRow(idx);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setTagInput('');
    onOpenChange(next);
  };

  const isExpense = txForm.type === 'expense';
  const categories = getCategoryList(txForm.type === 'income' ? 'income' : 'expense');
  const sources = getActiveSources();

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
            <div className="premium-segment w-full" role="group" aria-label="Tipe transaksi">
              <button
                type="button"
                className="premium-segment-item flex-1 h-9 cursor-pointer"
                data-active={isExpense ? 'true' : 'false'}
                aria-pressed={isExpense}
                onClick={() => switchType('expense')}
              >
                ↓ Pengeluaran
              </button>
              <button
                type="button"
                className="premium-segment-item flex-1 h-9 cursor-pointer"
                data-active={!isExpense ? 'true' : 'false'}
                aria-pressed={!isExpense}
                onClick={() => switchType('income')}
              >
                ↑ Pemasukan
              </button>
            </div>

            {/* Nominal + kalkulator */}
            {!splitMode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tx-amount">Jumlah</Label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    onClick={() => setCalcOpen(true)}
                    aria-label="Buka kalkulator nominal"
                  >
                    <Calculator className="h-3 w-3" /> Kalkulator
                  </button>
                </div>
                <Input
                  id="tx-amount"
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={txForm.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={submitting}
                  className="h-10 text-base font-semibold tabular-nums"
                />
              </div>
            )}

            {/* Mode split (hanya tambah) */}
            {!editingTx && (
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Split className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">Pecah ke beberapa kategori</p>
                    <p className="text-[11px] text-muted-foreground">
                      1 transaksi dibagi jadi ≥2 kategori sekaligus
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={splitMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={() => setSplitMode(!splitMode)}
                  aria-pressed={splitMode}
                  disabled={submitting}
                >
                  {splitMode ? 'Aktif' : 'Nonaktif'}
                </Button>
              </div>
            )}

            {splitMode && (
              <div className="space-y-2">
                {splitRows.map((row, idx) => (
                  <div key={splitKeys[idx] ?? `split-fallback-${idx}`} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Select
                        value={row.category}
                        onValueChange={(v) => updateSplitRow(idx, 'category', v)}
                      >
                        <SelectTrigger className="h-9" aria-label={`Kategori baris split ${idx + 1}`}>
                          <SelectValue placeholder="Kategori" />
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
                    <div className="w-36 shrink-0">
                      <Input
                        inputMode="numeric"
                        placeholder="Rp 0"
                        value={row.amount}
                        onChange={(e) =>
                          updateSplitRow(idx, 'amount', e.target.value.replace(/[^\d]/g, ''))
                        }
                        className="h-9 tabular-nums"
                        disabled={submitting}
                        aria-label={`Nominal baris split ${idx + 1}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveSplitRow(idx)}
                      disabled={submitting || splitRows.length <= 2}
                      aria-label={`Hapus baris split ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleAddSplitRow}
                    disabled={submitting || splitRows.length >= 10}
                  >
                    <Plus className="h-3 w-3" /> Tambah baris
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Total split:{' '}
                    <span className={cn('font-semibold tabular-nums', isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {formatRupiah(splitTotal)}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Kategori (mode tunggal) */}
            {!splitMode && (
              <div className="space-y-1.5">
                <Label htmlFor="tx-category">Kategori</Label>
                <Select value={txForm.category} onValueChange={(v) => setField('category', v)}>
                  <SelectTrigger id="tx-category" className="h-9">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {categories.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.emoji} {c.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sumber */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-source">Sumber Dana</Label>
              <Select value={txForm.source} onValueChange={(v) => setField('source', v)}>
                <SelectTrigger id="tx-source" className="h-9">
                  <SelectValue placeholder="Pilih sumber" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(s => (
                    <SelectItem key={s.id || s.name} value={s.name}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tanggal + waktu */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tx-date">Tanggal</Label>
                <Input
                  id="tx-date"
                  type="date"
                  value={txForm.date}
                  onChange={(e) => setField('date', e.target.value)}
                  disabled={submitting}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tx-time">Waktu (WIB)</Label>
                <Input
                  id="tx-time"
                  type="time"
                  value={txForm.time}
                  onChange={(e) => setField('time', e.target.value)}
                  disabled={submitting}
                  className="h-9"
                />
              </div>
            </div>

            {/* Deskripsi */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc">Deskripsi</Label>
              <Input
                id="tx-desc"
                placeholder="mis. Makan siang warteg"
                value={txForm.description}
                onChange={(e) => setField('description', e.target.value)}
                disabled={submitting}
                className="h-9"
              />
            </div>

            {/* Catatan */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-notes">Catatan (opsional)</Label>
              <Textarea
                id="tx-notes"
                placeholder="Detail tambahan…"
                value={txForm.notes}
                onChange={(e) => setField('notes', e.target.value)}
                disabled={submitting}
                className="min-h-16 text-sm"
                rows={2}
              />
            </div>

            {/* Tags chip input */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-tag">Tag (opsional)</Label>
              <div className="flex gap-2">
                <Input
                  id="tx-tag"
                  placeholder="mis. rutin lalu Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  disabled={submitting}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={addTag}
                  disabled={submitting || !tagInput.trim()}
                  aria-label="Tambah tag"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {txForm.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {txForm.tags.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground border border-border/60"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(i)}
                        className="hover:text-destructive transition-colors"
                        aria-label={`Hapus tag ${tag}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
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

// ── Kalkulator kecil ──────────────────────────────────────────────────────

function CalculatorDialog({
  open,
  onOpenChange,
  initialValue,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: number;
  onApply: (result: number) => void;
}) {
  const [display, setDisplay] = useState('');

  // Task 31 (bug temuan uji): prefill saat dialog DIBUKA. Dulu lewat
  // handleOpenChange(next=true) — hanya jalan saat Radix yang membuka; tombol
  // "Kalkulator" memanggil setCalcOpen(true) langsung → display lama menumpuk
  // dengan ketikan baru saat dibuka ulang. Pola "adjust state during render"
  // (React docs: You Might Not Need an Effect) — BUKAN useEffect supaya lolos
  // react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDisplay(initialValue > 0 ? String(initialValue) : '');
  }

  const press = (key: string) => {
    if (key === 'C') {
      setDisplay('');
      return;
    }
    if (key === '⌫') {
      setDisplay(prev => prev.slice(0, -1));
      return;
    }
    setDisplay(prev => {
      // Task 31: operator berturut-turut → operator baru MENGGANTI yang lama
      // (mis. "5+" lalu tekan × → "5×"), bukan menumpuk jadi ekspresi rusak.
      const isOp = (ch: string) => ['+', '-', '×', '÷'].includes(ch);
      if (isOp(key)) {
        if (prev.length === 0) return prev; // tidak boleh diawali operator
        if (isOp(prev[prev.length - 1])) return (prev.slice(0, -1) + key).slice(0, 24);
      }
      return (prev + key).slice(0, 24);
    });
  };

  // Task 31 (permintaan user): dukung × dan ÷ dengan URUTAN OPERASI benar
  // (× ÷ dikerjakan sebelum + −, seperti kalkulator pada umumnya).
  const evaluate = (): number | null => {
    const tokens = display.match(/(\d+(\.\d+)?|[+\-×÷])/g);
    if (!tokens || tokens.length === 0) return null;
    const first = Number(tokens[0]);
    if (!Number.isFinite(first)) return null;

    // Pass 1: lipat × dan ÷ ke angka di kirinya (precedence tinggi).
    const folded: Array<number | string> = [first];
    for (let i = 1; i + 1 < tokens.length + 1; i += 2) {
      const op = tokens[i];
      const num = Number(tokens[i + 1]);
      if (op === undefined || num === undefined || !Number.isFinite(num)) return null;
      if (op === '×') {
        const prevNum = folded[folded.length - 1];
        if (typeof prevNum !== 'number') return null;
        folded[folded.length - 1] = prevNum * num;
      } else if (op === '÷') {
        const prevNum = folded[folded.length - 1];
        if (typeof prevNum !== 'number' || num === 0) return null; // ÷0 = invalid
        folded[folded.length - 1] = prevNum / num;
      } else if (op === '+' || op === '-') {
        folded.push(op, num);
      } else {
        return null;
      }
    }

    // Pass 2: lipat + dan −.
    let acc = folded[0];
    if (typeof acc !== 'number') return null;
    for (let j = 1; j < folded.length; j += 2) {
      const op = folded[j];
      const num = folded[j + 1];
      if (typeof op !== 'string' || typeof num !== 'number') return null;
      if (op === '+') acc += num;
      else if (op === '-') acc -= num;
      else return null;
    }
    if (!Number.isFinite(acc)) return null;
    return Math.max(0, Math.round(acc));
  };

  const apply = () => {
    const result = evaluate();
    if (result === null) return;
    onApply(result);
    onOpenChange(false);
  };

  // Task 31: layout kalkulator standar 4 kolom — kini ada × dan ÷.
  // Catatan: tombol kurang memakai ASCII '-' agar token regex evaluate cocok.
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '⌫', 'C', '+'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="chip-icon chip-teal h-6 w-6" aria-hidden="true">
              <Calculator className="h-3 w-3" />
            </span>
            Kalkulator Nominal
          </DialogTitle>
          <DialogDescription>Hitung (tambah, kurang, kali, bagi), lalu terapkan ke kolom jumlah.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-right text-lg font-bold tabular-nums truncate">
          {display || '0'}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {keys.map(k => (
            <Button
              key={k}
              variant="outline"
              className={cn('h-10', ['÷', '×', '+', '-'].includes(k) && 'text-primary font-bold')}
              onClick={() => press(k)}
              aria-label={
                k === '⌫' ? 'Hapus satu digit'
                  : k === 'C' ? 'Bersihkan'
                    : k === '÷' ? 'Bagi'
                      : k === '×' ? 'Kali'
                        : k === '+' ? 'Tambah'
                          : k === '-' ? 'Kurang'
                            : k
              }
            >
              {k}
            </Button>
          ))}
          <Button className="h-10 btn-primary-gradient col-span-4" onClick={apply} disabled={!display} aria-label="Terapkan hasil">
            =
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
