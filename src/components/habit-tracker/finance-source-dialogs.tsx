'use client';

// components/habit-tracker/finance-source-dialogs.tsx — dialog kelola sumber
// dana (daftar + saldo inline edit) + dialog form tambah/edit + AlertDialog
// konfirmasi hapus (SPLIT-PHASE2-UI: state & handler ada di
// use-finance-mutations; komponen ini murni presentasional — pola sama
// dengan finance-tx-dialog.tsx / finance-category-dialogs.tsx).
//
// - Dialog kelola: baris premium-list-item per sumber (emoji + nama + tipe +
//   saldo). Saldo bisa diedit INLINE (klik angka → input formatNominalInput,
//   Enter/✓ simpan via onSaveBalance, Esc/✕ batal) — handler PATCH ada di
//   hook (use-finance-mutations.handleSaveBalance).
// - Form dialog: nama + emoji + saldo (formatNominalInput live preview).
// - Hapus: AlertDialog konfirmasi (state deletingSource di hook — pattern
//   FIX-5/6-b: semua aksi destruktif wajib konfirmasi).
// - Guard: onOpenChange form di-guard `submitting` supaya dialog tidak bisa
//   ditutup saat request in-flight (FIX-1/6-b — tidak stuck "Menyimpan…").

import { Check, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';
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
import { formatRupiah, formatNominalInput, amountFromInput } from './finance-types';
import type { FundSource } from './finance-types';
import type { SourceFormState } from '@/hooks/use-finance-mutations';

const SOURCE_TYPE_LABEL: Record<string, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-Wallet',
};

const SOURCE_EMOJI_CHOICES = [
  '💵', '👛', '🏦', '📱', '💳', '🪙', '💼', '🏠', '🧾', '💱',
];

interface FinanceSourceDialogsProps {
  mgmtOpen: boolean;
  onMgmtOpenChange: (open: boolean) => void;
  sources: FundSource[];
  getActiveSources: () => Array<{ id: string; name: string; emoji: string; balance: number; order: number }>;
  onAddNew: () => void;
  onEdit: (src: FundSource) => void;
  balanceEditId: string | null;
  setBalanceEditId: (id: string | null) => void;
  balanceEditValue: string;
  setBalanceEditValue: (value: string) => void;
  onSaveBalance: (sourceId: string) => void | Promise<void>;
  onRequestDelete: (src: FundSource) => void;
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  editingSource: FundSource | null;
  sourceForm: SourceFormState;
  setSourceForm: React.Dispatch<React.SetStateAction<SourceFormState>>;
  submitting: boolean;
  onSubmit: () => void | Promise<void>;
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
  // FIX-1/6-b: dialog form tidak boleh bisa ditutup saat submit in-flight —
  //Escape/overlay/Batal di-guard `submitting`.
  const handleFormOpenChange = (next: boolean) => {
    if (submitting) return;
    onFormOpenChange(next);
  };

  // Baris daftar: pakai getActiveSources() (selalu array — fallback offline
  // bila API kosong) + map ke objek penuh dari prop `sources` untuk aksi
  // edit/hapus (fallback rows tanpa id hanya tampilan).
  const activeRows = getActiveSources();
  const fullById = new Map<string, FundSource>(
    (Array.isArray(sources) ? sources : []).filter((s) => !!s.id).map((s) => [s.id, s])
  );
  const rows = activeRows.map((s) => ({ ...s, full: fullById.get(s.id) ?? null }));
  const totalBalance = activeRows.reduce((sum, s) => sum + (s.balance ?? 0), 0);

  const startEditBalance = (src: { id: string; balance: number }) => {
    if (!src.id) return;
    setBalanceEditId(src.id);
    // LOW-k: prefill saldo apa adanya (nilai negatif tetap tampil, bukan
    // di-clamp ke 0 — clamp lama membuat user kehilangan info saat balance
    // minus). Commit mempertahankan tanda minus (lihat handleSaveBalance).
    setBalanceEditValue(formatNominalInput(String(Math.round(src.balance ?? 0))));
  };

  const commitBalance = (srcId: string) => {
    void onSaveBalance(srcId);
  };

  const cancelBalance = () => {
    setBalanceEditId(null);
  };

