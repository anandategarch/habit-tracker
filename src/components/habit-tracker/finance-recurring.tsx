'use client';

// ── Recurring Transactions UI (PHASE2-FINANCE-1) ─────────────────────────
//
// Self-contained sub-tab: lists all recurring transaction templates and
// provides Add/Edit/Delete + a "Proses Sekarang" button that manually
// triggers the process endpoint to create due transactions.
//
// Concept from Actual Budget + Firefly III: user defines a schedule
// (frequency, interval, dayOfMonth/dayOfWeek) and the system auto-creates
// transactions on that schedule.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit3, Trash2, RefreshCw, Repeat, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { formatRupiah } from './finance-types';
import {
  type RecurringTransaction,
  type CategoryOption,
  type SourceOption,
  frequencyLabel,
  computeNextDue,
  formatNextRun,
  type RecurringFormState,
  emptyForm,
  formFromRecurring,
  formToPayload,
} from './finance-recurring-helpers';
import { RecurringFormDialog } from './finance-recurring-dialog';

// ── Types ─────────────────────────────────────────────────────────────────

interface FinanceRecurringProps {
  /** Returns the category list for the given type (expense/income). */
  getCategoryList: (type: string) => CategoryOption[];
  /** Returns the active source list for the source dropdown. */
  getActiveSources: () => SourceOption[];
  /** Resolve emoji + color for a category name (used in card display). */
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

// ── Component ────────────────────────────────────────────────────────────

export default function FinanceRecurring({
  getCategoryList,
  getActiveSources,
  getCategoryMeta,
}: FinanceRecurringProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [form, setForm] = useState<RecurringFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);

