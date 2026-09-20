'use client';

// components/habit-tracker/finance-recurring-form-dialog.tsx — dialog
// tambah/edit transaksi berulang (diekstrak verbatim dari
// finance-recurring.tsx, Task 71-i). Presentasional: nama, tipe segment,
// nominal (formatNominalInput live + pra-tinjau), kategori, sumber (opsional,
// by-ID), frekuensi, tanggal mulai (default/READ jakartaDateKey — 6-b FIX-10).

import { CalendarDays, Repeat } from 'lucide-react';
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
import {
  formatRupiah,
  formatNominalInput,
  amountFromInput,
} from './finance-types';
import { cn } from '@/lib/utils';
import type { RecurringFormState } from './finance-recurring-form-state';

type CategoryOption = { value: string; emoji: string; color: string };
type SourceOption = { id: string; name: string; emoji: string; balance: number; order: number };

export interface RecurringFormDialogProps {
  open: boolean;
  form: RecurringFormState;
  setForm: React.Dispatch<React.SetStateAction<RecurringFormState>>;
  submitting: boolean;
  categoryOptions: CategoryOption[];
  sourceOptions: SourceOption[];
  onOpenChange: (next: boolean) => void;
  onSubmit: () => void | Promise<void>;
}

export function RecurringFormDialog({
  open,
  form,
  setForm,
  submitting,
  categoryOptions,
  sourceOptions,
  onOpenChange,
  onSubmit,
}: RecurringFormDialogProps) {
  const isExpense = form.type !== 'income';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className={cn('chip-icon h-7 w-7', form.id ? 'chip-amber' : 'chip-violet')}
              aria-hidden="true"
            >
              <Repeat className="h-3.5 w-3.5" />
            </span>
            {form.id ? 'Edit Transaksi Berulang' : 'Transaksi Berulang Baru'}
          </DialogTitle>
          <DialogDescription>
            Diproses manual lewat tombol “Proses Sekarang” — satu klik membuat
            transaksi instance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Nama */}
          <div className="space-y-1.5">
            <Label htmlFor="recurring-name">Nama</Label>
            <Input
              id="recurring-name"
              placeholder="mis. Sewa kos bulanan"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              disabled={submitting}
              className="h-9"
            />
          </div>

          {/* Tipe */}
          <div className="premium-segment w-full" role="group" aria-label="Tipe transaksi berulang">
            <button
              type="button"
              className="premium-segment-item flex-1 h-9 cursor-pointer"
              data-active={isExpense ? 'true' : 'false'}
              aria-pressed={isExpense}
              onClick={() => setForm((prev) => ({ ...prev, type: 'expense', category: '' }))}
            >
              ↓ Pengeluaran
            </button>
            <button
              type="button"
              className="premium-segment-item flex-1 h-9 cursor-pointer"
              data-active={!isExpense ? 'true' : 'false'}
              aria-pressed={!isExpense}
              onClick={() => setForm((prev) => ({ ...prev, type: 'income', category: '' }))}
            >
              ↑ Pemasukan
            </button>
          </div>

          {/* Nominal */}
          <div className="space-y-1.5">
            <Label htmlFor="recurring-amount">Jumlah</Label>
            <Input
              id="recurring-amount"
              inputMode="numeric"
              placeholder="Rp 0"
              value={form.amount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, amount: formatNominalInput(e.target.value.replace(/[^\d]/g, '')) }))
              }
              disabled={submitting}
              className="h-10 text-base font-semibold tabular-nums"
            />
            {amountFromInput(form.amount) > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Pra-tinjau: <span className="font-semibold tabular-nums">{formatRupiah(amountFromInput(form.amount))}</span>
              </p>
            )}
          </div>

          {/* Kategori */}
          <div className="space-y-1.5">
            <Label htmlFor="recurring-category">Kategori</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
            >
              <SelectTrigger id="recurring-category" className="h-9">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {categoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.emoji} {c.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sumber */}
          <div className="space-y-1.5">
            <Label htmlFor="recurring-source">Sumber Dana (opsional)</Label>
            <Select
              value={form.sourceId || 'none'}
              onValueChange={(v) => setForm((prev) => ({ ...prev, sourceId: v === 'none' ? '' : v }))}
            >
              <SelectTrigger id="recurring-source" className="h-9">
                <SelectValue placeholder="Pilih sumber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa sumber</SelectItem>
                {/* LOW-l: hanya sumber dengan ID asli yang ditawarkan dan
                    dikirim sebagai value — API memvalidasi sourceId by-ID,
                    memakai nama (fallback lama) membuat POST/PUT 400
                    "Sumber dana tidak ditemukan". */}
                {sourceOptions.filter((s) => !!s.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.emoji} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frekuensi + tanggal mulai */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-freq">Frekuensi</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((prev) => ({ ...prev, frequency: v }))}
              >
                <SelectTrigger id="recurring-freq" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-start" className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden="true" /> Mulai
              </Label>
              <Input
                id="recurring-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                disabled={submitting}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            className={cn('btn-primary-gradient', isExpense && 'bg-destructive hover:bg-destructive')}
            onClick={() => { void onSubmit(); }}
            disabled={submitting}
          >
            {submitting ? 'Menyimpan…' : form.id ? 'Simpan Perubahan' : 'Tambah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
