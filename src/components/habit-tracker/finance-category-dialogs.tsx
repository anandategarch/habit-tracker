'use client';

// components/habit-tracker/finance-category-dialogs.tsx — dialog kelola
// kategori (list + rename/delete) + dialog form kategori (SPLIT-PHASE2-UI:
// state/handler di use-finance-mutations).
//
// - Hapus memakai AlertDialog konfirmasi (FIX-5/6-b) — API menolak bila
//   kategori masih dipakai transaksi; pesan error API dimunculkan toast
//   (ditangani handler hook).
// - LOW-h: tombol "Migrasi emoji" dihapus — endpoint
//   /api/finance/categories/migrate-emojis tidak pernah ada (405 via
//   fallback [id] route); kategori baru memilih emoji lewat form.

import { useState } from 'react';
import { PieChart, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import type { FinanceCategory } from './finance-types';
import type { CatFormState } from '@/hooks/use-finance-mutations';

interface FinanceCategoryDialogsProps {
  mgmtOpen: boolean;
  onMgmtOpenChange: (open: boolean) => void;
  expenseCategories: FinanceCategory[];
  incomeCategories: FinanceCategory[];
  onAddNew: (type: 'income' | 'expense') => void;
  onEdit: (cat: FinanceCategory) => void;
  onDelete: (cat: FinanceCategory) => void | Promise<void>;
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  editingCat: FinanceCategory | null;
  catForm: CatFormState;
  setCatForm: React.Dispatch<React.SetStateAction<CatFormState>>;
  allCategories: FinanceCategory[];
  submitting: boolean;
  onSubmit: () => void | Promise<void>;
}

const EMOJI_CHOICES = [
  '🍽️', '🚌', '🛍️', '🎬', '🧾', '💊', '💰', '💼', '📚', '🎁',
  '☕', '🚗', '🏠', '✈️', '🎮', '👕', '💇', '🐾', '🎓', '📦',
];
const COLOR_CHOICES = [
  '#f59e0b', '#0ea5e9', '#f43f5e', '#8b5cf6', '#64748b',
  '#10b981', '#14b8a6', '#eab308', '#ec4899', '#78716c',
];

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
  const [deletingCat, setDeletingCat] = useState<FinanceCategory | null>(null);

  const confirmDelete = () => {
    if (!deletingCat) return;
    void onDelete(deletingCat);
    setDeletingCat(null);
  };

  const renderList = (title: string, cats: FinanceCategory[], type: 'expense' | 'income') => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => onAddNew(type)}
          aria-label={`Tambah kategori ${title.toLowerCase()}`}
        >
          <Plus className="h-3 w-3" /> Tambah
        </Button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {cats.length === 0 && (
          <p className="text-[11px] text-muted-foreground py-1">Belum ada kategori.</p>
        )}
        {cats.map(cat => (
          <div key={cat.id} className="premium-list-item px-2.5! py-2!">
            <span
              className="h-7 w-7 rounded-lg grid place-items-center text-sm shrink-0"
              style={{ backgroundColor: `${cat.color}20` }}
              aria-hidden="true"
            >
              {cat.emoji}
            </span>
            <span className="flex-1 min-w-0 text-xs font-medium truncate">{cat.name}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(cat)}
                aria-label={`Edit kategori ${cat.name}`}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeletingCat(cat)}
                aria-label={`Hapus kategori ${cat.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Dialog kelola kategori ── */}
      <Dialog open={mgmtOpen} onOpenChange={onMgmtOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="chip-icon chip-violet h-7 w-7" aria-hidden="true">
                <PieChart className="h-3.5 w-3.5" />
              </span>
              Kelola Kategori
            </DialogTitle>
            <DialogDescription>
              Atur kategori pemasukan & pengeluaran. Kategori yang masih dipakai
              transaksi tidak bisa dihapus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {renderList('Pengeluaran', expenseCategories, 'expense')}
            <div className="premium-divider" aria-hidden="true" />
            {renderList('Pemasukan', incomeCategories, 'income')}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog form kategori ── */}
      <Dialog open={formOpen} onOpenChange={onFormOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Edit Kategori' : 'Kategori Baru'}</DialogTitle>
            <DialogDescription>
              Nama, emoji, dan warna dipakai di seluruh tampilan keuangan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="premium-segment w-full" role="group" aria-label="Tipe kategori">
              <button
                type="button"
                className="premium-segment-item flex-1 h-9 cursor-pointer"
                data-active={catForm.type === 'expense' ? 'true' : 'false'}
                aria-pressed={catForm.type === 'expense'}
                onClick={() => setCatForm(prev => ({ ...prev, type: 'expense' }))}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                className="premium-segment-item flex-1 h-9 cursor-pointer"
                data-active={catForm.type === 'income' ? 'true' : 'false'}
                aria-pressed={catForm.type === 'income'}
                onClick={() => setCatForm(prev => ({ ...prev, type: 'income' }))}
              >
                Pemasukan
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nama Kategori</Label>
              <Input
                id="cat-name"
                placeholder="mis. Jajan Malam"
                value={catForm.name}
                onChange={(e) => setCatForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={submitting}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CHOICES.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCatForm(prev => ({ ...prev, emoji }))}
                    className={cn(
                      'h-9 w-9 rounded-xl grid place-items-center text-base transition-all cursor-pointer',
                      catForm.emoji === emoji
                        ? 'bg-primary/15 ring-2 ring-primary/50 scale-105'
                        : 'bg-muted/60 hover:bg-muted'
                    )}
                    aria-label={`Pilih emoji ${emoji}`}
                    aria-pressed={catForm.emoji === emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Input
                placeholder="atau ketik emoji lain"
                value={catForm.emoji}
                onChange={(e) => setCatForm(prev => ({ ...prev, emoji: e.target.value.slice(0, 4) }))}
                disabled={submitting}
                className="h-8 text-sm"
                aria-label="Emoji kategori kustom"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_CHOICES.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCatForm(prev => ({ ...prev, color }))}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all cursor-pointer',
                      catForm.color === color && 'ring-2 ring-offset-2 ring-offset-background ring-foreground/60 scale-110'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Pilih warna ${color}`}
                    aria-pressed={catForm.color === color}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-medium">Lacak “Terakhir Transaksi”</p>
                <p className="text-[11px] text-muted-foreground">
                  Kategori tampil di ringkasan overview saat dipakai.
                </p>
              </div>
              <Switch
                checked={catForm.trackLastDone}
                onCheckedChange={(v) => setCatForm(prev => ({ ...prev, trackLastDone: v }))}
                disabled={submitting}
                aria-label="Lacak kategori di Terakhir Transaksi"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onFormOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button className="btn-primary-gradient" onClick={() => { void onSubmit(); }} disabled={submitting}>
              {submitting ? 'Menyimpan…' : editingCat ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Konfirmasi hapus kategori (FIX-5 / 6-b) ── */}
      <AlertDialog open={!!deletingCat} onOpenChange={(open) => { if (!open) setDeletingCat(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              Hapus Kategori?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Kategori <strong>{deletingCat?.name}</strong> akan dihapus. Bila masih
              dipakai transaksi, penghapusan akan ditolak dan pesan error API
              ditampilkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive"
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
