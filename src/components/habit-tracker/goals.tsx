'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
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
import { Plus, Target, CheckCircle2, Flame, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { useHabitOptions } from '@/hooks/use-habit-options';

// Types / helpers / sub-components extracted during PHASE-A-3
// (see goals-types.ts, goals-helpers.ts, goal-card.tsx, goal-form-dialog.tsx,
// goals-skeleton.tsx). This file is now a thin orchestrator:
// state + queries + handlers + composition of <GoalCard> /
// <GoalFormDialog> / <GoalsSkeleton>. Handlers stay here because they are
// tightly coupled to the query cache + mutation flow (especially the
// BUG-M16 toggleMilestone + BUG-L7 handleCancelGoal fixes).
import { type Goal, type GoalFormData } from './goals-types';
import { EMPTY_FORM, parseMilestones, calcProgress } from './goals-helpers';
import { GoalCard } from './goal-card';
import { GoalFormDialog } from './goal-form-dialog';
import { GoalsSkeleton } from './goals-skeleton';

// ── Component ────────────────────────────────────────────────────────────────

export default function GoalsTab() {
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();
  const { priorityMap } = useHabitOptions();

  const [saving, setSaving] = useState(false);

  // Dialog
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<GoalFormData>({ ...EMPTY_FORM });
  const [newMilestone, setNewMilestone] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  // Expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  // BUGFIX 6-a: the query previously had NO error branch — on fetch failure
  // `isLoading` goes false while `data` stays undefined, so the
  // `loading || goals === null` check below rendered the skeleton forever
  // (no error message, no retry). Surface a premium error state with a
  // retry button instead.
  const { data: goals = null, isLoading: loading, isError, refetch } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await fetch('/api/goals');
      if (!res.ok) throw new Error('Failed to fetch goals');
      return res.json();
    },
    staleTime: 30_000,
    retry: 1,
  });

  const invalidateGoals = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    triggerRefresh();
  }, [queryClient, triggerRefresh]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!goals) return { total: 0, completed: 0, inProgress: 0 };
    return {
      total: goals.length,
      completed: goals.filter((g) => g.status === 'completed').length,
      inProgress: goals.filter((g) => g.status === 'active').length,
    };
  }, [goals]);

  // ── Form handlers ─────────────────────────────────────────────────────────

  function openNewForm() {
    setForm({ ...EMPTY_FORM });
    setNewMilestone('');
    setFormOpen(true);
  }

  function openEditForm(goal: Goal) {
    setForm({
      id: goal.id,
      title: goal.title,
      description: goal.description ?? '',
      deadline: goal.deadline ?? '',
      priority: goal.priority,
      milestones: parseMilestones(goal.milestones),
    });
    setNewMilestone('');
    setFormOpen(true);
  }

  function addMilestone() {
    const text = newMilestone.trim();
    if (!text) return;
    setForm((f) => ({
      ...f,
      milestones: [...f.milestones, { id: crypto.randomUUID(), text, done: false }],
    }));
    setNewMilestone('');
  }

  function removeMilestone(index: number) {
    setForm((f) => ({
      ...f,
      milestones: f.milestones.filter((_, i) => i !== index),
    }));
  }

  function updateMilestoneText(index: number, text: string) {
    setForm((f) => ({
      ...f,
      milestones: f.milestones.map((m, i) => (i === index ? { ...m, text } : m)),
    }));
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Judul tujuan wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        deadline: form.deadline || null,
        priority: form.priority,
        milestones: JSON.stringify(form.milestones),
      };

      let res: Response;
      if (form.id) {
        res = await fetch(`/api/goals/${form.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error('Failed to save goal');

      toast.success(form.id ? 'Tujuan diperbarui' : 'Tujuan dibuat');
      setFormOpen(false);
      invalidateGoals();
    } catch {
      toast.error('Gagal menyimpan tujuan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/goals/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Tujuan dihapus');
      setDeleteTarget(null);
      invalidateGoals();
    } catch {
      toast.error('Gagal menghapus tujuan');
    }
  }

  async function toggleMilestone(goalId: string, index: number, currentMilestones: string, currentStatus: string) {
    const milestones = parseMilestones(currentMilestones);
    milestones[index] = { ...milestones[index], done: !milestones[index].done };

    const newProgress = calcProgress(milestones);
    // BUGHUNT-OTHER-1 BUG-M16: previously this always set status to 'active'
    // when progress < 100, which silently reset 'paused' goals back to
    // 'active' on every milestone toggle. Preserve the current status unless
    // we're transitioning to 'completed' (progress reached 100%).
    const newStatus = newProgress >= 100 ? 'completed' : currentStatus;

    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestones: JSON.stringify(milestones),
          progress: newProgress,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      // Optimistic update
      queryClient.setQueryData<Goal[]>(['goals'], (prev) =>
        prev
          ? prev.map((g) =>
              g.id === goalId
                ? {
                    ...g,
                    milestones: JSON.stringify(milestones),
                    progress: newProgress,
                    status: newStatus,
                  }
                : g
            )
          : prev
      );

      if (newProgress >= 100) {
        toast.success('🎉 Tujuan selesai! Semua milestone sudah diselesaikan.');
      }

      triggerRefresh();
    } catch {
      toast.error('Gagal memperbarui milestone');
      invalidateGoals();
    }
  }

  async function handleCompleteGoal(goal: Goal) {
    if (goal.status === 'completed') return;

    const milestones = parseMilestones(goal.milestones);
    const allDone = milestones.map((m) => ({ ...m, done: true }));

    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress: 100,
          status: 'completed',
          milestones: JSON.stringify(allDone),
        }),
      });

      if (!res.ok) throw new Error('Failed to complete');

      toast.success('🎉 Tujuan ditandai selesai!');
      invalidateGoals();
    } catch {
      toast.error('Gagal menyelesaikan tujuan');
    }
  }

  // BUGHUNT-OTHER-1 BUG-L7: previously the only way to "stop" an active goal
  // was to delete it (which loses the record entirely). Add a Cancel action
  // that flips `status` to 'cancelled' so the goal moves to a separate
  // visual state (greyed out, no longer counted in "in progress" stats)
  // without being deleted.
  async function handleCancelGoal(goal: Goal) {
    if (goal.status === 'cancelled' || goal.status === 'completed') return;
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) throw new Error('Failed to cancel');
      toast.success('Tujuan dibatalkan');
      invalidateGoals();
    } catch {
      toast.error('Gagal membatalkan tujuan');
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return <GoalsSkeleton />;
  }

  // ── Error state (BUGFIX 6-a — see query comment above) ──────────────
  // Previously this branch didn't exist: on fetch failure `loading` flips
  // to false while `goals` stays null, and the check below rendered the
  // skeleton forever.

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tujuan"
          description="Pantau progress menuju target kamu"
        />
        <div className="premium-card premium-card-sheen rounded-2xl">
          <div className="premium-empty">
            <div className="premium-empty-orb">
              <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">Gagal memuat tujuan</p>
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Periksa koneksi kamu, lalu coba lagi.
            </p>
            <Button variant="outline" onClick={() => refetch()} className="mt-3">
              <RefreshCw className="h-4 w-4" />
              Coba Lagi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (goals === null) {
    return <GoalsSkeleton />;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Tujuan"
        description="Pantau progress menuju target kamu"
        action={
          <GoalFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            form={form}
            setForm={setForm}
            newMilestone={newMilestone}
            setNewMilestone={setNewMilestone}
            onCreateNew={openNewForm}
            onAddMilestone={addMilestone}
            onRemoveMilestone={removeMilestone}
            onUpdateMilestoneText={updateMilestoneText}
            onSave={handleSave}
            saving={saving}
          />
        }
      />

      {/* Quick Stats — premium mini stat cards (chip-icon + premium-stat).
          PREMIUM-UI: dipakai <div> polong (bukan komponen Card) — class default
          Card `card-shadow-premium` (unlayered, urutan sumber lebih akhir di
          globals.css) akan menimpa multi-layer shadow .premium-card (pola
          agent 2-a/2-b). Angka 0 tetap terlihat intentional: chip gradien +
          label editorial + premium-stat tabular. */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="premium-card premium-card-sheen rounded-2xl p-3 sm:p-4 premium-fade-up flex flex-col gap-2.5"
          style={{ animationDelay: '40ms' }}
        >
          <span className="chip-icon chip-teal h-9 w-9" aria-hidden="true">
            <Target className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="premium-label min-h-7">Total Tujuan</p>
            <p className="premium-stat text-2xl mt-0.5">{stats.total}</p>
          </div>
        </div>
        <div
          className="premium-card premium-card-sheen rounded-2xl p-3 sm:p-4 premium-fade-up flex flex-col gap-2.5"
          style={{ animationDelay: '90ms' }}
        >
          <span className="chip-icon chip-emerald h-9 w-9" aria-hidden="true">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="premium-label min-h-7">Selesai</p>
            <p className="premium-stat text-2xl mt-0.5 text-success">{stats.completed}</p>
          </div>
        </div>
        <div
          className="premium-card premium-card-sheen rounded-2xl p-3 sm:p-4 premium-fade-up flex flex-col gap-2.5"
          style={{ animationDelay: '140ms' }}
        >
          <span className="chip-icon chip-amber h-9 w-9" aria-hidden="true">
            <Flame className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="premium-label min-h-7">Sedang Berjalan</p>
            <p className="premium-stat text-2xl mt-0.5 text-warning">{stats.inProgress}</p>
          </div>
        </div>
      </div>

      {/* Goals list */}
      {goals.length === 0 ? (
        <div
          className="premium-card premium-card-sheen rounded-2xl premium-fade-up"
          style={{ animationDelay: '190ms' }}
        >
          {/* PREMIUM-UI: empty state dengan orb ilustrasi + headline inspiratif.
              min-h menjaga konten tetap center vertikal di area kosong.
              CTA "Tujuan Baru" (openNewForm) tetap berfungsi. */}
          <div className="premium-empty min-h-[22rem] sm:min-h-[24rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <Target className="h-9 w-9 text-primary" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight mt-2">
              Mulai Milestone Pertamamu
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              Buat tujuan pertama kamu dan pecah jadi milestone kecil —
              progress akan tercatat otomatis di sini.
            </p>
            <Button
              onClick={openNewForm}
              className="mt-3"
            >
              <Plus className="h-4 w-4" />
              Tujuan Baru
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1 custom-scrollbar">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              expanded={expandedId === goal.id}
              priorityMap={priorityMap}
              onEdit={openEditForm}
              onComplete={handleCompleteGoal}
              onCancel={handleCancelGoal}
              onDelete={setDeleteTarget}
              onToggleMilestone={(g, idx) => toggleMilestone(g.id, idx, g.milestones, g.status)}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tujuan</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus{' '}
              <span className="font-medium text-foreground">
                &quot;{deleteTarget?.title}&quot;
              </span>
              ? Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive text-white"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
