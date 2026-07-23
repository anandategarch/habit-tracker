'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
import {
  Plus,
  Target,
  Edit,
  Trash2,
  Calendar,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { getBadgeClass } from '@/lib/label-colors';

// ── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  text: string;
  done: boolean;
}

interface Goal {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  progress: number;
  priority: string;
  status: string;
  milestones: string; // JSON string
  achievement: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GoalFormData {
  id?: string;
  title: string;
  description: string;
  deadline: string;
  priority: string;
  milestones: Milestone[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function parseMilestones(json: string): Milestone[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

function calcProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => m.done).length;
  return Math.round((done / milestones.length) * 100);
}

const EMPTY_FORM: GoalFormData = {
  title: '',
  description: '',
  deadline: '',
  priority: 'Medium',
  milestones: [],
};

// ── Component ────────────────────────────────────────────────────────────────

export default function GoalsTab() {
  const refreshKey = useAppStore(s => s.refreshKey);
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
    queryKey: ['goals', refreshKey],
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
      milestones: [...f.milestones, { text, done: false }],
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
      toast.error('Goal title is required');
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

      toast.success(form.id ? 'Goal updated' : 'Goal created');
      setFormOpen(false);
      invalidateGoals();
    } catch {
      toast.error('Failed to save goal');
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

      toast.success('Goal deleted');
      setDeleteTarget(null);
      invalidateGoals();
    } catch {
      toast.error('Failed to delete goal');
    }
  }

  async function toggleMilestone(goalId: string, index: number, currentMilestones: string) {
    const milestones = parseMilestones(currentMilestones);
    milestones[index] = { ...milestones[index], done: !milestones[index].done };

    const newProgress = calcProgress(milestones);
    const newStatus = newProgress >= 100 ? 'completed' : 'active';

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
      queryClient.setQueryData<Goal[]>(['goals', refreshKey], (prev) =>
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
        toast.success('🎉 Goal completed! All milestones are done.');
      }

      triggerRefresh();
    } catch {
      toast.error('Failed to update milestone');
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

      toast.success('🎉 Goal marked as completed!');
      invalidateGoals();
    } catch {
      toast.error('Failed to complete goal');
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function getProgressColor(progress: number): string {
    if (progress >= 80) return '[&>div]:bg-green-500';
    if (progress >= 50) return '[&>div]:bg-lime-500';
    if (progress >= 25) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-orange-500';
  }

  function renderGoalCard(goal: Goal) {
    const isExpanded = expandedId === goal.id;
    const milestones = parseMilestones(goal.milestones);
    const isCompleted = goal.status === 'completed';
    const isCancelled = goal.status === 'cancelled';
    const isOverdue = goal.deadline && isPast(parseISO(goal.deadline)) && !isCompleted && !isCancelled;

    return (
      <Card
        key={goal.id}
        className={cn(
          'group transition-all hover:shadow-md',
          isCompleted && 'opacity-75',
          isCancelled && 'opacity-50'
        )}
      >
        <CardContent className="p-4 sm:p-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className={cn(
                    'font-semibold text-sm sm:text-base leading-tight',
                    isCompleted && 'line-through text-muted-foreground'
                  )}
                >
                  {goal.title}
                </h3>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0', getBadgeClass(priorityMap[goal.priority]?.color || 'gray'))}
                >
                  {goal.priority}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn('text-[10px] px-1.5 py-0', STATUS_STYLES[goal.status] ?? '')}
                >
                  {goal.status}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    Overdue
                  </Badge>
                )}
              </div>

              {goal.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {goal.description}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEditForm(goal)}
                disabled={isCompleted || isCancelled}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              {goal.status === 'active' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5"
                  onClick={() => handleCompleteGoal(goal)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => setDeleteTarget(goal)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{goal.progress}%</span>
            </div>
            <Progress
              value={goal.progress}
              className={cn('h-2', getProgressColor(goal.progress))}
            />
          </div>

          {/* Footer row: deadline + milestone toggle */}
          <div className="flex items-center justify-between mt-3">
            {goal.deadline ? (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs',
                  isOverdue
                    ? 'text-red-500 font-medium'
                    : 'text-muted-foreground'
                )}
              >
                <Calendar className="h-3 w-3" />
                {format(parseISO(goal.deadline), 'MMM d, yyyy')}
              </span>
            ) : (
              <span />
            )}

            {milestones.length > 0 && (
              <button
                onClick={() => toggleExpand(goal.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {milestones.filter((m) => m.done).length}/{milestones.length} milestones
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            )}
          </div>

          {/* Milestones section */}
          {isExpanded && milestones.length > 0 && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <Separator className="mb-3" />
              <div className="space-y-2">
                {milestones.map((ms, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 group/milestone"
                  >
                    <Checkbox
                      checked={ms.done}
                      disabled={isCompleted || isCancelled}
                      onCheckedChange={() => toggleMilestone(goal.id, idx, goal.milestones)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span
                      className={cn(
                        'text-sm flex-1 transition-colors',
                        ms.done
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      )}
                    >
                      {ms.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderForm() {
    return (
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogTrigger asChild>
          <Button
            onClick={openNewForm}
            className="bg-primary hover:bg-primary text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Goal
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {form.id ? 'Edit Goal' : 'New Goal'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="goal-title">Title *</Label>
              <Input
                id="goal-title"
                placeholder="What do you want to achieve?"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="goal-desc">Description</Label>
              <Textarea
                id="goal-desc"
                placeholder="Describe your goal in detail..."
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Deadline + Priority row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal-deadline">Deadline</Label>
                <Input
                  id="goal-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Milestones */}
            <div className="space-y-3">
              <Label>Milestones</Label>
              <p className="text-xs text-muted-foreground">
                Break your goal into smaller, trackable steps
              </p>

              {/* Existing milestones */}
              {form.milestones.length > 0 && (
                <div className="space-y-2">
                  {form.milestones.map((ms, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          value={ms.text}
                          onChange={(e) => updateMilestoneText(idx, e.target.value)}
                          placeholder="Milestone description"
                          className="h-9 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0"
                        onClick={() => removeMilestone(idx)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add milestone */}
              <div className="flex items-center gap-2">
                <Input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMilestone();
                    }
                  }}
                  placeholder="Add a milestone..."
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                  disabled={!newMilestone.trim()}
                  className="h-9 flex-shrink-0 border-primary/20 text-primary hover:bg-primary/5"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>

              {form.milestones.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {form.milestones.length} milestone{form.milestones.length !== 1 ? 's' : ''} ·{' '}
                  {form.milestones.filter((m) => m.done).length} completed
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="bg-primary hover:bg-primary text-white min-w-[120px]"
              >
                {saving ? 'Saving...' : form.id ? 'Update Goal' : 'Create Goal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading || goals === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-7 w-24" />
          </div>
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-7 w-10" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Goals</h2>
            <p className="text-xs text-muted-foreground">
              Track progress towards your objectives
            </p>
          </div>
        </div>
        {renderForm()}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Goals</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-primary font-medium">Completed</p>
            <p className="text-2xl font-bold mt-1 text-primary">
              {stats.completed}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-primary font-medium">In Progress</p>
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
            <h3 className="font-medium text-sm mb-1">No goals yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Create your first goal and break it down into milestones to track your progress.
            </p>
            <Button
              onClick={openNewForm}
              className="mt-4 bg-primary hover:bg-primary text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1 custom-scrollbar">
          {goals.map((goal) => renderGoalCard(goal))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                &quot;{deleteTarget?.title}&quot;
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}