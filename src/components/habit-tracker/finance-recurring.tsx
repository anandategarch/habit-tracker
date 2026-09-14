'use client';

// components/habit-tracker/finance-recurring.tsx — sub-tab "Recurring":
// transaksi berulang (Actual Budget / Firefly III inspired).
//
// - Daftar recurring (premium-list-item): avatar emoji kategori + nama +
//   nominal (emerald/rose tabular-nums) + frekuensi + kategori + sumber +
//   tombol "Proses Sekarang" (POST /api/finance/recurring/[id]/process →
//   buat 1 transaksi instance; toast + invalidate ['finance'] — race server
//   di-guard CAS, 409 ditampilkan apa adanya).
// - Dialog tambah/edit: nama, nominal (formatNominalInput live), tipe
//   (segment), kategori Select, sumber Select, frekuensi, tanggal mulai
//   (input date — DEFAULT jakartaDateString(), BUKAN browser-local — fix
//   6-b FIX-10; form edit membaca startDate via jakartaDateKey karena
//   recurring dipatok tengah malam Jakarta).
// - Hapus: AlertDialog konfirmasi.
// - Semua notifikasi memakai toast Indonesia (bukan alert()).
// - FIX-1/6-b: setSubmitting(false) / reset state SELALU di blok finally;
//   onOpenChange dialog di-guard `submitting` supaya tidak pernah stuck.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatRupiah,
  formatNominalInput,
  amountFromInput,
} from './finance-types';
import { tintFromColor, formatDateShort } from '@/lib/finance-helpers';
import { jakartaDateString, jakartaDateKey } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import type { RecurringTransaction } from './finance-types';
import { useAppStore } from '@/store/app-store';

interface FinanceRecurringProps {
  getCategoryList: (type: string) => Array<{ value: string; emoji: string; color: string }>;
  getActiveSources: () => Array<{ id: string; name: string; emoji: string; balance: number; order: number }>;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

const FREQ_LABEL: Record<string, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
};

interface RecurringFormState {
  id: string | null;
  name: string;
  amount: string;
  type: string;
  category: string;
  sourceId: string;
  frequency: string;
  startDate: string;
}

function emptyRecurringForm(): RecurringFormState {
  return {
    id: null,
    name: '',
    amount: '',
    type: 'expense',
    category: '',
    sourceId: '',
    frequency: 'monthly',
    // 6-b FIX-10: default tanggal mulai = hari Jakarta (bukan TZ browser).
    startDate: jakartaDateString(),
  };
}

function formFromRecurring(rt: RecurringTransaction): RecurringFormState {
  return {
    id: rt.id,
    name: rt.name,
    amount: formatNominalInput(String(Math.round(rt.amount ?? 0))),
    type: rt.type === 'income' ? 'income' : 'expense',
    category: rt.category ?? '',
    sourceId: rt.sourceId ?? '',
    frequency: rt.frequency ?? 'monthly',
    // 6-b FIX-10: recurring dipatok tengah malam Jakarta (+07:00) — baca
    // via jakartaDateKey, bukan konversi TZ browser (menghindari shift -1
    // hari di browser barat Jakarta saat edit + re-save).
    startDate: jakartaDateKey(new Date(rt.startDate)),
  };
}

