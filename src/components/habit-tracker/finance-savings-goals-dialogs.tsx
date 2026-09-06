'use client';

// ---------------------------------------------------------------------------
// Savings Goals — 3 dialogs (ADD/EDIT + ADJUST + DELETE).
// Extracted from finance-savings-goals.tsx during PHASE-B-2.
//
// Follows the finance-source-dialogs.tsx multi-dialog pattern: each dialog
// is a self-contained named component controlled by the parent via props.
// All state stays in the parent (FinanceSavingsGoals) so the openAdjust /
// openEdit / openCreate / handleSubmit / handleAdjust / handleDelete
// handlers continue to read the same useState hooks.
//
// Three components:
//  - SavingsGoalFormDialog:   add/edit a goal — name + emoji + target +
//    initial/current balance + source + deadline
//  - SavingsGoalAdjustDialog: Tambah Tabungan (+) / Tarik (−) quick action
//    with quick-fill chips (50k, 100k, 500k, 1jt, "Sisanya", "Semua")
//  - SavingsGoalDeleteDialog: generic confirmation alert
// ---------------------------------------------------------------------------

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatNominalInput, formatRupiah, type FundSource } from './finance-types';
import {
  type SavingsGoal,
  type GoalFormState,
  GOAL_EMOJI_OPTIONS,
} from './finance-savings-goals-helpers';

// ── 1. ADD / EDIT DIALOG ───────────────────────────────────────────────────

export interface SavingsGoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when editing an existing goal (vs creating new). */
  editing: boolean;
  form: GoalFormState;
  setForm: React.Dispatch<React.SetStateAction<GoalFormState>>;
  submitting: boolean;
  onSubmit: () => void | Promise<void>;
  /** Fund sources for the optional "Sumber Dana" dropdown. */
  sources: FundSource[];
}

export function SavingsGoalFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  submitting,
  onSubmit,
  sources,
}: SavingsGoalFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Tabungan' : 'Tambah Tabungan'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label className="text-xs">Nama Tabungan</Label>
            <Input
              className="mt-1"
              placeholder="Contoh: Liburan, Dana Darurat, Beli Laptop"
              value={form.name}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Emoji picker — grid of common aspiration emojis */}
          <div>
            <Label className="text-xs">Emoji</Label>
            <div className="mt-1 grid grid-cols-8 sm:grid-cols-10 gap-1.5">
              {GOAL_EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={cn(
                    'h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-colors',
                    form.emoji === e
                      ? 'bg-primary/15 ring-2 ring-primary'
                      : 'bg-muted/40 hover:bg-muted'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Target amount */}
          <div>
            <Label className="text-xs">Target (Rp)</Label>
            <Input
              className="mt-1"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.targetAmount}
              onChange={(e) => setForm((f) => ({ ...f, targetAmount: formatNominalInput(e.target.value) }))}
            />
          </div>

          {/* Initial current amount (only meaningful on create, but editable on edit too) */}
          <div>
            <Label className="text-xs">
              {editing ? 'Saldo Saat Ini (Rp)' : 'Saldo Awal (Rp) — opsional'}
            </Label>
            <Input
              className="mt-1"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={form.currentAmount}
              onChange={(e) => setForm((f) => ({ ...f, currentAmount: formatNominalInput(e.target.value) }))}
            />
          </div>

          {/* Source (optional) */}
          <div>
            <Label className="text-xs">Sumber Dana (opsional)</Label>
            <Select
              value={form.sourceName || '__none__'}
              onValueChange={(v) => setForm((f) => ({ ...f, sourceName: v === '__none__' ? '' : v }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih sumber dana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Tidak ada —</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.emoji} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Hanya referensi. Saldo sumber dana tidak otomatis berkurang.
            </p>
          </div>

          {/* Deadline (optional) */}
          <div>
            <Label className="text-xs">Tenggat (opsional)</Label>
            <Input
              className="mt-1"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button className="flex-1" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Menyimpan...' : editing ? 'Perbarui' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 2. ADJUST (TAMBAH / TARIK) DIALOG ──────────────────────────────────────

export interface SavingsGoalAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The goal being adjusted. Null while closing. */
  goal: SavingsGoal | null;
  adjustAmount: string;
  setAdjustAmount: React.Dispatch<React.SetStateAction<string>>;
  /** 'add' = Tambah Tabungan, 'withdraw' = Tarik. */
  adjustDirection: 'add' | 'withdraw';
  submitting: boolean;
  onSubmit: () => void | Promise<void>;
}

export function SavingsGoalAdjustDialog({
  open,
  onOpenChange,
  goal,
  adjustAmount,
  setAdjustAmount,
  adjustDirection,
  submitting,
  onSubmit,
}: SavingsGoalAdjustDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {adjustDirection === 'add' ? 'Tambah Tabungan' : 'Tarik Tabungan'}
          </DialogTitle>
        </DialogHeader>
        {goal && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-background">
                {goal.emoji}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{goal.name}</p>
                <p className="text-xs text-muted-foreground">
                  Saldo: {formatRupiah(goal.currentAmount)} / {formatRupiah(goal.targetAmount)}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-xs">
                {adjustDirection === 'add' ? 'Jumlah Tambah (Rp)' : 'Jumlah Tarik (Rp)'}
              </Label>
              <Input
                className="mt-1 text-base font-semibold"
                type="text"
                inputMode="numeric"
                placeholder="0"
                autoFocus
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(formatNominalInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSubmit();
                }}
              />
              {adjustDirection === 'add' && goal.targetAmount > goal.currentAmount && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Butuh {formatRupiah(goal.targetAmount - goal.currentAmount)} lagi untuk mencapai target.
                </p>
              )}
            </div>
            {/* Quick-fill chips: common amounts + "sisanya" */}
            <div className="flex flex-wrap gap-1.5">
              {[50_000, 100_000, 500_000, 1_000_000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAdjustAmount(formatNominalInput(String(amt)))}
                  className="px-2 py-1 rounded-md text-xs bg-muted/60 hover:bg-muted transition-colors"
                >
                  {formatRupiah(amt)}
                </button>
              ))}
              {adjustDirection === 'add' && goal.targetAmount > goal.currentAmount && (
                <button
                  type="button"
                  onClick={() => setAdjustAmount(formatNominalInput(String(goal.targetAmount - goal.currentAmount)))}
                  className="px-2 py-1 rounded-md text-xs bg-success/10 text-success hover:bg-success/20 transition-colors font-medium"
                >
                  Sisanya
                </button>
              )}
              {adjustDirection === 'withdraw' && goal.currentAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAdjustAmount(formatNominalInput(String(goal.currentAmount)))}
                  className="px-2 py-1 rounded-md text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
                >
                  Semua
                </button>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            className={cn('flex-1', adjustDirection === 'withdraw' && 'bg-destructive hover:bg-destructive text-white')}
            onClick={onSubmit}
            disabled={submitting || !adjustAmount}
          >
            {submitting ? 'Memproses...' : adjustDirection === 'add' ? 'Tambah' : 'Tarik'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 3. DELETE CONFIRMATION ─────────────────────────────────────────────────

export interface SavingsGoalDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  onConfirm: () => void | Promise<void>;
}

export function SavingsGoalDeleteDialog({
  open,
  onOpenChange,
  submitting,
  onConfirm,
}: SavingsGoalDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus Tabungan?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tabungan ini akan dihapus permanen dan tidak bisa dikembalikan.
        </p>
        <DialogFooter>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Menghapus...' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
