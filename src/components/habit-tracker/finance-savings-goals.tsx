'use client';

// ─────────────────────────────────────────────────────────────────────────
// Savings Goals (Tabungan) — Firefly III "piggy banks" inspired feature.
//
// User sets named savings goals (e.g. "Liburan" Rp 10jt) and tracks progress
// via the Tambah Tabungan (+) / Tarik (−) buttons. Goals auto-mark
// `isCompleted` when currentAmount >= targetAmount and fire confetti 🎉.
//
// Data flows through React Query + the /api/finance/savings-goals routes.
// The collection PUT endpoint accepts `{ id, delta }` for the quick-action
// adjust (positive = tambah, negative = tarik). The API clamps at >= 0.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Minus,
  Pencil,
  Trash2,
  Target,
  CheckCircle2,
  CalendarClock,
  PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { celebrate } from '@/lib/confetti';
import {
  formatRupiah,
  parseNominalInput,
  type FundSource,
} from './finance-types';
import {
  type SavingsGoal,
  type AdjustResponse,
  type GoalFormState,
  EMPTY_FORM,
  deadlineInfo,
} from './finance-savings-goals-helpers';
import {
  SavingsGoalFormDialog,
  SavingsGoalAdjustDialog,
  SavingsGoalDeleteDialog,
} from './finance-savings-goals-dialogs';

// ── Component ──────────────────────────────────────────────────────────────

