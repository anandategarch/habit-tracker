'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Medal, Lock, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface BadgeItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  requirement: string | null;
  unlocked: boolean;
  unlockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Badges() {
  const { refreshKey } = useAppStore();

  // Data
  const [badges, setBadges] = useState<BadgeItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('🏆');
  const [formRequirement, setFormRequirement] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/badges');
      if (!res.ok) throw new Error('Failed to fetch badges');
      const data = await res.json();
      setBadges(data);
    } catch {
      toast.error('Failed to load badges');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges, refreshKey]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!badges) return { total: 0, unlocked: 0, percentage: 0 };
    const total = badges.length;
    const unlocked = badges.filter((b) => b.unlocked).length;
    const percentage = total > 0 ? Math.round((unlocked / total) * 100) : 0;
    return { total, unlocked, percentage };
  }, [badges]);

  // ── CRUD ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const res = await fetch('/api/badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          icon: formIcon.trim() || '🏆',
          requirement: formRequirement.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create badge');

      toast.success('Badge created');
      resetForm();
      setDialogOpen(false);
      fetchBadges();
    } catch {
      toast.error('Failed to create badge');
    }
  };

  const handleToggleUnlock = async (badge: BadgeItem) => {
    const newUnlocked = !badge.unlocked;
    try {
      const res = await fetch(`/api/badges/${badge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlocked: newUnlocked }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success(newUnlocked ? 'Badge unlocked! 🎉' : 'Badge locked');
      setBadges((prev) =>
        prev?.map((b) =>
          b.id === badge.id
            ? { ...b, unlocked: newUnlocked, unlockedAt: newUnlocked ? new Date().toISOString() : null }
            : b
        ) ?? []
      );
    } catch {
      toast.error('Failed to update badge');
    }
  };

  const handleDelete = async (badge: BadgeItem) => {
    try {
      const res = await fetch(`/api/badges/${badge.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Badge deleted');
      setBadges((prev) => prev?.filter((b) => b.id !== badge.id) ?? []);
    } catch {
      toast.error('Failed to delete badge');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormIcon('🏆');
    setFormRequirement('');
  };

  const openDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  // ── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
        </div>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-2 w-full animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3 flex flex-col items-center">
                <div className="h-12 w-12 animate-pulse rounded-2xl bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!badges) return null;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Badges</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">{stats.unlocked}</span>
            <span className="text-muted-foreground">/ {stats.total} Unlocked</span>
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openDialog}
              className="bg-primary text-white hover:bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Badge
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Create Badge</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="badge-icon">Icon (Emoji)</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl border">
                    {formIcon || '🏆'}
                  </div>
                  <Input
                    id="badge-icon"
                    placeholder="🏆"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="flex-1"
                    maxLength={4}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter a single emoji as the badge icon
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge-name">Name</Label>
                <Input
                  id="badge-name"
                  placeholder="e.g. Early Bird"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge-desc">Description</Label>
                <Textarea
                  id="badge-desc"
                  placeholder="Describe what this badge represents..."
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badge-req">Requirement</Label>
                <Input
                  id="badge-req"
                  placeholder="e.g. Complete habits before 7 AM for 7 consecutive days"
                  value={formRequirement}
                  onChange={(e) => setFormRequirement(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  className="bg-primary text-white hover:bg-primary"
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Overall Progress ───────────────────────────────────────────── */}
      {badges.length > 0 && (
        <Card className="border-primary/20">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Medal className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Collection Progress</span>
              </div>
              <span className="text-sm font-bold text-primary">{stats.percentage}%</span>
            </div>
            <Progress
              value={stats.percentage}
              className="h-2.5 [&>div]:bg-primary"
            />
            <p className="text-xs text-muted-foreground">
              {stats.unlocked} of {stats.total} badges unlocked &middot;{' '}
              {stats.total - stats.unlocked} remaining
            </p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── Badge Grid ─────────────────────────────────────────────────── */}
      {badges.length > 0 && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {badges.map((badge) => (
            <Card
              key={badge.id}
              className={cn(
                'group relative overflow-hidden transition-all hover:shadow-md',
                badge.unlocked
                  ? 'border-primary/20 bg-white'
                  : 'border-gray-100 opacity-60 hover:opacity-90'
              )}
            >
              <CardContent className="p-4 flex flex-col items-center text-center space-y-3">
                {/* Icon */}
                <div className="relative">
                  <div
                    className={cn(
                      'flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition-colors',
                      badge.unlocked
                        ? 'bg-primary/10 ring-2 ring-primary/20'
                        : 'bg-gray-100'
                    )}
                  >
                    {badge.icon || '🏆'}
                  </div>
                  {/* Lock overlay for locked badges */}
                  {!badge.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/50 backdrop-blur-[1px]">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <h4 className="font-semibold text-sm leading-tight w-full truncate">
                  {badge.name}
                </h4>

                {/* Description */}
                {badge.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed w-full">
                    {badge.description}
                  </p>
                )}

                {/* Requirement */}
                {badge.requirement && (
                  <p
                    className={cn(
                      'text-xs rounded-md px-2 py-1 w-full leading-relaxed',
                      badge.unlocked
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground bg-gray-50'
                    )}
                  >
                    {badge.requirement}
                  </p>
                )}

                {/* Status Badge */}
                {badge.unlocked ? (
                  <Badge
                    variant="outline"
                    className="border-primary/20 text-primary bg-primary/10 text-xs"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {badge.unlockedAt
                      ? format(new Date(badge.unlockedAt), 'MMM d, yyyy')
                      : 'Unlocked'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-gray-200 text-gray-500 bg-gray-50 text-xs">
                    <Lock className="mr-1 h-3 w-3" />
                    Locked
                  </Badge>
                )}

                {/* Actions (visible on hover) */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-full justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-7 text-xs flex-1 max-w-[100px]',
                      badge.unlocked
                        ? 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'border-primary/20 text-primary hover:bg-primary/10 hover:text-primary'
                    )}
                    onClick={() => handleToggleUnlock(badge)}
                  >
                    {badge.unlocked ? 'Lock' : 'Unlock'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(badge)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {badges.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Medal className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">No badges yet</p>
              <p className="text-sm text-muted-foreground">
                Create badges to celebrate your achievements and track milestones.
              </p>
            </div>
            <Button
              onClick={openDialog}
              className="mt-2 bg-primary text-white hover:bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Badge
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}