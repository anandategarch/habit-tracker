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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { jakartaNowParts, jakartaDateKey } from '@/lib/timezone';
import {
  formatRupiah,
  formatNominalInput,
  parseNominalInput,
  type FundSource,
} from './finance-types';

// ── Types ──────────────────────────────────────────────────────────────────

interface SavingsGoal {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  currentAmount: number;
  sourceName: string | null;
  deadline: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AdjustResponse extends SavingsGoal {
  // Returned by PUT /api/finance/savings-goals/[id] when `delta` is sent.
  // Flags that the goal flipped from incomplete → completed on this call,
  // so the UI fires the celebration 🎉.
  justCompleted?: boolean;
  previousAmount?: number;
}

// Quick emoji picker options for savings goals — focused on aspiration /
// celebration emojis (vs the general emoji palette used for transactions).
const GOAL_EMOJI_OPTIONS = [
  '🎯', '🏖️', '✈️', '🏝️', '🏠', '🚗', '🏍️', '🛵', '💍', '🎓',
  '💻', '📱', '🎮', '📚', '🏋️', '⚽', '🎵', '🎬', '🎂', '🎁',
  '💰', '🏦', '📈', '🪙', '💵', '🛡️', '🚸', '👶', '🐕', '🪴',
  '🔥', '⭐', '🏆', '🎉', '💎', '🛍️',
];

// ── Form state ─────────────────────────────────────────────────────────────

interface GoalFormState {
  name: string;
  emoji: string;
  targetAmount: string;
  currentAmount: string;
  sourceName: string; // '' = none
  deadline: string; // '' = none, else yyyy-MM-dd
}

const EMPTY_FORM: GoalFormState = {
  name: '',
  emoji: '🎯',
  targetAmount: '',
  currentAmount: '',
  sourceName: '',
  deadline: '',
};

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

