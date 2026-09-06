'use client';

// ── Add/Edit + Delete Rule Dialogs ───────────────────────────────────────
// Extracted from finance-rules.tsx during SPLIT-PHASE-B-3.
//
// Two controlled dialog components:
//  - RuleFormDialog: add/edit a single transaction rule. Contains the
//    "Kondisi (JIKA)" / "Aksi (MAKA)" sub-sections lifted verbatim from the
//    inline version. The parent owns the form state, the submit handler, and
//    the category/source getter functions; this dialog is purely
//    presentational + calls setForm/onSubmit.
//  - RuleDeleteDialog: small AlertDialog confirmation for deletes.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import {
  type CategoryOption,
  type SourceOption,
  type TransactionRule,
  type RuleFormState,
  opsForField,
} from './finance-rules-helpers';

// ── Add/Edit Dialog ──────────────────────────────────────────────────────

export interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TransactionRule | null;
  form: RuleFormState;
  setForm: React.Dispatch<React.SetStateAction<RuleFormState>>;
  submitting: boolean;
  onSubmit: () => void;
  /** Returns the category list (any type) for the action value dropdown. */
  getCategoryList: (type: string) => CategoryOption[];
  /** Returns the active source list (for actionField = 'source'). */
  getActiveSources: () => SourceOption[];
}

export function RuleFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  submitting,
  onSubmit,
  getCategoryList,
  getActiveSources,
}: RuleFormDialogProps) {
  // Action value dropdown options depend on actionField. Computed here
  // (not in parent) since only the dialog consumes it.
  const actionOptions =
    form.actionField === 'source'
      ? getActiveSources().map((s) => ({ value: s.name, label: `${s.emoji} ${s.name}` }))
      : [
          ...getCategoryList('expense').map((c) => ({ value: c.value, label: `${c.emoji} ${c.value}` })),
          ...getCategoryList('income').map((c) => ({ value: c.value, label: `${c.emoji} ${c.value}` })),
        ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Aturan' : 'Tambah Aturan'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Nama Aturan</Label>
            <Input
              placeholder="Contoh: Indomaret → Makanan"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Kondisi (JIKA)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Field</Label>
                <Select
                  value={form.conditionField}
                  onValueChange={(v) => {
                    // Reset op if not valid for the new field
                    const validOps = opsForField(v).map((o) => o.value);
                    setForm((f) => ({
                      ...f,
                      conditionField: v as RuleFormState['conditionField'],
                      conditionOp: (validOps.includes(f.conditionOp)
                        ? f.conditionOp
                        : validOps[0]) as RuleFormState['conditionOp'],
                    }));
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="description">Deskripsi</SelectItem>
                    <SelectItem value="source">Sumber</SelectItem>
                    <SelectItem value="amount">Jumlah</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Operator</Label>
                <Select
                  value={form.conditionOp}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      conditionOp: v as RuleFormState['conditionOp'],
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opsForField(form.conditionField).map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">
                Nilai{' '}
                {form.conditionField === 'amount'
                  ? '(angka, dalam rupiah)'
                  : '(teks)'}
              </Label>
              <Input
                type={form.conditionField === 'amount' ? 'number' : 'text'}
                inputMode={form.conditionField === 'amount' ? 'numeric' : 'text'}
                placeholder={
                  form.conditionField === 'amount' ? '100000' : 'indomaret'
                }
                value={form.conditionValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, conditionValue: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Aksi (MAKA)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Set Field</Label>
                <Select
                  value={form.actionField}
                  onValueChange={(v) => {
                    setForm((f) => ({
                      ...f,
                      actionField: v as RuleFormState['actionField'],
                      actionValue: '',
                    }));
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Kategori</SelectItem>
                    <SelectItem value="source">Sumber</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Menjadi</Label>
                <Select
                  value={form.actionValue}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, actionValue: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {actionOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Allow custom value via text input as fallback */}
            <Input
              placeholder="atau ketik nilai manual..."
              value={form.actionValue}
              onChange={(e) =>
                setForm((f) => ({ ...f, actionValue: e.target.value }))
              }
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Prioritas</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value }))
                }
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Lebih kecil = dievaluasi lebih dulu.
              </p>
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, isActive: checked }))
                  }
                />
                <Label className="text-xs">Aktif</Label>
              </div>
            </div>
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

// ── Delete Confirmation Dialog ───────────────────────────────────────────

export interface RuleDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RuleDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
}: RuleDeleteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Aturan</AlertDialogTitle>
          <AlertDialogDescription>
            Yakin ingin menghapus aturan ini? Transaksi yang sudah dibuat
            tidak akan terpengaruh.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive text-white"
            onClick={onConfirm}
          >
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