export default function FinanceRecurring({
  getCategoryList,
  getActiveSources,
  getCategoryMeta,
}: FinanceRecurringProps) {
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RecurringFormState>(emptyRecurringForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const recurringQuery = useQuery<RecurringTransaction[]>({
    queryKey: ['finance', 'recurring'],
    queryFn: async () => {
      const res = await fetch('/api/finance/recurring');
      if (!res.ok) throw new Error('Gagal memuat transaksi berulang');
      return (await res.json()).recurring ?? [];
    },
    staleTime: 30_000,
    retry: 1,
  });

  const recurring = useMemo(
    () => (Array.isArray(recurringQuery.data) ? recurringQuery.data : []),
    [recurringQuery.data]
  );

  const sourceNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of getActiveSources()) map.set(s.id, s.name);
    return map;
  }, [getActiveSources]);

  const invalidate = () => {
    // Recurring + transaksi + dashboard — semua bisa berubah setelah proses.
    queryClient.invalidateQueries({ queryKey: ['finance'] });
    // CONNECTED-APP: "Proses Sekarang" membuat transaksi nyata — kartu
    // keuangan di tab Progres (['dashboard', …, refreshKey]) ikut menyala.
    triggerRefresh();
  };

  // ── Dialog helpers ──────────────────────────────────────────────────────
  const openNew = () => {
    setForm(emptyRecurringForm());
    setFormOpen(true);
  };

  const openEdit = (rt: RecurringTransaction) => {
    setForm(formFromRecurring(rt));
    setFormOpen(true);
  };

  // FIX-1/6-b: dialog tak bisa ditutup saat submit in-flight.
  const handleFormOpenChange = (next: boolean) => {
    if (submitting) return;
    setFormOpen(next);
  };

  const handleSubmit = async () => {
    if (submitting) return; // guard double-submit
    if (!form.name.trim()) { toast.error('Masukkan nama transaksi berulang'); return; }
    const amount = amountFromInput(form.amount);
    if (!amount || amount <= 0) { toast.error('Masukkan jumlah yang valid'); return; }
    if (!form.category) { toast.error('Pilih kategori'); return; }
    if (!form.startDate) { toast.error('Pilih tanggal mulai'); return; }

    const payload = {
      name: form.name.trim(),
      amount,
      type: form.type,
      category: form.category,
      sourceId: form.sourceId || null,
      frequency: form.frequency,
      startDate: form.startDate,
    };

    setSubmitting(true);
    try {
      const res = form.id
        ? await fetch(`/api/finance/recurring/${form.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/finance/recurring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        toast.success(form.id ? 'Transaksi berulang berhasil diupdate' : 'Transaksi berulang berhasil ditambahkan');
        setFormOpen(false);
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || (form.id ? 'Gagal mengupdate transaksi berulang' : 'Gagal menambahkan transaksi berulang'));
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      // FIX-1/6-b: reset SELALU di finally — dialog tidak boleh stuck
      // "Menyimpan…" saat API error.
      setSubmitting(false);
    }
  };

  const handleProcess = async (rt: RecurringTransaction) => {
    if (processingId) return;
    setProcessingId(rt.id);
    try {
      const res = await fetch(`/api/finance/recurring/${rt.id}/process`, { method: 'POST' });
      if (res.ok) {
        toast.success(`Transaksi "${rt.name}" diproses — ${formatRupiah(rt.amount)}`);
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Gagal memproses transaksi berulang');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    try {
      const res = await fetch(`/api/finance/recurring/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Transaksi berulang berhasil dihapus');
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Gagal menghapus transaksi berulang');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      // FIX-1/6-b: reset state dialog hapus juga di finally.
      setDeletingId(null);
    }
  };

  const deleting = recurring.find((r) => r.id === deletingId) ?? null;
  const isExpense = form.type !== 'income';
  const categoryOptions = getCategoryList(form.type === 'income' ? 'income' : 'expense');
  const sourceOptions = getActiveSources();

  // ── Error state ──────────────────────────────────────────────────────────
  if (recurringQuery.isError) {
    return (
      <div className="premium-card rounded-2xl mt-4">
        <div className="premium-empty min-h-[16rem]">
          <div className="premium-empty-orb" aria-hidden="true">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Gagal memuat transaksi berulang</p>
          <p className="text-xs text-muted-foreground">Coba lagi dalam sejenak</p>
          <Button size="sm" variant="outline" className="h-8 text-xs mt-1" onClick={() => { void recurringQuery.refetch(); }}>
            <RefreshCw className="h-3 w-3" /> Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (recurringQuery.isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="chip-icon chip-violet h-7 w-7" aria-hidden="true">
            <Repeat className="h-3.5 w-3.5" />
          </span>
          Transaksi Berulang
        </h3>
        <Button size="sm" className="h-9 btn-primary-gradient anim-press shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" /> Berulang Baru
        </Button>
      </div>

      {/* Daftar recurring */}
      {recurring.length === 0 ? (
        <div className="premium-card rounded-2xl">
          <div className="premium-empty min-h-[16rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Repeat className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">Belum ada transaksi berulang</p>
            <p className="text-xs text-muted-foreground">
              Otomatiskan pencatatan rutin seperti gaji, sewa, atau langganan.
            </p>
            <Button size="sm" className="h-8 text-xs mt-1 btn-primary-gradient" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Buat Berulang Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="premium-card premium-card-sheen rounded-2xl p-2 sm:p-3 space-y-1.5 anim-stagger">
          {recurring.map((rt, idx) => {
            const meta = getCategoryMeta(rt.category ?? '');
            const income = rt.type === 'income';
            const sourceName = rt.sourceId ? (sourceNameById.get(rt.sourceId) ?? null) : null;
            const startDate = rt.startDate ? formatDateShort(jakartaDateKey(new Date(rt.startDate))) : null;
            return (
              <div
                key={rt.id}
                className="premium-list-item px-3! py-2.5!"
                style={{ '--stagger': idx } as CSSProperties}
              >
                <span
                  className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  style={{ backgroundColor: tintFromColor(meta.color) }}
                  aria-hidden="true"
                >
                  {meta.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-medium truncate">{rt.name}</p>
                    {!rt.isActive && (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 shrink-0">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {FREQ_LABEL[rt.frequency] ?? rt.frequency} · {rt.category}
                    {sourceName ? ` · ${sourceName}` : ''}
                    {startDate ? ` · mulai ${startDate}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      income
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    )}
                  >
                    {income ? '+' : '−'}{formatRupiah(rt.amount)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] px-2 anim-press"
                      onClick={() => { void handleProcess(rt); }}
                      disabled={processingId !== null || !rt.isActive}
                      title={rt.isActive ? 'Buat 1 transaksi instance sekarang' : 'Transaksi berulang tidak aktif'}
                    >
                      <Play className="h-3 w-3" />
                      {processingId === rt.id ? 'Memproses…' : 'Proses Sekarang'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(rt)}
                      aria-label={`Edit transaksi berulang ${rt.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(rt.id)}
                      aria-label={`Hapus transaksi berulang ${rt.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog tambah/edit recurring ── */}
      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
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
            <Button variant="outline" onClick={() => handleFormOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button
              className={cn('btn-primary-gradient', isExpense && 'bg-destructive hover:bg-destructive')}
              onClick={() => { void handleSubmit(); }}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : form.id ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Konfirmasi hapus recurring ── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              Hapus Transaksi Berulang?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleting?.name}</strong> akan dihapus. Transaksi instance
              yang sudah dibuat tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive"
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
