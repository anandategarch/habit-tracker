'use client';

// components/habit-tracker/finance-savings-goals.tsx — sub-tab "Tabungan":
// target tabungan ala "piggy bank" Firefly III (PHASE2-FINANCE-2).
//
// - Kartu goal (div.premium-card.premium-card-sheen, grid 1/2/3): emoji +
//   nama + Progress (premium-progress-fill) + nominal current/target +
//   deadline (dibaca via komponen YMD — konvensi tengah malam Jakarta).
// - Quick-chips 1-tap: +Rp50rb / +Rp100rb / Sisa → PUT
//   /api/finance/savings-goals/[id] body { delta }.
//   GUARD double-tap (6-b FIX-2): quickPendingRef (Set, anti double-tap
//   dalam tick sama) + state quickPendingIds untuk disable chip goal itu
//   selama in-flight; reset di finally.
//   Chips DISEMBUNYIKAN untuk goal yang sudah 100%.
// - Confetti smallPop saat goal tercapai.
// - Dialog tambah/edit/adjust + delete AlertDialog.
// - FIX-1/6-b: SEMUA setSubmitting(false) / reset state dialog ada di blok
//   `finally` — dialog tidak boleh stuck "Menyimpan…" saat API error
//   (onOpenChange di-guard `submitting`).

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { smallPop } from '@/lib/confetti';
import { jakartaDateKey } from '@/lib/timezone';
import { MONTHS_ID } from '@/lib/finance-helpers';
import { cn } from '@/lib/utils';
import type { CSSProperties, MouseEvent } from 'react';
import type { SavingsGoal } from './finance-types';
import { formatRupiah, formatNominalInput, amountFromInput } from './finance-types';

interface GoalFormState {
  id: string | null;
  name: string;
  emoji: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
}

const GOAL_EMOJI_CHOICES = ['🎯', '💰', '🏠', '✈️', '📱', '🚗', '🎓', '💍', '🎁', '🐷'];

const QUICK_CHIPS: Array<{ label: string; delta: number }> = [
  { label: '+Rp50rb', delta: 50_000 },
  { label: '+Rp100rb', delta: 100_000 },
];

function emptyGoalForm(): GoalFormState {
  return { id: null, name: '', emoji: '🎯', targetAmount: '', currentAmount: '', deadline: '' };
}

function goalPct(goal: SavingsGoal): number {
  const target = goal.targetAmount ?? 0;
  if (target <= 0) return 0;
  return Math.min(100, Math.round(((goal.currentAmount ?? 0) / target) * 100));
}

function isComplete(goal: SavingsGoal): boolean {
  return goal.targetAmount > 0 && (goal.currentAmount ?? 0) >= goal.targetAmount;
}

