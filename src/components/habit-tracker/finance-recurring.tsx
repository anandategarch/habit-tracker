'use client';

// components/habit-tracker/finance-recurring.tsx — sub-tab "Recurring":
// transaksi berulang (Actual Budget / Firefly III inspired). Root komposisi
// (Task 71-i): baris daftar → finance-recurring-row.tsx, dialog tambah/edit →
// finance-recurring-form-dialog.tsx, konfirmasi hapus →
// finance-recurring-delete-dialog.tsx, sektor status →
// finance-recurring-states.tsx, bentuk form → finance-recurring-form-state.ts.
//
// - Tombol "Proses Sekarang" (POST /api/finance/recurring/[id]/process →
//   buat 1 transaksi instance; toast + invalidate ['finance'] — race server
//   di-guard CAS, 409 ditampilkan apa adanya).
// - Semua notifikasi memakai toast Indonesia (bukan alert()).
// - FIX-1/6-b: setSubmitting(false) / reset state SELALU di blok finally;
//   onOpenChange dialog di-guard `submitting` supaya tidak pernah stuck.

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRupiah, amountFromInput } from './finance-types';
import { useAppStore } from '@/store/app-store';
import type { RecurringTransaction } from './finance-types';
import {
  emptyRecurringForm,
  formFromRecurring,
  type RecurringFormState,
} from './finance-recurring-form-state';
import { RecurringRow } from './finance-recurring-row';
import { RecurringFormDialog } from './finance-recurring-form-dialog';
import { RecurringDeleteDialog } from './finance-recurring-delete-dialog';
import {
  RecurringEmptyState,
  RecurringErrorState,
  RecurringLoadingState,
} from './finance-recurring-states';

interface FinanceRecurringProps {
  getCategoryList: (type: string) => Array<{ value: string; emoji: string; color: string }>;
  getActiveSources: () => Array<{ id: string; name: string; emoji: string; balance: number; order: number }>;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
}

export default function FinanceRecurring({
  getCategoryList,
  getActiveSources,
  getCategoryMeta,
}: FinanceRecurringProps) {
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  // VERIFY-48 (48-c F6): drill-down baris → transaksi kategori terkait.
  const openFinanceFocus = useAppStore((s) => s.openFinanceFocus);
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
  const categoryOptions = getCategoryList(form.type === 'income' ? 'income' : 'expense');
  const sourceOptions = getActiveSources();

  // ── Error state ──────────────────────────────────────────────────────────
  if (recurringQuery.isError) {
    return <RecurringErrorState onRetry={() => { void recurringQuery.refetch(); }} />;
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (recurringQuery.isLoading) {
    return <RecurringLoadingState />;
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
        <RecurringEmptyState onCreate={openNew} />
      ) : (
        <div className="premium-card premium-card-sheen rounded-2xl p-2 sm:p-3 space-y-1.5 anim-stagger">
          {recurring.map((rt, idx) => (
            <RecurringRow
              key={rt.id}
              rt={rt}
              idx={idx}
              sourceName={rt.sourceId ? (sourceNameById.get(rt.sourceId) ?? null) : null}
              processingId={processingId}
              getCategoryMeta={getCategoryMeta}
              onProcess={handleProcess}
              onFocus={(r) => openFinanceFocus({ category: r.category, txType: r.type })}
              onEdit={openEdit}
              onDelete={setDeletingId}
            />
          ))}
        </div>
      )}

      {/* ── Dialog tambah/edit recurring ── */}
      <RecurringFormDialog
        open={formOpen}
        form={form}
        setForm={setForm}
        submitting={submitting}
        categoryOptions={categoryOptions}
        sourceOptions={sourceOptions}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleSubmit}
      />

      {/* ── Konfirmasi hapus recurring ── */}
      <RecurringDeleteDialog
        open={!!deletingId}
        name={deleting?.name}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        onDelete={handleDelete}
      />
    </div>
  );
}
