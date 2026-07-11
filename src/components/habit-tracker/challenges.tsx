'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
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
  Trophy,
  Flame,
  Clock,
  Edit,
  Trash2,
  Calendar,
} from 'lucide-react';
import { format, differenceInDays, addDays, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  startDate: string;
  endDate: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

type ChallengeStatus = 'active' | 'completed' | 'failed' | 'cancelled';

const DURATION_PRESETS = [
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '21 Days', value: 21 },
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days', value: 90 },
  { label: '365 Days', value: 365 },
];

const STATUS_CONFIG: Record<
  ChallengeStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  active: {
    label: 'Active',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  completed: {
    label: 'Completed',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Challenges() {
  const { refreshKey } = useAppStore();

  // Data
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Challenge | null>(null);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDuration, setFormDuration] = useState('30');
  const [formStartDate, setFormStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await fetch('/api/challenges');
      if (!res.ok) throw new Error('Failed to fetch challenges');
      const data = await res.json();
      setChallenges(data);
    } catch {
      toast.error('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges, refreshKey]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const computedEndDate = useCallback(() => {
    const start = parseISO(formStartDate);
    return format(addDays(start, parseInt(formDuration)), 'yyyy-MM-dd');
  }, [formStartDate, formDuration]);

  const getDaysInfo = (challenge: Challenge) => {
    const start = parseISO(challenge.startDate);
    const end = parseISO(challenge.endDate);
    const now = new Date();

    if (challenge.status === 'completed') {
      return { elapsed: challenge.duration, total: challenge.duration, label: 'Completed' };
    }

    const elapsed = Math.max(0, differenceInDays(now, start));
    const total = challenge.duration;
    const remaining = Math.max(0, total - elapsed);

    if (challenge.status === 'failed' || challenge.status === 'cancelled') {
      return { elapsed, total, label: 'Ended' };
    }

    return { elapsed, total, remaining, label: `${remaining} days remaining` };
  };

  const getStatusConfig = (status: string) =>
    STATUS_CONFIG[status as ChallengeStatus] ?? STATUS_CONFIG.active;

  // ── Dialog Helpers ──────────────────────────────────────────────────────

  const openNewDialog = () => {
    setEditingChallenge(null);
    setFormTitle('');
    setFormDescription('');
    setFormDuration('30');
    setFormStartDate(format(new Date(), 'yyyy-MM-dd'));
    setDialogOpen(true);
  };

  const openEditDialog = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setFormTitle(challenge.title);
    setFormDescription(challenge.description ?? '');
    setFormDuration(String(challenge.duration));
    setFormStartDate(challenge.startDate);
    setDialogOpen(true);
  };

  // ── CRUD ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      duration: parseInt(formDuration),
      startDate: formStartDate,
      endDate: computedEndDate(),
    };

    try {
      let res: Response;
      if (editingChallenge) {
        res = await fetch(`/api/challenges/${editingChallenge.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/challenges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error('Failed to save');

      toast.success(editingChallenge ? 'Challenge updated' : 'Challenge created');
      setDialogOpen(false);
      fetchChallenges();
    } catch {
      toast.error('Failed to save challenge');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/challenges/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Challenge deleted');
      setChallenges((prev) => prev?.filter((c) => c.id !== deleteTarget.id) ?? []);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete challenge');
    }
  };

  const handleUpdateProgress = async (challenge: Challenge) => {
    const newProgress = Math.min(challenge.progress + 1, challenge.duration);
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: newProgress }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setChallenges((prev) =>
        prev?.map((c) => (c.id === challenge.id ? { ...c, progress: newProgress } : c)) ?? []
      );

      if (newProgress >= challenge.duration) {
        toast.success('Challenge completed! 🎉');
      }
    } catch {
      toast.error('Failed to update progress');
    }
  };

  const handleComplete = async (challenge: Challenge) => {
    try {
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', progress: challenge.duration }),
      });
      if (!res.ok) throw new Error('Failed to complete');
      toast.success('Challenge completed! 🎉');
      setChallenges((prev) =>
        prev?.map((c) =>
          c.id === challenge.id
            ? { ...c, status: 'completed', progress: c.duration }
            : c
        ) ?? []
      );
    } catch {
      toast.error('Failed to complete challenge');
    }
  };

  // ── Quick Pick Handler ──────────────────────────────────────────────────

  const handleQuickPick = (days: number) => {
    setFormDuration(String(days));
    setFormStartDate(format(new Date(), 'yyyy-MM-dd'));
    setFormTitle('');
    setFormDescription('');
    setEditingChallenge(null);
    setDialogOpen(true);
  };

  // ── Loading / Empty States ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-4">
                <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-2 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!challenges) return null;

  const activeChallenges = challenges.filter((c) => c.status === 'active');
  const pastChallenges = challenges.filter((c) => c.status !== 'active');

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Challenges</h2>
          <p className="text-sm text-muted-foreground">
            {challenges.length} challenge{challenges.length !== 1 ? 's' : ''} &middot;{' '}
            {activeChallenges.length} active
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNewDialog}
              className="bg-primary text-white hover:bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Challenge
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>
                {editingChallenge ? 'Edit Challenge' : 'New Challenge'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="challenge-title">Title</Label>
                <Input
                  id="challenge-title"
                  placeholder="e.g. Read 30 minutes daily"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="challenge-desc">Description</Label>
                <Textarea
                  id="challenge-desc"
                  placeholder="Describe your challenge..."
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={formDuration} onValueChange={setFormDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={String(preset.value)}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="challenge-start">Start Date</Label>
                  <Input
                    id="challenge-start"
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">End Date</Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  {computedEndDate()}
                  <span className="ml-2 text-xs text-muted-foreground">(auto-calculated)</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="bg-primary text-white hover:bg-primary"
                >
                  {editingChallenge ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Duration Quick Picks ──────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick Start
        </p>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant="outline"
              size="sm"
              className="border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => handleQuickPick(preset.value)}
            >
              <Flame className="mr-1.5 h-3.5 w-3.5" />
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── Active Challenges ─────────────────────────────────────────── */}
      {activeChallenges.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Active
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeChallenges.map((challenge) => {
              const info = getDaysInfo(challenge);
              const statusCfg = getStatusConfig(challenge.status);
              const pct = Math.round((challenge.progress / challenge.duration) * 100);

              return (
                <Card
                  key={challenge.id}
                  className="group relative overflow-hidden border-primary/20 bg-white transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-5 space-y-4">
                    {/* Title Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Trophy className="h-4 w-4 text-primary shrink-0" />
                          <h4 className="font-semibold text-sm leading-tight truncate">
                            {challenge.title}
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs border-primary/20 text-primary bg-primary/10"
                        >
                          {challenge.duration} Day Challenge
                        </Badge>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0 text-xs',
                          statusCfg.color,
                          statusCfg.bg,
                          statusCfg.border
                        )}
                      >
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Description */}
                    {challenge.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {challenge.description}
                      </p>
                    )}

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-primary">{pct}%</span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-2 [&>div]:bg-primary"
                      />
                    </div>

                    {/* Days Info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {info.elapsed} / {info.total} days
                      </span>
                      <span className="font-medium text-primary">{info.label}</span>
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(challenge.startDate), 'MMM d')} &ndash;{' '}
                      {format(parseISO(challenge.endDate), 'MMM d, yyyy')}
                    </div>

                    {/* Actions */}
                    <Separator />
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleUpdateProgress(challenge)}
                        disabled={challenge.progress >= challenge.duration}
                      >
                        <Flame className="mr-1 h-3 w-3" />
                        +1 Day
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleComplete(challenge)}
                        disabled={challenge.status === 'completed'}
                      >
                        <Trophy className="mr-1 h-3 w-3" />
                        Complete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => openEditDialog(challenge)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => setDeleteTarget(challenge)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Past Challenges ───────────────────────────────────────────── */}
      {pastChallenges.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Past
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastChallenges.map((challenge) => {
              const statusCfg = getStatusConfig(challenge.status as ChallengeStatus);
              const pct = Math.round((challenge.progress / challenge.duration) * 100);

              return (
                <Card
                  key={challenge.id}
                  className={cn(
                    'group relative overflow-hidden transition-shadow hover:shadow-md',
                    challenge.status === 'completed'
                      ? 'border-primary/20'
                      : challenge.status === 'failed'
                        ? 'border-red-100'
                        : 'border-gray-100'
                  )}
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Trophy
                            className={cn(
                              'h-4 w-4 shrink-0',
                              challenge.status === 'completed'
                                ? 'text-primary'
                                : challenge.status === 'failed'
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                            )}
                          />
                          <h4 className="font-semibold text-sm leading-tight truncate">
                            {challenge.title}
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            statusCfg.color,
                            statusCfg.bg,
                            statusCfg.border
                          )}
                        >
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Final Progress</span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn(
                          'h-1.5',
                          challenge.status === 'completed'
                            ? '[&>div]:bg-primary'
                            : challenge.status === 'failed'
                              ? '[&>div]:bg-red-400'
                              : '[&>div]:bg-gray-400'
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(challenge.startDate), 'MMM d')} &ndash;{' '}
                        {format(parseISO(challenge.endDate), 'MMM d')}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                          onClick={() => openEditDialog(challenge)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => setDeleteTarget(challenge)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {challenges.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">No challenges yet</p>
              <p className="text-sm text-muted-foreground">
                Start a new challenge to push your habits to the next level.
              </p>
            </div>
            <Button
              onClick={openNewDialog}
              className="mt-2 bg-primary text-white hover:bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Challenge
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Challenge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}