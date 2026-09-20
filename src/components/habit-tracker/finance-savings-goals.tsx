'use client';

// components/habit-tracker/finance-savings-goals.tsx — sub-tab "Tabungan":
// target tabungan ala "piggy bank" Firefly III (PHASE2-FINANCE-2). Root
// komposisi (Task 71-i): kartu goal → finance-savings-goal-card.tsx, dialog
// tambah/edit → finance-savings-form-dialog.tsx, konfirmasi hapus →
// finance-savings-delete-dialog.tsx, sektor status →
// finance-savings-states.tsx, helper → finance-savings-helpers.ts.
//
// - Quick-chips 1-tap di kartu: PUT /api/finance/savings-goals/[id] body
//   { delta }. GUARD double-tap (6-b FIX-2): quickPendingRef (Set, anti
//   double-tap dalam tick sama) + state quickPendingIds untuk disable chip
//   goal itu selama in-flight; reset di finally.
// - Confetti smallPop saat goal tercapai.
// - FIX-1/6-b: SEMUA setSubmitting(false) / reset state dialog ada di blok
//   `finally` — dialog tidak boleh stuck "Menyimpan…" saat API error
//   (onOpenChange di-guard `submitting`).

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PiggyBank, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { smallPop } from '@/lib/confetti';
import { jakartaDateKey } from '@/lib/timezone';
import type { MouseEvent } from 'react';
import type { SavingsGoal } from './finance-types';
import { formatRupiah, formatNominalInput, amountFromInput } from './finance-types';
import {
  emptyGoalForm,
  isComplete,
  type GoalFormState,
} from './finance-savings-helpers';
import { SavingsGoalCard } from './finance-savings-goal-card';
import { SavingsGoalFormDialog } from './finance-savings-form-dialog';
import { SavingsGoalDeleteDialog } from './finance-savings-delete-dialog';
import {
  SavingsEmptyState,
  SavingsErrorState,
  SavingsLoadingState,
} from './finance-savings-states';