/** 'yyyy-MM-dd' → '5 Sep 2026' (komponen YMD — bukan TZ browser). */
function formatYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

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
    return (
      <div className="premium-card rounded-2xl mt-4">
        <div className="premium-empty min-h-[16rem]">
          <div className="premium-empty-orb" aria-hidden="true">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold">Gagal memuat target tabungan</p>
          <p className="text-xs text-muted-foreground">Coba lagi dalam sejenak</p>
          <Button size="sm" variant="outline" className="h-8 text-xs mt-1" onClick={() => { void goalsQuery.refetch(); }}>
            <RefreshCw className="h-3 w-3" /> Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (goalsQuery.isLoading) {
    return (
      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32 rounded" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    );
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
        <div className="premium-card rounded-2xl">
          <div className="premium-empty min-h-[16rem]">
            <div className="premium-empty-orb" aria-hidden="true">
              <PiggyBank className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold">Belum ada target tabungan</p>
            <p className="text-xs text-muted-foreground">
              Simpan untuk liburan, gadget, atau dana darurat — pantau progresnya di sini.
            </p>
            <Button size="sm" className="h-8 text-xs mt-1 btn-primary-gradient" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Buat Target Pertama
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {goals.map((goal, idx) => {
            const pct = goalPct(goal);
            const complete = isComplete(goal);
            const remaining = Math.max(0, (goal.targetAmount ?? 0) - (goal.currentAmount ?? 0));
            const pending = quickPendingIds.has(goal.id);
            const deadlineYMD = goal.deadline ? jakartaDateKey(new Date(goal.deadline)) : null;
            return (
              <div
                key={goal.id}
                className="premium-card premium-card-sheen premium-card-hover rounded-2xl p-4 anim-stagger"
                style={{ '--stagger': idx } as CSSProperties}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-11 w-11 rounded-2xl grid place-items-center text-xl shrink-0 ring-1 ring-black/5 dark:ring-white/10 bg-primary/10"
                      aria-hidden="true"
                    >
                      {goal.emoji ?? '🎯'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{goal.name}</p>
                      {complete ? (
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Tercapai 🎉
                        </p>
                      ) : deadlineYMD ? (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                          Target {formatYMD(deadlineYMD)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Tanpa tenggat</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(goal)}
                      aria-label={`Edit target tabungan ${goal.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(goal.id)}
                      aria-label={`Hapus target tabungan ${goal.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Progress
                    value={pct}
                    className={cn('h-2.5 flex-1', complete && '[&_[data-slot=progress-indicator]]:bg-emerald-500')}
                  />
                  <span className="text-[11px] font-semibold tabular-nums shrink-0">{pct}%</span>
                </div>

                <div className="mt-2.5">
                  <p className="text-sm font-bold tabular-nums">
                    {formatRupiah(goal.currentAmount ?? 0)}
                    <span className="text-xs font-medium text-muted-foreground">
                      {' '}/ {formatRupiah(goal.targetAmount ?? 0)}
                    </span>
                  </p>
                  {!complete && remaining > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                      Sisa {formatRupiah(remaining)} lagi
                    </p>
                  )}
                </div>

                {/* Quick-chips 1-tap — disembunyikan untuk goal 100% */}
                {!complete && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {QUICK_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        className="chip-soft chip-soft-teal text-[11px] font-semibold px-2.5 py-1 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed anim-press"
                        onClick={(e) => { void handleQuickChip(goal, chip.delta, e); }}
                        disabled={pending}
                        aria-label={`Tambah ${chip.label} ke ${goal.name}`}
                      >
                        {chip.label}
                      </button>
                    ))}
                    {remaining > 0 && (
                      <button
                        type="button"
                        className="chip-soft chip-soft-violet text-[11px] font-semibold px-2.5 py-1 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed anim-press"
                        onClick={(e) => { void handleQuickChip(goal, remaining, e); }}
                        disabled={pending}
                        aria-label={`Lunasi sisa ${formatRupiah(remaining)} target ${goal.name}`}
                      >
                        Sisa ({formatRupiah(remaining)})
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog tambah/edit target ── */}
      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={cn('chip-icon h-7 w-7', form.id ? 'chip-amber' : 'chip-lime')}
                aria-hidden="true"
              >
                <PiggyBank className="h-3.5 w-3.5" />
              </span>
              {form.id ? 'Edit Target Tabungan' : 'Target Tabungan Baru'}
            </DialogTitle>
            <DialogDescription>
              Tetapkan nominal target, saldo sekarang, dan tenggat opsional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-name">Nama Target</Label>
              <Input
                id="goal-name"
                placeholder="mis. Dana Darurat"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={submitting}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {GOAL_EMOJI_CHOICES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, emoji }))}
                    className={cn(
                      'h-9 w-9 rounded-xl grid place-items-center text-base transition-all cursor-pointer',
                      form.emoji === emoji
                        ? 'bg-primary/15 ring-2 ring-primary/50 scale-105'
                        : 'bg-muted/60 hover:bg-muted'
                    )}
                    aria-label={`Pilih emoji ${emoji}`}
                    aria-pressed={form.emoji === emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-target">Target</Label>
                <Input
                  id="goal-target"
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={form.targetAmount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, targetAmount: formatNominalInput(e.target.value.replace(/[^\d]/g, '')) }))
                  }
                  disabled={submitting}
                  className="h-9 tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-current">Sudah Tersimpan</Label>
                <Input
                  id="goal-current"
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={form.currentAmount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, currentAmount: formatNominalInput(e.target.value.replace(/[^\d]/g, '')) }))
                  }
                  disabled={submitting}
                  className="h-9 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-deadline" className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" aria-hidden="true" /> Tenggat (opsional)
              </Label>
              <Input
                id="goal-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
                disabled={submitting}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleFormOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button
              className="btn-primary-gradient"
              onClick={(e) => { void handleSubmit(e); }}
              disabled={submitting}
            >
              {submitting ? 'Menyimpan…' : form.id ? 'Simpan Perubahan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Konfirmasi hapus target ── */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              Hapus Target Tabungan?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Target <strong>{deleting?.name}</strong> akan dihapus permanen
              beserta progresnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive"
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