  // ── Deadline countdown ────────────────────────────────────────────────
  const deadlineInfo = (g: SavingsGoal): { label: string; urgent: boolean; past: boolean } | null => {
    if (!g.deadline) return null;
    const jp = jakartaNowParts();
    // Build today's date at Jakarta midnight for a clean day-diff.
    const todayMs = new Date(jp.year, jp.month - 1, jp.day).getTime();
    // BUG-PHASE12: previously used `dl.getFullYear/getMonth/getDate` which
    // reads the deadline in the BROWSER's local TZ. For a UTC browser, a
    // deadline of "2026-09-15T00:00:00+07:00" (= 2026-09-14T17:00:00Z)
    // would be read as Sep 14, making the countdown off by 1 day. Now we
    // extract the Jakarta date key (yyyy-MM-dd) and parse that as a
    // browser-local midnight — consistent with how `todayMs` is built from
    // Jakarta parts.
    const dlJakartaStr = jakartaDateKey(new Date(g.deadline));
    const [y2, m2, d2] = dlJakartaStr.split('-').map(Number);
    const dlMs = new Date(y2, m2 - 1, d2).getTime();
    const daysLeft = Math.round((dlMs - todayMs) / 86_400_000);
    if (daysLeft < 0) {
      return { label: `Lewat ${Math.abs(daysLeft)}h`, urgent: false, past: true };
    }
    if (daysLeft === 0) return { label: 'Hari ini', urgent: true, past: false };
    if (daysLeft <= 7) return { label: `${daysLeft}h lagi`, urgent: true, past: false };
    return { label: `${daysLeft}h lagi`, urgent: false, past: false };
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
            <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
              <Badge variant="secondary" className="font-medium">
                <Target className="h-3 w-3 mr-1" />
                {stats.activeCount} aktif
              </Badge>
              {stats.completedCount > 0 && (
                <Badge className="bg-success/10 text-success border-success/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {stats.completedCount} tercapai
                </Badge>
              )}
              <Badge variant="outline" className="font-medium">
                Total {formatRupiah(stats.totalSaved)} / {formatRupiah(stats.totalTarget)}
              </Badge>
            </div>
          )}
        </div>
        <Button size="sm" onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" />
          Tambah Tabungan
        </Button>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground text-center">
            <Target className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Belum ada tabungan</p>
            <p className="text-xs mt-1 max-w-xs">
              Mulai dengan menambahkan target tabungan — liburan, dana darurat, atau beli barang impian.
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Buat Tabungan Pertama
            </Button>
          </CardContent>
        </Card>
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
                  'group relative rounded-2xl bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 anim-stagger',
                  g.isCompleted && 'ring-1 ring-success/40 dark:ring-success/60'
                )}
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', animationDelay: `${idx * 50}ms` }}
              >
                {/* Top row: emoji + name + actions */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-muted/50">
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(g.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Current vs target */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="text-lg font-bold">{formatRupiah(g.currentAmount)}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ {formatRupiah(g.targetAmount)}</span>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        g.isCompleted
                          ? 'bg-success/10 text-success'
                          : pct >= 80
                            ? 'bg-warning/10 text-warning'
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
                      g.isCompleted && '[&>div]:bg-success',
                      !g.isCompleted && pct >= 80 && '[&>div]:bg-warning'
                    )}
                  />

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
      <Dialog open={formOpen} onOpenChange={(o) => { if (!submitting) setFormOpen(o); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Tabungan' : 'Tambah Tabungan'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label className="text-xs">Nama Tabungan</Label>
              <Input
                className="mt-1"
                placeholder="Contoh: Liburan, Dana Darurat, Beli Laptop"
                value={form.name}
                maxLength={200}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Emoji picker — grid of common aspiration emojis */}
            <div>
              <Label className="text-xs">Emoji</Label>
              <div className="mt-1 grid grid-cols-8 sm:grid-cols-10 gap-1.5">
                {GOAL_EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                    className={cn(
                      'h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-colors',
                      form.emoji === e
                        ? 'bg-primary/15 ring-2 ring-primary'
                        : 'bg-muted/40 hover:bg-muted'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Target amount */}
            <div>
              <Label className="text-xs">Target (Rp)</Label>
              <Input
                className="mt-1"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: formatNominalInput(e.target.value) }))}
              />
            </div>

            {/* Initial current amount (only meaningful on create, but editable on edit too) */}
            <div>
              <Label className="text-xs">
                {editingId ? 'Saldo Saat Ini (Rp)' : 'Saldo Awal (Rp) — opsional'}
              </Label>
              <Input
                className="mt-1"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={form.currentAmount}
                onChange={(e) => setForm((f) => ({ ...f, currentAmount: formatNominalInput(e.target.value) }))}
              />
            </div>

            {/* Source (optional) */}
            <div>
              <Label className="text-xs">Sumber Dana (opsional)</Label>
              <Select
                value={form.sourceName || '__none__'}
                onValueChange={(v) => setForm((f) => ({ ...f, sourceName: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih sumber dana" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Tidak ada —</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.emoji} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Hanya referensi. Saldo sumber dana tidak otomatis berkurang.
              </p>
            </div>

            {/* Deadline (optional) */}
            <div>
              <Label className="text-xs">Tenggat (opsional)</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ADJUST (TAMBAH / TARIK) DIALOG ─── */}
      <Dialog open={adjustOpen} onOpenChange={(o) => { if (!submitting) setAdjustOpen(o); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {adjustDirection === 'add' ? 'Tambah Tabungan' : 'Tarik Tabungan'}
            </DialogTitle>
          </DialogHeader>
          {adjustGoal && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-background">
                  {adjustGoal.emoji}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{adjustGoal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Saldo: {formatRupiah(adjustGoal.currentAmount)} / {formatRupiah(adjustGoal.targetAmount)}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs">
                  {adjustDirection === 'add' ? 'Jumlah Tambah (Rp)' : 'Jumlah Tarik (Rp)'}
                </Label>
                <Input
                  className="mt-1 text-base font-semibold"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  autoFocus
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(formatNominalInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdjust();
                  }}
                />
                {adjustDirection === 'add' && adjustGoal.targetAmount > adjustGoal.currentAmount && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Butuh {formatRupiah(adjustGoal.targetAmount - adjustGoal.currentAmount)} lagi untuk mencapai target.
                  </p>
                )}
              </div>
              {/* Quick-fill chips: common amounts + "sisanya" */}
              <div className="flex flex-wrap gap-1.5">
                {[50_000, 100_000, 500_000, 1_000_000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAdjustAmount(formatNominalInput(String(amt)))}
                    className="px-2 py-1 rounded-md text-xs bg-muted/60 hover:bg-muted transition-colors"
                  >
                    {formatRupiah(amt)}
                  </button>
                ))}
                {adjustDirection === 'add' && adjustGoal.targetAmount > adjustGoal.currentAmount && (
                  <button
                    type="button"
                    onClick={() => setAdjustAmount(formatNominalInput(String(adjustGoal.targetAmount - adjustGoal.currentAmount)))}
                    className="px-2 py-1 rounded-md text-xs bg-success/10 text-success hover:bg-success/20 transition-colors font-medium"
                  >
                    Sisanya
                  </button>
                )}
                {adjustDirection === 'withdraw' && adjustGoal.currentAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdjustAmount(formatNominalInput(String(adjustGoal.currentAmount)))}
                    className="px-2 py-1 rounded-md text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
                  >
                    Semua
                  </button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setAdjustOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button
              className={cn('flex-1', adjustDirection === 'withdraw' && 'bg-destructive hover:bg-destructive text-white')}
              onClick={handleAdjust}
              disabled={submitting || !adjustAmount}
            >
              {submitting ? 'Memproses...' : adjustDirection === 'add' ? 'Tambah' : 'Tarik'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION ─── */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!submitting) setDeleteId(o ? deleteId : null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Tabungan?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tabungan ini akan dihapus permanen dan tidak bisa dikembalikan.
          </p>
          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)} disabled={submitting}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