export default function FinanceSavingsGoals() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<GoalFormState>(emptyGoalForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 6-b FIX-2: guard double-tap quick-chip — ref Set (anti double-tap dalam
  // tick yang sama, sebelum state sempat re-render) + state Set (disable
  // chip goal itu selama PUT in-flight). Keduanya direset di finally.
  const quickPendingRef = useRef<Set<string>>(new Set());
  const [quickPendingIds, setQuickPendingIds] = useState<Set<string>>(new Set());

  const goalsQuery = useQuery<SavingsGoal[]>({
    queryKey: ['finance', 'savings'],
    queryFn: async () => {
      const res = await fetch('/api/finance/savings-goals');
      if (!res.ok) throw new Error('Gagal memuat target tabungan');
      return (await res.json()).goals ?? [];
    },
    staleTime: 30_000,
    retry: 1,
  });

  const goals = useMemo(
    () => (Array.isArray(goalsQuery.data) ? goalsQuery.data : []),
    [goalsQuery.data]
  );

  const invalidate = () => {
  //   CONNECTED-APP: KPI Keuangan membaca data yang sama — invalidasi
  //   prefix ['finance'] supaya seluruh domain ikut segar.
    queryClient.invalidateQueries({ queryKey: ['finance'] });
  };

  // ── Quick-chip: PUT { delta } ────────────────────────────────────────────
  const handleQuickChip = async (
    goal: SavingsGoal,
    delta: number,
    e: MouseEvent<HTMLButtonElement>,
  ) => {
    if (quickPendingRef.current.has(goal.id)) return; // double-tap guard
    // Tangkap elemen SEBELUM await — e.currentTarget React menjadi null
    // setelah event dispatch selesai (async), confetti butuh elemen asal.
    const chipEl = e.currentTarget;
    quickPendingRef.current.add(goal.id);
    setQuickPendingIds((prev) => new Set(prev).add(goal.id));
    try {
      const res = await fetch(`/api/finance/savings-goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (res.ok) {
        const updated: SavingsGoal = await res.json();
        if (isComplete(updated)) {
          toast.success(`Target "${goal.name}" tercapai! 🎉`);
          smallPop(chipEl);
        } else {
          toast.success(`+${formatRupiah(delta)} ke "${goal.name}"`);
        }
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Gagal menambah tabungan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      quickPendingRef.current.delete(goal.id);
      setQuickPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(goal.id);
        return next;
      });
    }
  };

  // ── Dialog helpers ──────────────────────────────────────────────────────
  const openNew = () => {
    setForm(emptyGoalForm());
    setFormOpen(true);
  };

  const openEdit = (goal: SavingsGoal) => {
    setForm({
      id: goal.id,
      name: goal.name,
      emoji: goal.emoji ?? '🎯',
      targetAmount: formatNominalInput(String(Math.round(goal.targetAmount ?? 0))),
      currentAmount: formatNominalInput(String(Math.round(goal.currentAmount ?? 0))),
      // Deadline disimpan tengah malam Jakarta — baca via jakartaDateKey
      // (komponen YMD), bukan konversi TZ browser.
      deadline: goal.deadline ? jakartaDateKey(new Date(goal.deadline)) : '',
    });
    setFormOpen(true);
  };

  // FIX-1/6-b: dialog tak bisa ditutup saat submit in-flight (Escape/overlay
  // /Batal mati → tombol nyangkut "Menyimpan…").
  const handleFormOpenChange = (next: boolean) => {
    if (submitting) return;
    setFormOpen(next);
  };

  const handleSubmit = async (e: MouseEvent<HTMLButtonElement>) => {
    if (submitting) return; // guard double-submit
    // Tangkap elemen sebelum await (e.currentTarget null setelah dispatch).
    const submitEl = e.currentTarget;
    if (!form.name.trim()) { toast.error('Masukkan nama target tabungan'); return; }
    const targetAmount = amountFromInput(form.targetAmount);
    if (!targetAmount || targetAmount <= 0) { toast.error('Target tabungan harus lebih dari 0'); return; }
    const currentAmount = amountFromInput(form.currentAmount);
    if (currentAmount < 0) { toast.error('Saldo tabungan tidak valid'); return; }

    const payload = {
      name: form.name.trim(),
      emoji: form.emoji,
      targetAmount,
      currentAmount,
      deadline: form.deadline || null,
    };

    setSubmitting(true);
    try {
      const res = form.id
        ? await fetch(`/api/finance/savings-goals/${form.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/finance/savings-goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        const saved: SavingsGoal = await res.json();
        toast.success(form.id ? 'Target tabungan berhasil diupdate' : 'Target tabungan berhasil dibuat');
        if (isComplete(saved)) smallPop(submitEl);
        setFormOpen(false);
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || (form.id ? 'Gagal mengupdate target tabungan' : 'Gagal membuat target tabungan'));
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      // FIX-1/6-b: reset SELALU di finally — path error API pun melewati
      // reset ini (dulu `return` early saat !res.ok melewati reset → dialog
      // terkunci selamanya).
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    try {
      const res = await fetch(`/api/finance/savings-goals/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Target tabungan berhasil dihapus');
        invalidate();
      } else {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || 'Gagal menghapus target tabungan');
      }
    } catch {
      toast.error('Terjadi kesalahan');
    } finally {
      // FIX-1/6-b: reset state dialog hapus di finally (dulu terlewat).
      setDeletingId(null);
    }
  };

  const deleting = goals.find((g) => g.id === deletingId) ?? null;

  // ── Error state ──────────────────────────────────────────────────────────
  if (goalsQuery.isError) {
    return <SavingsErrorState onRetry={() => { void goalsQuery.refetch(); }} />;
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (goalsQuery.isLoading) {
    return <SavingsLoadingState />;
  }

  return (
    <div className="space-y-3 mt-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="chip-icon chip-lime h-7 w-7" aria-hidden="true">
            <PiggyBank className="h-3.5 w-3.5" />
          </span>
          Target Tabungan
        </h3>
        <Button size="sm" className="h-9 btn-primary-gradient anim-press shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" /> Target Baru
        </Button>
      </div>

      {/* Grid goal / empty state */}
      {goals.length === 0 ? (
        <SavingsEmptyState onCreate={openNew} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {goals.map((goal, idx) => (
            <SavingsGoalCard
              key={goal.id}
              goal={goal}
              idx={idx}
              pending={quickPendingIds.has(goal.id)}
              onQuickChip={handleQuickChip}
              onEdit={openEdit}
              onDelete={setDeletingId}
            />
          ))}
        </div>
      )}

      {/* ── Dialog tambah/edit target ── */}
      <SavingsGoalFormDialog
        open={formOpen}
        form={form}
        setForm={setForm}
        submitting={submitting}
        onOpenChange={handleFormOpenChange}
        onSubmit={handleSubmit}
      />

      {/* ── Konfirmasi hapus target ── */}
      <SavingsGoalDeleteDialog
        open={!!deletingId}
        name={deleting?.name}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        onDelete={handleDelete}
      />
    </div>
  );
}
