'use client';

// ── Source Management + Form + Delete Dialogs ───────────────────────────
// Extracted from finance.tsx during SPLIT-PHASE2-UI.
// Three dialogs:
//  - SourceManagementDialog: shows total balance + list of sources with
//    inline balance edit + edit/delete buttons + "Tambah" button.
//  - SourceFormDialog: add/edit a single source — emoji + name +
//    initial balance (only when adding).
//  - DeleteSourceDialog: confirmation alert with warning about non-zero
//    balance.

import { Edit3, Plus, Trash2 } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatNominalInput, formatRupiah, type FundSource } from './finance-types';
import type { SourceFormState } from '@/hooks/use-finance-mutations';

export interface FinanceSourceDialogsProps {
  // ── Management dialog ──
  mgmtOpen: boolean;
  onMgmtOpenChange: (open: boolean) => void;
  /** All sources — used to compute the total balance header. */
  sources: FundSource[];
  /** Active sources (fallbacks if DB empty) — used for the row list. */
  getActiveSources: () => Array<{ id: string; name: string; emoji: string; balance: number; order: number }>;
  onAddNew: () => void;
  onEdit: (src: FundSource) => void;
  // ── Inline balance edit ──
  balanceEditId: string | null;
  setBalanceEditId: (id: string | null) => void;
  balanceEditValue: string;
  setBalanceEditValue: (v: string) => void;
  onSaveBalance: (sourceId: string) => Promise<void>;
  // ── Delete trigger ──
  onRequestDelete: (src: FundSource) => void;
  // ── Form dialog ──
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  editingSource: FundSource | null;
  sourceForm: SourceFormState;
  setSourceForm: React.Dispatch<React.SetStateAction<SourceFormState>>;
  submitting: boolean;
  onSubmit: () => Promise<void>;
  // ── Delete confirmation ──
  deletingSource: FundSource | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

export function FinanceSourceDialogs({
  mgmtOpen,
  onMgmtOpenChange,
  sources,
  getActiveSources,
  onAddNew,
  onEdit,
  balanceEditId,
  setBalanceEditId,
  balanceEditValue,
  setBalanceEditValue,
  onSaveBalance,
  onRequestDelete,
  formOpen,
  onFormOpenChange,
  editingSource,
  sourceForm,
  setSourceForm,
  submitting,
  onSubmit,
  deletingSource,
  onCancelDelete,
  onConfirmDelete,
}: FinanceSourceDialogsProps) {
  return (
    <>
      {/* ─── SOURCE MANAGEMENT DIALOG ─── */}
      <Dialog open={mgmtOpen} onOpenChange={onMgmtOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Kelola Sumber Dana</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-teal-50 dark:to-teal-950/30 border border-primary/20 p-4">
              <p className="text-xs text-primary font-medium mb-1">Total Saldo Semua Sumber</p>
              <p className="text-2xl font-bold text-primary">{formatRupiah(sources.reduce((s, src) => s + (src.balance || 0), 0))}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Kelola akun bank, e-wallet, kas, dll</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAddNew}><Plus className="h-3 w-3" />Tambah</Button>
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
              {getActiveSources().map(src => (
                <div key={src.id || src.name} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-card group hover:bg-accent/50 transition-colors">
                  <span className="text-lg">{src.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{src.name}</p>
                    {balanceEditId === src.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground">Rp</span>
                        <Input autoFocus className="h-11 text-sm w-40 px-2" value={balanceEditValue} onChange={e => setBalanceEditValue(formatNominalInput(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') onSaveBalance(src.id); if (e.key === 'Escape') setBalanceEditId(null); }} onBlur={() => onSaveBalance(src.id)} />
                      </div>
                    ) : (
                      <button className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: (src.balance || 0) >= 0 ? '#059669' : '#dc2626' }} onClick={() => { setBalanceEditId(src.id); setBalanceEditValue(src.balance ? String(src.balance) : ''); }}>
                        {(src.balance || 0) < 0 ? '-' : ''}{formatRupiah(Math.abs(src.balance || 0))}
                      </button>
                    )}
                  </div>
                  {src.id && (
                    <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex gap-1 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(src)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onRequestDelete(src)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── ADD/EDIT SOURCE DIALOG ─── */}
      <Dialog open={formOpen} onOpenChange={(open) => { if (!open) onFormOpenChange(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingSource ? 'Edit Sumber Dana' : 'Tambah Sumber Dana'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div><Label className="text-xs">Emoji</Label><Input value={sourceForm.emoji} onChange={e => setSourceForm(f => ({ ...f, emoji: e.target.value }))} className="mt-1 text-center text-lg" maxLength={4} /></div>
              <div><Label className="text-xs">Nama Sumber</Label><Input placeholder="Contoh: Bank BCA" value={sourceForm.name} onChange={e => setSourceForm(f => ({ ...f, name: e.target.value }))} className="mt-1" /></div>
            </div>
            {!editingSource && (
              <div>
                <Label className="text-xs">Saldo Awal</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                  <Input placeholder="0" value={formatNominalInput(String(sourceForm.balance || ''))} onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setSourceForm(f => ({ ...f, balance: parseInt(raw || '0', 10) })); }} className="pl-10" />
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => onFormOpenChange(false)}>Batal</Button><Button className="flex-1" onClick={onSubmit} disabled={submitting}>{submitting ? 'Menyimpan...' : editingSource ? 'Perbarui' : 'Simpan'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE SOURCE CONFIRMATION ─── */}
      <AlertDialog open={!!deletingSource} onOpenChange={(open) => { if (!open) onCancelDelete(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Sumber Dana</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus <strong>{deletingSource?.emoji} {deletingSource?.name}</strong>?
              {deletingSource && (deletingSource.balance || 0) !== 0 && (
                <span className="block mt-1 text-warning dark:text-warning/80">Sumber ini memiliki saldo {formatRupiah(deletingSource.balance || 0)}.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancelDelete}>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive text-white" onClick={onConfirmDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
