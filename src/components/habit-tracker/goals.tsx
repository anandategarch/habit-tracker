'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Target } from 'lucide-react';
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

  const { data: goals = null, isLoading: loading } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await fetch('/api/goals');
      if (!res.ok) throw new Error('Failed to fetch goals');
      return res.json();
    },
    staleTime: 30_000,
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

  if (loading || goals === null) {
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

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Tujuan</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-primary font-medium">Selesai</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {stats.completed}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-primary font-medium">Sedang Berjalan</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {stats.inProgress}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Goals list */}
      {goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4">
              <Target className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-medium text-sm mb-1">Belum ada tujuan</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Buat tujuan pertama kamu dan pecah jadi milestone untuk melacak progress.
            </p>
            <Button
              onClick={openNewForm}
              className="mt-4"
            >
              <Plus className="h-4 w-4" />
              Tujuan Baru
            </Button>
          </CardContent>
        </Card>
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