  return (
    <>
      {/* ── Dialog kelola sumber dana ── */}
      <Dialog open={mgmtOpen} onOpenChange={onMgmtOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="chip-icon chip-teal h-7 w-7" aria-hidden="true">
                <Wallet className="h-3.5 w-3.5" />
              </span>
              Kelola Sumber Dana
            </DialogTitle>
            <DialogDescription>
              Atur dompet, bank, dan e-wallet. Klik angka saldo untuk mengeditnya
              secara langsung.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            {rows.length === 0 && (
              <p className="text-[11px] text-muted-foreground py-1">
                Belum ada sumber dana — tambahkan lewat tombol di bawah.
              </p>
            )}
            {rows.map((row) => {
              const editing = !!row.id && balanceEditId === row.id;
              return (
                <div key={row.id || row.name} className="premium-list-item px-2.5! py-2!">
                  <span
                    className="h-9 w-9 rounded-xl grid place-items-center text-base shrink-0 bg-muted/60"
                    aria-hidden="true"
                  >
                    {row.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {row.full ? (SOURCE_TYPE_LABEL[row.full.type] ?? row.full.type) : 'Sumber dana'}
                    </p>
                  </div>
                  {editing ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        inputMode="numeric"
                        value={balanceEditValue}
                        onChange={(e) =>
                          setBalanceEditValue(formatNominalInput(e.target.value.replace(/[^\d]/g, '')))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitBalance(row.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelBalance();
                          }
                        }}
                        className="h-8 w-28 text-xs tabular-nums"
                        aria-label={`Edit saldo ${row.name}`}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:text-emerald-600"
                        onClick={() => commitBalance(row.id)}
                        aria-label={`Simpan saldo ${row.name}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={cancelBalance}
                        aria-label={`Batal edit saldo ${row.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        className={cn(
                          'text-sm font-semibold tabular-nums rounded-lg px-2 py-1 transition-colors',
                          row.id ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
                        )}
                        onClick={() => startEditBalance(row)}
                        title={row.id ? 'Klik untuk edit saldo' : undefined}
                        aria-label={row.id ? `Edit saldo ${row.name}` : `Saldo ${row.name}`}
                      >
                        {formatRupiah(row.balance ?? 0)}
                      </button>
                      {row.full && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEdit(row.full as FundSource)}
                            aria-label={`Edit sumber dana ${row.name}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onRequestDelete(row.full as FundSource)}
                            aria-label={`Hapus sumber dana ${row.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {rows.length > 0 && (
              <div className="flex items-center justify-between px-2.5 pt-2.5">
                <span className="premium-label">Total Saldo Semua Sumber</span>
                <span className="premium-stat text-sm">{formatRupiah(totalBalance)}</span>
              </div>
            )}
          </div>

          <Button
            size="sm"
            className="h-9 w-full btn-primary-gradient"
            onClick={onAddNew}
          >
            <Plus className="h-4 w-4" /> Tambah Sumber Dana
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Dialog form tambah/edit sumber ── */}
      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={cn('chip-icon h-7 w-7', editingSource ? 'chip-amber' : 'chip-emerald')}
                aria-hidden="true"
              >
                <Wallet className="h-3.5 w-3.5" />
              </span>
              {editingSource ? 'Edit Sumber Dana' : 'Sumber Dana Baru'}
            </DialogTitle>
            <DialogDescription>
              Nama, emoji, dan saldo awal dipakai di seluruh tampilan keuangan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="source-name">Nama Sumber</Label>
              <Input
                id="source-name"
                placeholder="mis. BCA Utama"
                value={sourceForm.name}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={submitting}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {SOURCE_EMOJI_CHOICES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSourceForm((prev) => ({ ...prev, emoji }))}
                    className={cn(
                      'h-9 w-9 rounded-xl grid place-items-center text-base transition-all cursor-pointer',
                      sourceForm.emoji === emoji
                        ? 'bg-primary/15 ring-2 ring-primary/50 scale-105'
                        : 'bg-muted/60 hover:bg-muted'
                    )}
                    aria-label={`Pilih emoji ${emoji}`}
                    aria-pressed={sourceForm.emoji === emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Input
                placeholder="atau ketik emoji lain"
                value={sourceForm.emoji}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, emoji: e.target.value.slice(0, 4) }))}
                disabled={submitting}
                className="h-8 text-sm"
                aria-label="Emoji sumber dana kustom"
              />
            </div>

            <div className="space-y-1.5">
              {/* H2: form menyimpan SALDO AWAL (initialBalance) — bukan saldo
                  terkini. Ubah saldo aktual lewat klik angka saldo di daftar
                  sumber (inline edit → PATCH). */}
              <Label htmlFor="source-balance">Saldo Awal</Label>
              {/* BUGHUNT-54 (3-a #4): form EDIT jangan menampilkan kolom
                  kosong untuk initialBalance NEGATIF — prefill nilainya
                  ("Rp -50.000"), bukan '' seperti dulu (balance > 0). */}
              <Input
                id="source-balance"
                inputMode="numeric"
                placeholder="Rp 0"
                value={sourceForm.balance !== 0 ? formatNominalInput(String(sourceForm.balance)) : ''}
                onChange={(e) => {
                  // BUGHUNT-54 (3-a #4): izinkan saldo awal negatif — deteksi
                  // tanda minus ('-' / '−') pada input dan pertahankan pada
                  // magnitude (prefill minus bertahan saat digit diedit).
                  const raw = e.target.value;
                  const magnitude = amountFromInput(raw);
                  setSourceForm((prev) => ({
                    ...prev,
                    balance: /[-−]/.test(raw) ? -magnitude : magnitude,
                  }));
                }}
                disabled={submitting}
                className="h-9 tabular-nums"
              />
              {editingSource && (
                <p className="text-[11px] text-muted-foreground">
                  Saldo awal dipakai menghitung saldo berjalan. Untuk mengubah
                  saldo saat ini, klik angka saldo di daftar sumber dana.
                </p>
              )}
              {sourceForm.balance !== 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Pra-tinjau: <span className="font-semibold tabular-nums">{formatRupiah(sourceForm.balance)}</span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleFormOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button
              className="btn-primary-gradient"
              onClick={() => { void onSubmit(); }}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : editingSource ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Konfirmasi hapus sumber dana (pattern FIX-5/6-b) ── */}
      <AlertDialog
        open={!!deletingSource}
        onOpenChange={(open) => { if (!open) onCancelDelete(); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              Hapus Sumber Dana?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sumber dana <strong>{deletingSource?.name}</strong> akan dihapus.
              Transaksi yang memakai sumber ini tetap tersimpan (sumbernya
              dikosongkan).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive"
              onClick={(e) => { e.preventDefault(); onConfirmDelete(); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