export default function FinanceSavingsGoals() {
  const queryClient = useQueryClient();

  // ── Dialog state ──────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Quick-action adjust dialog (Tambah Tabungan / Tarik) state.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustGoal, setAdjustGoal] = useState<SavingsGoal | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  // Direction: 'add' for Tambah Tabungan, 'withdraw' for Tarik.
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'withdraw'>('add');

  // Delete confirmation.
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Ref to the celebration anchor — used to position the confetti burst.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: goals = [], isLoading: goalsLoading } = useQuery<SavingsGoal[]>({
    queryKey: ['finance', 'savings-goals'],
    queryFn: async () => {
      const res = await fetch('/api/finance/savings-goals');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15_000,
  });

  const { data: sources = [] } = useQuery<FundSource[]>({
    queryKey: ['finance', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/finance/sources');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  // ── Derived: aggregate stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const activeCount = goals.filter((g) => !g.isCompleted).length;
    const completedCount = goals.filter((g) => g.isCompleted).length;
    return {
      totalSaved,
      totalTarget,
      activeCount,
      completedCount,
      pct: totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0,
    };
  }, [goals]);

  // ── Helpers ───────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'savings-goals'] });
    // Net worth depends on fund source balances, which the savings goals
    // are NOT linked to (currentAmount is independent of FundSource.balance).
    // We still invalidate net-worth defensively in case future schema changes
    // tie them together.
    queryClient.invalidateQueries({ queryKey: ['finance', 'net-worth'] });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (g: SavingsGoal) => {
    setEditingId(g.id);
    setForm({
      name: g.name,
      emoji: g.emoji,
      targetAmount: g.targetAmount ? String(g.targetAmount) : '',
      currentAmount: g.currentAmount ? String(g.currentAmount) : '',
      sourceName: g.sourceName ?? '',
      deadline: g.deadline ? g.deadline.slice(0, 10) : '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    // Validate required fields. We use simple checks here — the API also
    // runs Zod validation, but failing early gives a cleaner UX.
    const name = form.name.trim();
    if (!name) {
      toast.error('Nama tabungan wajib diisi');
      return;
    }
    const target = parseInt(parseNominalInput(form.targetAmount), 10);
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('Target tabungan harus lebih dari 0');
      return;
    }
    const current = form.currentAmount
      ? parseInt(parseNominalInput(form.currentAmount), 10)
      : 0;
    if (!Number.isFinite(current) || current < 0) {
      toast.error('Saldo awal tidak valid');
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      emoji: form.emoji,
      targetAmount: target,
      currentAmount: current,
      sourceName: form.sourceName || null,
      deadline: form.deadline ? new Date(form.deadline + 'T00:00:00+07:00').toISOString() : null,
    };

    setSubmitting(true);
    try {
      const isEdit = !!editingId;
      const url = isEdit
        ? `/api/finance/savings-goals/${editingId}`
        : '/api/finance/savings-goals';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error || 'Gagal menyimpan tabungan');
        return;
      }
      // If we just transitioned a goal to completed via the edit dialog
      // (e.g. user set currentAmount >= targetAmount), fire confetti.
      const data = (await res.json()) as SavingsGoal & { justCompleted?: boolean };
      if (isEdit && data.justCompleted) {
        celebrate({ emojis: [form.emoji, '🎉', '⭐'] });
        toast.success(`🎉 Tabungan "${name}" tercapai!`);
      } else {
        toast.success(isEdit ? 'Tabungan diperbarui' : 'Tabungan dibuat');
      }
      setFormOpen(false);
      invalidateAll();
    } catch {
      toast.error('Gagal menyimpan tabungan');
    }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/finance/savings-goals/${deleteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error('Gagal menghapus tabungan');
        return;
      }
      toast.success('Tabungan dihapus');
      invalidateAll();
    } catch {
      toast.error('Gagal menghapus tabungan');
    }
    setDeleteId(null);
  };

  // ── Quick adjust (Tambah / Tarik) ─────────────────────────────────────
  const openAdjust = (g: SavingsGoal, direction: 'add' | 'withdraw') => {
    setAdjustGoal(g);
    setAdjustDirection(direction);
    setAdjustAmount('');
    setAdjustOpen(true);
  };

  // 1-tap quick-add chips (Task 4-b A.3) — TRUE 1-tap: reuses the EXISTING
  // quick-adjust endpoint (PUT /api/finance/savings-goals/:id with `{ delta }`,
  // same call shape as handleAdjust below) but skips the dialog. Optimistic
  // UI: cache is patched via setQueryData immediately (clamped at >= 0,
  // mirroring the API), then invalidated to reconcile with the server. On
  // failure the refetch rolls the optimistic value back + an error toast.
  const handleQuickAdd = async (g: SavingsGoal, delta: number) => {
    // Optimistic patch — same query key the useQuery above subscribes to.
    queryClient.setQueryData<SavingsGoal[]>(['finance', 'savings-goals'], (old) =>
      old
        ? old.map(x =>
            x.id === g.id
              ? { ...x, currentAmount: Math.max(0, x.currentAmount + delta) }
              : x,
          )
        : old,
    );
    try {
      const res = await fetch(`/api/finance/savings-goals/${g.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error || 'Gagal memperbarui tabungan');
        invalidateAll(); // rollback via refetch
        return;
      }
      const data = (await res.json()) as AdjustResponse;
      if (data.justCompleted) {
        // Goal crossed the finish line on this chip tap — celebrate!
        celebrate({ emojis: [g.emoji, '🎉', '🏆', '⭐'] });
        toast.success(`🎉 Selamat! Tabungan "${g.name}" tercapai!`);
      } else {
        toast.success(`+${formatRupiah(delta)} ditambahkan ke "${g.name}"`);
      }
      invalidateAll();
    } catch {
      toast.error('Gagal memperbarui tabungan');
      invalidateAll(); // rollback via refetch
    }
  };

  const handleAdjust = async () => {
    if (!adjustGoal) return;
    const raw = parseNominalInput(adjustAmount);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Masukkan jumlah yang valid');
      return;
    }
    const delta = adjustDirection === 'add' ? n : -n;

    if (adjustDirection === 'withdraw' && n > adjustGoal.currentAmount) {
      toast.error('Jumlah tarik melebihi saldo tabungan');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/finance/savings-goals/${adjustGoal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as { error?: string }).error || 'Gagal memperbarui tabungan');
        return;
      }
      const data = (await res.json()) as AdjustResponse;
      if (data.justCompleted) {
        // 🎉 Goal crossed the finish line on this adjust call — celebrate!
        celebrate({ emojis: [adjustGoal.emoji, '🎉', '🏆', '⭐'] });
        toast.success(`🎉 Selamat! Tabungan "${adjustGoal.name}" tercapai!`);
      } else {
        toast.success(
          adjustDirection === 'add'
            ? `+${formatRupiah(n)} ditambahkan ke "${adjustGoal.name}"`
            : `−${formatRupiah(n)} ditarik dari "${adjustGoal.name}"`
        );
      }
      setAdjustOpen(false);
      invalidateAll();
    } catch {
      toast.error('Gagal memperbarui tabungan');
    }
    setSubmitting(false);
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (goalsLoading) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* ── Header + summary ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Tetapkan target tabungan dan pantau progresnya.
          </p>
          {goals.length > 0 && (
            /* PREMIUM-UI: ringkasan sebagai pill chip-soft (bukan Badge
               polos) — konsisten dgn chip-soft di area premium lain. */
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="chip-soft chip-soft-teal rounded-full! h-6 px-2.5 gap-1 text-[11px] font-semibold inline-flex items-center">
                <Target className="h-3 w-3" aria-hidden="true" />
                {stats.activeCount} aktif
              </span>
              {stats.completedCount > 0 && (
                <span className="chip-soft bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300 rounded-full! h-6 px-2.5 gap-1 text-[11px] font-semibold inline-flex items-center">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {stats.completedCount} tercapai
                </span>
              )}
              <span className="chip-soft bg-muted text-muted-foreground rounded-full! h-6 px-2.5 text-[11px] font-semibold inline-flex items-center tabular-nums">
                Total {formatRupiah(stats.totalSaved)} / {formatRupiah(stats.totalTarget)}
              </span>
            </div>
          )}
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" />
          Tambah Tabungan
        </Button>
      </div>

      {/* ── Empty state — PREMIUM-UI: orb + headline + CTA gradient ── */}
      {goals.length === 0 ? (
        <div
          className="premium-card premium-card-sheen rounded-2xl premium-fade-up"
          style={{ animationDelay: '60ms' }}
        >
          <div className="premium-empty min-h-[22rem] sm:min-h-[24rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Target className="h-9 w-9 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight mt-2">
              Mulai Tabungan Pertamamu
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Liburan, dana darurat, atau barang impian — tetapkan targetnya
              dan pantau progresnya di sini.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Buat Tabungan Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {goals.map((g, idx) => {
            const pct = g.targetAmount > 0
              ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100))
              : 0;
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            const dl = deadlineInfo(g);
            const sourceEmoji = sources.find((s) => s.name === g.sourceName)?.emoji;

            return (
              <div
                key={g.id}
                ref={(el) => { cardRefs.current[g.id] = el; }}
                className={cn(
                  'group relative premium-card premium-card-sheen premium-card-hover rounded-2xl p-4 sm:p-5 anim-stagger',
                  g.isCompleted && 'ring-1 ring-emerald-500/30 dark:ring-emerald-500/40'
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Top row: emoji + name + actions */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="h-10 w-10 rounded-xl grid place-items-center text-xl shrink-0 ring-1 ring-black/5 dark:ring-white/10 bg-muted/50"
                      aria-hidden="true"
                    >
                      {g.emoji}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate">{g.name}</h3>
                      {g.sourceName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {sourceEmoji} {g.sourceName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit tabungan ${g.name}`} onClick={() => openEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={`Hapus tabungan ${g.name}`} onClick={() => setDeleteId(g.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Current vs target */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="premium-stat text-lg">{formatRupiah(g.currentAmount)}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ {formatRupiah(g.targetAmount)}</span>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        g.isCompleted
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : pct >= 80
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {g.isCompleted ? '✓ 100%' : `${pct}%`}
                    </span>
                  </div>

                  <Progress
                    value={pct}
                    className={cn(
                      'h-2 anim-progress-fill',
                      g.isCompleted && '[&>div]:bg-emerald-500',
                      !g.isCompleted && pct >= 80 && '[&>div]:bg-amber-500'
                    )}
                  />

                  {/* 1-tap quick-add chips (Task 4-b A.3) — pills kecil di
                      bawah progress bar: +50rb / +100rb / Sisa (langsung
                      memanggil endpoint adjust yang sama, optimistic UI). */}
                  {!g.isCompleted && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(g, 50_000)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        aria-label={`Tambah Rp50.000 ke tabungan ${g.name}`}
                      >
                        +Rp50rb
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(g, 100_000)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        aria-label={`Tambah Rp100.000 ke tabungan ${g.name}`}
                      >
                        +Rp100rb
                      </button>
                      {remaining > 0 && remaining !== 50_000 && remaining !== 100_000 && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(g, remaining)}
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          aria-label={`Tambah sisa ${formatRupiah(remaining)} ke tabungan ${g.name}`}
                          title={`Tambah sisa ${formatRupiah(remaining)}`}
                        >
                          Sisa
                        </button>
                      )}
                    </div>
                  )}

                  {/* Footer: remaining + deadline */}
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 mt-1">
                    {g.isCompleted ? (
                      <span className="text-xs font-medium text-success inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Tercapai
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sisa {formatRupiah(remaining)}
                      </span>
                    )}
                    {dl && (
                      <span
                        className={cn(
                          'text-xs inline-flex items-center gap-0.5',
                          dl.past
                            ? 'text-muted-foreground'
                            : dl.urgent
                              ? 'text-destructive font-medium'
                              : 'text-muted-foreground'
                        )}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {dl.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick actions: Tambah / Tarik */}
                {!g.isCompleted && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-success border-success/30 hover:bg-success/10 hover:text-success"
                      onClick={() => openAdjust(g, 'add')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Tambah
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => openAdjust(g, 'withdraw')}
                      disabled={g.currentAmount <= 0}
                    >
                      <Minus className="h-3.5 w-3.5" />
                      Tarik
                    </Button>
                  </div>
                )}

                {/* Completed celebration ribbon */}
                {g.isCompleted && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-success bg-success/10 rounded-lg py-1.5">
                    <PartyPopper className="h-3.5 w-3.5" />
                    Selamat, target tercapai! 🎉
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ADD / EDIT DIALOG ─── */}
      <SavingsGoalFormDialog
        open={formOpen}
        onOpenChange={(o) => { if (!submitting) setFormOpen(o); }}
        editing={!!editingId}
        form={form}
        setForm={setForm}
        submitting={submitting}
        onSubmit={handleSubmit}
        sources={sources}
      />

      {/* ─── ADJUST (TAMBAH / TARIK) DIALOG ─── */}
      <SavingsGoalAdjustDialog
        open={adjustOpen}
        onOpenChange={(o) => { if (!submitting) setAdjustOpen(o); }}
        goal={adjustGoal}
        adjustAmount={adjustAmount}
        setAdjustAmount={setAdjustAmount}
        adjustDirection={adjustDirection}
        submitting={submitting}
        onSubmit={handleAdjust}
      />

      {/* ─── DELETE CONFIRMATION ─── */}
      <SavingsGoalDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => { if (!submitting) setDeleteId(o ? deleteId : null); }}
        submitting={submitting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