  // ── Data fetch ──
  const { data: recurring = [], isLoading } = useQuery<RecurringTransaction[]>({
    queryKey: ['finance', 'recurring'],
    queryFn: async () => {
      const res = await fetch('/api/finance/recurring');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'recurring'] });
    // Recurring creates real transactions → invalidate transaction list too.
    queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/finance/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal membuat transaksi berulang');
      }
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id: string }) => {
      const res = await fetch('/api/finance/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal memperbarui transaksi berulang');
      }
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finance/recurring?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menghapus transaksi berulang');
      }
      return res.json();
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (r: RecurringTransaction) => {
    setEditing(r);
    setForm(formFromRecurring(r));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    // Task 4-b A.6: alert() → toast (no browser popups inside the app).
    if (!form.category) {
      toast.error('Pilih kategori dulu');
      return;
    }
    if (!form.amount || parseInt(form.amount.replace(/[^\d]/g, '') || '0', 10) <= 0) {
      toast.error('Jumlah harus lebih dari 0');
      return;
    }
    if (form.frequency === 'monthly' && (!form.dayOfMonth || parseInt(form.dayOfMonth, 10) < 1 || parseInt(form.dayOfMonth, 10) > 31)) {
      toast.error('Hari (tgl) harus 1-31');
      return;
    }
    setSubmitting(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await updateMutation.mutateAsync({ ...payload, id: editing.id });
        toast.success('Transaksi berulang diperbarui');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Transaksi berulang dibuat');
      }
      invalidateAll();
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success('Transaksi berulang dihapus');
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setDeletingId(null);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/finance/recurring/process', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses');
      }
      const { processed, skipped, total } = data;
      setProcessResult(
        processed > 0
          ? `✓ ${processed} transaksi dibuat, ${skipped} dilewati (total ${total})`
          : `Tidak ada yang jatuh tempo. ${skipped} dilewati (total ${total})`
      );
      invalidateAll();
    } catch (e) {
      setProcessResult(`✗ ${e instanceof Error ? e.message : 'Terjadi kesalahan'}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Transaksi berulang otomatis (mis. sewa, langganan, gaji)
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleProcess}
            disabled={processing || recurring.length === 0}
          >
            <RefreshCw className={cn('h-4 w-4', processing && 'animate-spin')} />
            {processing ? 'Memproses...' : 'Proses Sekarang'}
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>
      </div>

      {/* Process result toast-like banner */}
      {processResult && (
        <div
          className={cn(
            'text-xs rounded-md border px-3 py-2',
            processResult.startsWith('✓')
              ? 'border-success/30 bg-success/10 text-success'
              : processResult.startsWith('✗')
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border bg-muted/40 text-muted-foreground'
          )}
        >
          {processResult}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : recurring.length === 0 ? (
        /* PREMIUM-UI: empty state dengan orb ilustrasi + CTA gradient. */
        <div
          className="premium-card premium-card-sheen rounded-2xl premium-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <div className="premium-empty min-h-[20rem] sm:min-h-[22rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Repeat className="h-9 w-9 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight mt-2">
              Otomatiskan Tagihan Rutinmu
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Sewa, langganan, atau gaji — buat jadwal sekali dan transaksinya
              tercatat otomatis setiap periodenya.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              Buat Jadwal Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {recurring.map((r, idx) => {
            const meta = getCategoryMeta(r.category);
            const isExpense = r.type === 'expense';
            const next = computeNextDue(r);
            const isOverdue =
              next && next.getTime() < Date.now() && r.isActive;
            return (
              /* PREMIUM-UI: bare div .premium-card (bukan Card shadcn —
                 .card-shadow-premium unlayered akan menimpa shadow premium,
                 lihat worklog 2-c) + avatar emoji squircle tint + nominal
                 rata kanan (rose pengeluaran / emerald pemasukan) — pola
                 .premium-list-item ditingkatkan jadi kartu section. */
              <div
                key={r.id}
                className={cn(
                  'group premium-card premium-card-sheen rounded-2xl p-4 anim-stagger',
                  !r.isActive && 'opacity-60',
                  isOverdue && 'ring-1 ring-amber-500/30 dark:ring-amber-500/40'
                )}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className="h-9 w-9 rounded-xl grid place-items-center text-lg shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                      style={{ backgroundColor: `${meta.color}20` }}
                      aria-hidden="true"
                    >
                      {meta.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold truncate">
                          {r.description || r.category}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] py-0 px-1.5',
                            isExpense
                              ? 'text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          )}
                        >
                          {isExpense ? 'Pengeluaran' : 'Pemasukan'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          <Repeat className="h-2.5 w-2.5" />
                          {frequencyLabel(r)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {r.category} · {r.source}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <CalendarClock className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {r.isActive ? formatNextRun(r) : 'Dijeda'}
                          {r.lastRunAt && (
                            <span className="ml-1">
                              · terakhir:{' '}
                              {new Intl.DateTimeFormat('id-ID', {
                                day: 'numeric',
                                month: 'short',
                              }).format(new Date(r.lastRunAt))}
                            </span>
                          )}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={cn(
                        'text-sm font-bold tabular-nums',
                        isExpense
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      )}
                      aria-label={`Jumlah ${isExpense ? 'pengeluaran' : 'pemasukan'} ${formatRupiah(r.amount)} ${frequencyLabel(r)}`}
                    >
                      {isExpense ? '−' : '+'}{formatRupiah(r.amount)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={r.isActive}
                        onCheckedChange={async (checked) => {
                          try {
                            await updateMutation.mutateAsync({
                              id: r.id,
                              isActive: checked,
                            });
                            invalidateAll();
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : 'Gagal mengubah status'
                            );
                          }
                        }}
                        aria-label="Aktif/nonaktifkan"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit transaksi berulang ${r.description || r.category}`}
                        onClick={() => openEdit(r)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Hapus transaksi berulang ${r.description || r.category}`}
                        onClick={() => setDeletingId(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ADD/EDIT DIALOG ─── */}
      <RecurringFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        submitting={submitting}
        onSubmit={handleSubmit}
        getCategoryList={getCategoryList}
        getActiveSources={getActiveSources}
      />

      {/* ─── DELETE CONFIRMATION ─── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi Berulang</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus transaksi berulang ini? Transaksi yang sudah
              dibuat sebelumnya tidak akan ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive text-white"
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
