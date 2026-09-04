// ---------------------------------------------------------------------------
// BudgetDialog — edit weekly budget target + rollover toggle.
// Extracted from finance-explorer.tsx during SPLIT-PHASE3.
// ---------------------------------------------------------------------------

'use client';

import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatRupiah } from './finance-types';
import type { WeekBudgetData } from './finance-explorer-types';

export interface BudgetDialogProps {
  editingWeek: number | null;
  budgetData: WeekBudgetData | null | undefined;
  editTarget: string;
  editRollover: boolean;
  saving: boolean;
  onSetEditingWeek: (week: number | null) => void;
  onSetEditTarget: (target: string) => void;
  onSetEditRollover: (rollover: boolean) => void;
  onSave: () => void;
}

export function BudgetDialog({
  editingWeek,
  budgetData,
  editTarget,
  editRollover,
  saving,
  onSetEditingWeek,
  onSetEditTarget,
  onSetEditRollover,
  onSave,
}: BudgetDialogProps) {
  return (
    <Dialog open={editingWeek !== null} onOpenChange={(open) => !open && onSetEditingWeek(null)}>
      <DialogContent className="max-w-[95vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Target Week {editingWeek}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Smart Suggestion */}
          {budgetData && budgetData.suggestedTarget > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-medium">Saran Target</p>
                  <p className="text-sm font-bold">{formatRupiah(budgetData.suggestedTarget)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onSetEditTarget(String(budgetData.suggestedTarget))}>
                Pakai
              </Button>
            </div>
          )}
          {/* Target Input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Target Pengeluaran</Label>
            <Input type="number" value={editTarget} onChange={(e) => onSetEditTarget(e.target.value)} placeholder="500000" className="text-lg font-bold" />
            <p className="text-xs text-muted-foreground">Masukkan maks pengeluaran untuk minggu ini</p>
          </div>
          {/* Rollover Toggle */}
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label className="text-sm font-medium">Rollover</Label>
              <p className="text-xs text-muted-foreground">Sisa budget masuk minggu depan</p>
            </div>
            <Switch checked={editRollover} onCheckedChange={onSetEditRollover} />
          </div>
          <Button className="w-full" onClick={onSave} disabled={saving || !editTarget}>
            {saving ? 'Menyimpan...' : 'Simpan Target'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
