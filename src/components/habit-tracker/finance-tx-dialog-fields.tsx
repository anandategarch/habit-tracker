'use client';

// components/habit-tracker/finance-tx-dialog-fields.tsx — seksi field form
// transaksi (diekstrak verbatim dari finance-tx-dialog.tsx, Task 71-i).
//
// Semua komponen murni presentasional: tipe (premium-segment), nominal +
// pemicu kalkulator, toggle Mode Split, editor baris split, kategori, sumber,
// tanggal + waktu, deskripsi, catatan, dan tags chip input. State & handler
// tetap di root (finance-tx-dialog.tsx / use-finance-mutations).

import { Calculator, Plus, Split, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatRupiah } from './finance-types';
import type { SplitRow } from './finance-types';
import { cn } from '@/lib/utils';

type CategoryOption = { value: string; emoji: string; color: string };
type SourceOption = { id: string; name: string; emoji: string };

/** Tipe transaksi (premium-segment) — Pengeluaran / Pemasukan. */
export function TxTypeSegment({
  isExpense,
  onSwitchType,
}: {
  isExpense: boolean;
  onSwitchType: (type: 'expense' | 'income') => void;
}) {
  return (
    <div className="premium-segment w-full" role="group" aria-label="Tipe transaksi">
      <button
        type="button"
        className="premium-segment-item flex-1 h-9 cursor-pointer"
        data-active={isExpense ? 'true' : 'false'}
        aria-pressed={isExpense}
        onClick={() => onSwitchType('expense')}
      >
        ↓ Pengeluaran
      </button>
      <button
        type="button"
        className="premium-segment-item flex-1 h-9 cursor-pointer"
        data-active={!isExpense ? 'true' : 'false'}
        aria-pressed={!isExpense}
        onClick={() => onSwitchType('income')}
      >
        ↑ Pemasukan
      </button>
    </div>
  );
}

/** Nominal + tombol buka kalkulator (mode tunggal). */
export function TxAmountField({
  value,
  onValueChange,
  disabled,
  onOpenCalculator,
}: {
  value: string;
  onValueChange: (raw: string) => void;
  disabled: boolean;
  onOpenCalculator: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor="tx-amount">Jumlah</Label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={onOpenCalculator}
          aria-label="Buka kalkulator nominal"
        >
          <Calculator className="h-3 w-3" /> Kalkulator
        </button>
      </div>
      <Input
        id="tx-amount"
        inputMode="numeric"
        placeholder="Rp 0"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className="h-10 text-base font-semibold tabular-nums"
      />
    </div>
  );
}

/** Toggle "Pecah ke beberapa kategori" (hanya mode tambah). */
export function SplitModeToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
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
        variant={active ? 'default' : 'outline'}
        size="sm"
        className="h-8 text-xs shrink-0"
        onClick={onToggle}
        aria-pressed={active}
        disabled={disabled}
      >
        {active ? 'Aktif' : 'Nonaktif'}
      </Button>
    </div>
  );
}

/** Daftar baris split (≥2 baris kategori + nominal) + total real-time. */
export function SplitRowsEditor({
  splitRows,
  splitKeys,
  expenseCategories,
  splitTotal,
  isExpense,
  submitting,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
}: {
  splitRows: SplitRow[];
  splitKeys: string[];
  expenseCategories: CategoryOption[];
  splitTotal: number;
  isExpense: boolean;
  submitting: boolean;
  onUpdateRow: (idx: number, field: 'category' | 'amount', value: string) => void;
  onRemoveRow: (idx: number) => void;
  onAddRow: () => void;
}) {
  return (
    <div className="space-y-2">
      {splitRows.map((row, idx) => (
        <div key={splitKeys[idx] ?? `split-fallback-${idx}`} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Select
              value={row.category}
              onValueChange={(v) => onUpdateRow(idx, 'category', v)}
            >
              <SelectTrigger className="h-9" aria-label={`Kategori baris split ${idx + 1}`}>
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {expenseCategories.map(c => (
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
                onUpdateRow(idx, 'amount', e.target.value.replace(/[^\d]/g, ''))
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
            onClick={() => onRemoveRow(idx)}
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
          onClick={onAddRow}
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
  );
}

/** Kategori (mode tunggal) — opsi mengikuti tipe transaksi. */
export function TxCategoryField({
  value,
  onValueChange,
  categories,
}: {
  value: string;
  onValueChange: (value: string) => void;
  categories: CategoryOption[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="tx-category">Kategori</Label>
      <Select value={value} onValueChange={onValueChange}>
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
  );
}

/** Sumber dana. */
export function TxSourceField({
  value,
  onValueChange,
  sources,
}: {
  value: string;
  onValueChange: (value: string) => void;
  sources: SourceOption[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="tx-source">Sumber Dana</Label>
      <Select value={value} onValueChange={onValueChange}>
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
  );
}

/** Tanggal (yyyy-MM-dd) + waktu (WIB). */
export function TxDateTimeFields({
  date,
  time,
  onFieldChange,
  disabled,
}: {
  date: string;
  time: string;
  onFieldChange: (field: 'date' | 'time', value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="tx-date">Tanggal</Label>
        <Input
          id="tx-date"
          type="date"
          value={date}
          onChange={(e) => onFieldChange('date', e.target.value)}
          disabled={disabled}
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tx-time">Waktu (WIB)</Label>
        <Input
          id="tx-time"
          type="time"
          value={time}
          onChange={(e) => onFieldChange('time', e.target.value)}
          disabled={disabled}
          className="h-9"
        />
      </div>
    </div>
  );
}

/** Deskripsi transaksi. */
export function TxDescriptionField({
  value,
  onValueChange,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="tx-desc">Deskripsi</Label>
      <Input
        id="tx-desc"
        placeholder="mis. Makan siang warteg"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className="h-9"
      />
    </div>
  );
}

/** Catatan opsional. */
export function TxNotesField({
  value,
  onValueChange,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="tx-notes">Catatan (opsional)</Label>
      <Textarea
        id="tx-notes"
        placeholder="Detail tambahan…"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className="min-h-16 text-sm"
        rows={2}
      />
    </div>
  );
}

/** Tags chip input — draft input dimiliki root (di-reset saat dialog tutup). */
export function TxTagsField({
  tags,
  draftValue,
  onDraftChange,
  onAdd,
  onRemove,
  disabled,
}: {
  tags: string[];
  draftValue: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="tx-tag">Tag (opsional)</Label>
      <div className="flex gap-2">
        <Input
          id="tx-tag"
          placeholder="mis. rutin lalu Enter"
          value={draftValue}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          disabled={disabled}
          className="h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          onClick={onAdd}
          disabled={disabled || !draftValue.trim()}
          aria-label="Tambah tag"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground border border-border/60"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onRemove(i)}
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
  );
}
