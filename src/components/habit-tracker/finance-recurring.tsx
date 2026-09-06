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
import { Card, CardContent } from '@/components/ui/card';
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
    if (!form.category) {
      alert('Pilih kategori dulu');
      return;
    }
    if (!form.amount || parseInt(form.amount.replace(/[^\d]/g, '') || '0', 10) <= 0) {
      alert('Jumlah harus lebih dari 0');
      return;
    }
    if (form.frequency === 'monthly' && (!form.dayOfMonth || parseInt(form.dayOfMonth, 10) < 1 || parseInt(form.dayOfMonth, 10) > 31)) {
      alert('Hari (tgl) harus 1-31');
      return;
    }
    setSubmitting(true);
    try {
      const payload = formToPayload(form);
      if (editing) {
        await updateMutation.mutateAsync({ ...payload, id: editing.id });
      } else {
        await createMutation.mutateAsync(payload);
      }
      invalidateAll();
      setDialogOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      invalidateAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Terjadi kesalahan');
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
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <Repeat className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Belum ada transaksi berulang</p>
            <p className="text-xs mt-1">
              Buat jadwal otomatis untuk tagihan, langganan, atau pemasukan rutin
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {recurring.map((r) => {
            const meta = getCategoryMeta(r.category);
            const isExpense = r.type === 'expense';
            const next = computeNextDue(r);
            const isOverdue =
              next && next.getTime() < Date.now() && r.isActive;
            return (
              <div
                key={r.id}
                className={cn(
                  'group rounded-2xl bg-card p-4 transition-all hover:shadow-md',
                  !r.isActive && 'opacity-60',
                  isOverdue && 'ring-1 ring-warning/40'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: `${meta.color}22` }}
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
                              ? 'text-destructive border-destructive/30'
                              : 'text-success border-success/30'
                          )}
                        >
                          {isExpense ? 'Pengeluaran' : 'Pemasukan'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          <Repeat className="h-2.5 w-2.5" />
                          {frequencyLabel(r)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={cn(
                            'text-sm font-bold',
                            isExpense ? 'text-destructive' : 'text-success'
                          )}
                        >
                          {isExpense ? '-' : '+'}
                          {formatRupiah(r.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {r.category} · {r.source}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
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
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                          alert(
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
                      onClick={() => openEdit(r)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
