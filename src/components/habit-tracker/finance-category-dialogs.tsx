'use client';

// ── Category Management + Form Dialogs ───────────────────────────────────
// Extracted from finance.tsx during SPLIT-PHASE2-UI.
// Two dialogs:
//  - CategoryManagementDialog: lists expense + income categories with
//    edit/delete buttons per row, plus "Tambah" buttons that open the form.
//  - CategoryFormDialog: add/edit a single category — emoji + name +
//    auto-derived color + trackLastDone checkbox.

import { Edit3, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deriveColorFromEmoji } from '@/lib/emoji-color';
import type { FinanceCategory } from './finance-types';
import type { CatFormState } from '@/hooks/use-finance-mutations';

export interface FinanceCategoryDialogsProps {
  // ── Management dialog ──
  mgmtOpen: boolean;
  onMgmtOpenChange: (open: boolean) => void;
  expenseCategories: FinanceCategory[];
  incomeCategories: FinanceCategory[];
  onAddNew: (type: 'income' | 'expense') => void;
  onEdit: (cat: FinanceCategory) => void;
  onDelete: (cat: FinanceCategory) => Promise<void>;
  // ── Form dialog ──
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  editingCat: FinanceCategory | null;
  catForm: CatFormState;
  setCatForm: React.Dispatch<React.SetStateAction<CatFormState>>;
  /** Full category list — used to derive non-conflicting colors. */
  allCategories: FinanceCategory[];
  submitting: boolean;
  onSubmit: () => Promise<void>;
}

export function FinanceCategoryDialogs({
  mgmtOpen,
  onMgmtOpenChange,
  expenseCategories,
  incomeCategories,
  onAddNew,
  onEdit,
  onDelete,
  formOpen,
  onFormOpenChange,
  editingCat,
  catForm,
  setCatForm,
  allCategories,
  submitting,
  onSubmit,
}: FinanceCategoryDialogsProps) {
  return (
    <>
      {/* ─── CATEGORY MANAGEMENT DIALOG ─── */}
      <Dialog open={mgmtOpen} onOpenChange={onMgmtOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kelola Kategori</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-destructive">📁 Pengeluaran</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAddNew('expense')}><Plus className="h-3 w-3" />Tambah</Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {expenseCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                    {cat.trackLastDone && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80">Track</span>}
                    <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cat)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(cat)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary">💰 Pemasukan</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAddNew('income')}><Plus className="h-3 w-3" />Tambah</Button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {incomeCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                    {cat.trackLastDone && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80">Track</span>}
                    <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(cat)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(cat)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── CATEGORY FORM DIALOG ─── */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) onFormOpenChange(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div>
                <Label className="text-xs">Emoji</Label>
                <Input
                  value={catForm.emoji}
                  onChange={e => {
                    const emoji = e.target.value;
                    // Auto-derive color from emoji — no manual color picker.
                    // Extracts dominant color via Canvas, resolves conflicts
                    // with existing category colors (same type) so no two
                    // categories share the same hue.
                    const existingColors = allCategories
                      .filter(c => c.type === catForm.type && c.id !== editingCat?.id)
                      .map(c => c.color);
                    const derived = deriveColorFromEmoji(emoji, existingColors);
                    setCatForm(f => ({ ...f, emoji, color: derived }));
                  }}
                  className="mt-1 text-center text-lg"
                  maxLength={11}
                />
              </div>
              <div><Label className="text-xs">Nama</Label><Input placeholder="Contoh: Makanan" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            </div>
            {/* Color preview — auto-derived from emoji, no manual picker.
                Shows a swatch so user can see what color was assigned. */}
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md border border-border shrink-0"
                style={{ backgroundColor: catForm.color }}
                aria-label={`Warna otomatis: ${catForm.color}`}
              />
              <p className="text-xs text-muted-foreground">Warna otomatis dari emoji</p>
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="trackLastDone" checked={catForm.trackLastDone} onChange={e => setCatForm(f => ({ ...f, trackLastDone: e.target.checked }))} className="rounded border-border" /><Label htmlFor="trackLastDone" className="text-xs">Track terakhir transaksi</Label></div>
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => onFormOpenChange(false)}>Batal</Button><Button className="flex-1" onClick={onSubmit} disabled={submitting}>{submitting ? 'Menyimpan...' : editingCat ? 'Perbarui' : 'Simpan'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
