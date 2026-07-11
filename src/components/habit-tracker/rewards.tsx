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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Gift, Lock, Unlock, Star, Trash2 as TrashIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface Reward {
  id: string;
  name: string;
  description: string | null;
  unlockCondition: string | null;
  xpCost: number;
  status: string;
  unlockedAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type RewardStatus = 'locked' | 'unlocked' | 'redeemed';

const STATUS_CONFIG: Record<
  RewardStatus,
  { label: string; color: string; bg: string; border: string; icon: typeof Lock }
> = {
  locked: {
    label: 'Locked',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: Lock,
  },
  unlocked: {
    label: 'Unlocked',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    icon: Unlock,
  },
  redeemed: {
    label: 'Redeemed',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    icon: Star,
  },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Rewards() {
  const { refreshKey } = useAppStore();

  // Data
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUnlockCondition, setFormUnlockCondition] = useState('');
  const [formXpCost, setFormXpCost] = useState('100');

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchRewards = useCallback(async () => {
    try {
      const res = await fetch('/api/rewards');
      if (!res.ok) throw new Error('Failed to fetch rewards');
      const data = await res.json();
      setRewards(data);
    } catch {
      toast.error('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards, refreshKey]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getStatusConfig = (status: string) =>
    STATUS_CONFIG[status as RewardStatus] ?? STATUS_CONFIG.locked;

  const formatXp = (xp: number) => {
    if (xp >= 1000) return `${(xp / 1000).toFixed(xp % 1000 === 0 ? 0 : 1)}k XP`;
    return `${xp} XP`;
  };

  // ── CRUD ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    const xpNum = parseInt(formXpCost);
    if (isNaN(xpNum) || xpNum < 0) {
      toast.error('XP Cost must be a valid number');
      return;
    }

    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          unlockCondition: formUnlockCondition.trim() || null,
          xpCost: xpNum,
        }),
      });

      if (!res.ok) throw new Error('Failed to create reward');

      toast.success('Reward created');
      resetForm();
      setDialogOpen(false);
      fetchRewards();
    } catch {
      toast.error('Failed to create reward');
    }
  };

  const handleToggleUnlock = async (reward: Reward) => {
    const newStatus: RewardStatus = reward.status === 'locked' ? 'unlocked' : 'locked';
    try {
      const res = await fetch(`/api/rewards/${reward.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success(newStatus === 'unlocked' ? 'Reward unlocked! 🎁' : 'Reward locked');
      setRewards((prev) =>
        prev?.map((r) => (r.id === reward.id ? { ...r, status: newStatus } : r)) ?? []
      );
    } catch {
      toast.error('Failed to update reward');
    }
  };

  const handleRedeem = async (reward: Reward) => {
    try {
      const res = await fetch(`/api/rewards/${reward.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'redeemed' }),
      });
      if (!res.ok) throw new Error('Failed to redeem');
      toast.success('Reward redeemed! 🎉');
      setRewards((prev) =>
        prev?.map((r) => (r.id === reward.id ? { ...r, status: 'redeemed' } : r)) ?? []
      );
    } catch {
      toast.error('Failed to redeem reward');
    }
  };

  const handleDelete = async (reward: Reward) => {
    try {
      const res = await fetch(`/api/rewards/${reward.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Reward deleted');
      setRewards((prev) => prev?.filter((r) => r.id !== reward.id) ?? []);
    } catch {
      toast.error('Failed to delete reward');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormUnlockCondition('');
    setFormXpCost('100');
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
            <div className="h-8 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-56 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!rewards) return null;

  const lockedRewards = rewards.filter((r) => r.status === 'locked');
  const unlockedRewards = rewards.filter((r) => r.status === 'unlocked');
  const redeemedRewards = rewards.filter((r) => r.status === 'redeemed');

  const totalXpValue = rewards.reduce((sum, r) => sum + r.xpCost, 0);
  const redeemedXpValue = redeemedRewards.reduce((sum, r) => sum + r.xpCost, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Rewards</h2>
          <p className="text-sm text-muted-foreground">
            {rewards.length} reward{rewards.length !== 1 ? 's' : ''} &middot;{' '}
            {unlockedRewards.length} unlocked &middot; {redeemedRewards.length} redeemed
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openDialog}
              className="bg-primary text-white hover:bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Reward
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Add Reward</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="reward-name">Name</Label>
                <Input
                  id="reward-name"
                  placeholder="e.g. Movie Night"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward-desc">Description</Label>
                <Textarea
                  id="reward-desc"
                  placeholder="Describe the reward..."
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward-condition">Unlock Condition</Label>
                <Input
                  id="reward-condition"
                  placeholder="e.g. Complete 30-day meditation challenge"
                  value={formUnlockCondition}
                  onChange={(e) => setFormUnlockCondition(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward-xp">XP Cost</Label>
                <Input
                  id="reward-xp"
                  type="number"
                  min="0"
                  placeholder="100"
                  value={formXpCost}
                  onChange={(e) => setFormXpCost(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  How many XP points this reward costs to redeem
                </p>
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

      {/* ── Stats Bar ─────────────────────────────────────────────────── */}
      {rewards.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{rewards.length}</p>
              <p className="text-xs text-muted-foreground">Total Rewards</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{formatXp(totalXpValue)}</p>
              <p className="text-xs text-muted-foreground">Total Value</p>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{formatXp(redeemedXpValue)}</p>
              <p className="text-xs text-muted-foreground">XP Redeemed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* ── Unlocked Rewards ──────────────────────────────────────────── */}
      {unlockedRewards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Unlocked
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {unlockedRewards.map((reward) => {
              const cfg = getStatusConfig(reward.status);
              const StatusIcon = cfg.icon;
              return (
                <Card
                  key={reward.id}
                  className="group overflow-hidden border-primary/20 bg-white transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                        🎁
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm truncate">{reward.name}</h4>
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 text-xs',
                              cfg.color,
                              cfg.bg,
                              cfg.border
                            )}
                          >
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          <Star className="mr-1 h-3 w-3" />
                          {formatXp(reward.xpCost)}
                        </Badge>
                      </div>
                    </div>

                    {reward.description && (
                      <p className="text-xs text-muted-foreground">{reward.description}</p>
                    )}

                    {reward.unlockCondition && (
                      <p className="text-xs text-primary bg-primary/10 rounded-md px-2.5 py-1.5">
                        {reward.unlockCondition}
                      </p>
                    )}

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-primary text-white hover:bg-primary"
                        onClick={() => handleRedeem(reward)}
                      >
                        <Gift className="mr-1.5 h-3 w-3" />
                        Redeem
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(reward)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Locked Rewards ────────────────────────────────────────────── */}
      {lockedRewards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Locked
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lockedRewards.map((reward) => {
              const cfg = getStatusConfig(reward.status);
              const StatusIcon = cfg.icon;
              return (
                <Card
                  key={reward.id}
                  className="group relative overflow-hidden border-gray-100 opacity-75 transition-all hover:opacity-100 hover:shadow-md"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl relative">
                        🎁
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-200/60">
                          <Lock className="h-4 w-4 text-gray-500" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm truncate text-muted-foreground">
                            {reward.name}
                          </h4>
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 text-xs',
                              cfg.color,
                              cfg.bg,
                              cfg.border
                            )}
                          >
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          {formatXp(reward.xpCost)}
                        </Badge>
                      </div>
                    </div>

                    {reward.description && (
                      <p className="text-xs text-muted-foreground">{reward.description}</p>
                    )}

                    {reward.unlockCondition && (
                      <p className="text-xs text-muted-foreground bg-gray-50 rounded-md px-2.5 py-1.5">
                        {reward.unlockCondition}
                      </p>
                    )}

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleToggleUnlock(reward)}
                      >
                        <Unlock className="mr-1.5 h-3 w-3" />
                        Unlock
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(reward)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Redeemed Rewards ──────────────────────────────────────────── */}
      {redeemedRewards.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Redeemed
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {redeemedRewards.map((reward) => {
              const cfg = getStatusConfig(reward.status);
              const StatusIcon = cfg.icon;
              return (
                <Card
                  key={reward.id}
                  className="group overflow-hidden border-primary/20 bg-primary/5 transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                        ✅
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm truncate">{reward.name}</h4>
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0 text-xs',
                              cfg.color,
                              cfg.bg,
                              cfg.border
                            )}
                          >
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          {formatXp(reward.xpCost)}
                        </Badge>
                      </div>
                    </div>

                    {reward.description && (
                      <p className="text-xs text-muted-foreground">{reward.description}</p>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(reward)}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {rewards.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Gift className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">No rewards yet</p>
              <p className="text-sm text-muted-foreground">
                Create rewards to motivate yourself and celebrate milestones.
              </p>
            </div>
            <Button
              onClick={openDialog}
              className="mt-2 bg-primary text-white hover:bg-primary"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Reward
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

