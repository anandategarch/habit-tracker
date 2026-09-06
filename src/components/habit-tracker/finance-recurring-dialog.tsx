'use client';

// ── Recurring Add/Edit Dialog ─────────────────────────────────────────────
// Extracted from finance-recurring.tsx during PHASE-B-1.
//
// Controlled by parent via props. Renders the Add/Edit form for a single
// recurring transaction template. All form state lives in the parent; this
// component only renders + dispatches setForm/onSubmit.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatNominalInput } from './finance-types';
import {
  DAY_OF_WEEK_NAMES,
  type CategoryOption,
  type SourceOption,
  type RecurringTransaction,
  type RecurringFormState,
} from './finance-recurring-helpers';

export interface RecurringFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecurringTransaction | null;
  form: RecurringFormState;
  setForm: React.Dispatch<React.SetStateAction<RecurringFormState>>;
  submitting: boolean;
  onSubmit: () => void;
  /** Returns the category list for the given type (expense/income). */
  getCategoryList: (type: string) => CategoryOption[];
  /** Returns the active source list for the source dropdown. */
  getActiveSources: () => SourceOption[];
}

export function RecurringFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  submitting,
  onSubmit,
  getCategoryList,
  getActiveSources,
}: RecurringFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Transaksi Berulang' : 'Tambah Transaksi Berulang'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={form.type === 'expense' ? 'default' : 'outline'}
              className={cn(
                form.type === 'expense' &&
                  'bg-destructive hover:bg-destructive text-white'
              )}
              onClick={() =>
                setForm((f) => ({ ...f, type: 'expense', category: '' }))
              }
            >
              Pengeluaran
            </Button>
            <Button
              type="button"
              variant={form.type === 'income' ? 'default' : 'outline'}
              onClick={() =>
                setForm((f) => ({ ...f, type: 'income', category: '' }))
              }
            >
              Pemasukan
            </Button>
          </div>

          <div>
            <Label className="text-xs">Jumlah (Rp)</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: formatNominalInput(e.target.value) }))
              }
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Kategori</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {getCategoryList(form.type).map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.emoji} {c.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Sumber Dana</Label>
            <Select
              value={form.source}
              onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih sumber" />
              </SelectTrigger>
              <SelectContent>
                {getActiveSources().map((s) => (
                  <SelectItem key={s.id || s.name} value={s.name}>
                    {s.emoji} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Deskripsi (opsional)</Label>
            <Input
              placeholder="Contoh: Sewa kos bulanan"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Frekuensi</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    frequency: v as 'daily' | 'weekly' | 'monthly',
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Interval (setiap N)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.interval}
                onChange={(e) =>
                  setForm((f) => ({ ...f, interval: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>

          {form.frequency === 'monthly' && (
            <div>
              <Label className="text-xs">Tanggal (1-31)</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dayOfMonth: e.target.value }))
                }
                className="mt-1"
                placeholder="Contoh: 1 untuk tiap tanggal 1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Jika tanggal melebihi hari di bulan tsb, akan dipakai hari
                terakhir bulan itu.
              </p>
            </div>
          )}

          {form.frequency === 'weekly' && (
            <div>
              <Label className="text-xs">Hari</Label>
              <Select
                value={form.dayOfWeek}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, dayOfWeek: v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OF_WEEK_NAMES.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Mulai</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Berakhir (opsional)</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, isActive: checked }))
              }
            />
            <Label className="text-xs">Aktif</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan...' : editing ? 'Perbarui' : 'Simpan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
