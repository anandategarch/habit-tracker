'use client';

// components/habit-tracker/goals.tsx — shell tab "Tujuan".
//
// - 3 stat card premium (chip gradien teal/emerald/amber + premium-label
//   min-h-7 + premium-stat + premium-fade-up stagger) — pola worklog 2-c.
// - Empty state premium-empty + orb (Target) + "Mulai Milestone Pertamamu".
// - Error state dengan tombol Coba Lagi → refetch (fix 6-a FIX-5: tanpa
//   cabang isError skeleton tampil selamanya saat fetch gagal).
// - CRUD goal via /api/goals + /api/goals/[id] (kontrak API).

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toDashboardData } from '@/lib/dashboard/contract';
import { useAppStore } from '@/store/app-store';
import { Target, CheckCircle2, Flame, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { GoalCard } from './goal-card';
import { GoalFormDialog } from './goal-form-dialog';
import { GoalsSkeleton } from './goals-skeleton';
import { CountUpNumber } from './count-up';
import { smallPop } from '@/lib/confetti';
import { nextStatusForMilestones, type Goal, type GoalMilestone } from './goals-helpers';

/** Body PUT lengkap dari goal (partial-safe di API). */
function goalBody(goal: Goal, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: goal.title,
    description: goal.description ?? null,
    priority: goal.priority,
    deadline: goal.deadline ?? null,
    milestones: goal.milestones ?? [],
    status: goal.status,
    ...overrides,
  };
}

export default function Goals() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // ── CONNECTED-APP (Task 49): fokus tujuan (deep-link openGoalFocus) ──
  // Consume-and-clear: scroll ke kartu + sorot ring (prop highlight).
  // BUGHUNT-47 (47-d #3): clearGoalFocus() dulunya dipanggil LANGSUNG di badan
  // efek — dep focusGoalId berubah (X→null) seketika → cleanup efek lari →
  // clearTimeout membatalkan timer 2,5 dtk → sorotan menempel selamanya &
  // milestone ter-expand paksa. Clear kini terjadi DALAM timeout bersama
  // lepasnya sorotan; cleanup hanya untuk unmount/pergantian fokus.
  // (Efek konsumsinya dipindah ke bawah query ['goals'] — lihat
  // BUGHUNT-54 (3-c #3): butuh akses data goals untuk gating.)
  const focusGoalId = useAppStore((s) => s.focusGoalId);
  const clearGoalFocus = useAppStore((s) => s.clearGoalFocus);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // VERIFY-48 (48-b): fokus yang belum terkonsumsi saat tab ditinggalkan
  // (unmount < 2,5 dtk) tidak boleh menunggu di store — kunjungan Tujuan
  // berikutnya (kapan pun) akan men-scroll + menyorot ulang deep-link basi.
  // Effect terpisah deps kosong: cleanup HANYA jalan saat unmount (kalau
  // digabung ke efek fokus, clearGoalFocus di cleanup memicu persis bug
  // 47-d #3 yang diperbaiki — timer sorotan terbunuh saat fokus berganti).
  useEffect(() => () => { clearGoalFocus(); }, [clearGoalFocus]);

  // ── CONNECTED-APP (Task 49): habit pendukung per tujuan ──
  // ['habits'] cache terbagih dengan tracker; status selesai-hari-ini dari
  // ['dashboard','all',…] (key sama dengan Beranda → cache terbagih).
  // BUGHUNT-47 (47-e #1 — CRITICAL): queryFn kini memakai toDashboardData()
  // — BENTUK SAMA PERSIS dengan Beranda/Progres. Dulunya query ini menyimpan
  // raw JSON (focusToday) di key yang SAMA dengan dashboard.tsx (shape
  // toDashboardData → todayHabits): komponen yang fetch lebih dulu menang
  // bentuk cache → goals membaca focusToday=[] (status pendukung selalu
  // "belum") atau Beranda membaca todayHabits=undefined → crash render.
  const refreshKey = useAppStore((s) => s.refreshKey);
  const { data: habits = [] } = useQuery<{ id: string; name: string; emoji: string; goalId?: string | null; graduatedAt?: string | null; isActive?: boolean }[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Gagal memuat habit');
      const json = await res.json();
      return json.habits ?? [];
    },
    staleTime: 30_000,
  });
  const { data: todayData } = useQuery({
    queryKey: ['dashboard', 'all', refreshKey, 0],
    queryFn: async () => {
      const res = await fetch('/api/dashboard?period=all');
      if (!res.ok) return null;
      return toDashboardData(await res.json(), 'all');
    },
    staleTime: 30_000,
    select: (d) => ({ todayHabits: d?.todayHabits ?? [] }),
  });
  // BUGHUNT-47 (47-e #2): habit avoid yang KAMBUH (logged) tidak lagi
  // dirayakan "Selesai" — semantik sama dengan Beranda (Task 39 #4):
  // avoid sukses = TIDAK kambuh; kambuh tercatat netral (chip "Tercatat").
  const todayStatusById = new Map<
    string,
    { logged: boolean; isAvoid: boolean }
  >(
    (todayData?.todayHabits ?? []).map((h) => [
      h.id,
      { logged: h.completed === true, isAvoid: h.habitType === 'avoid' },
    ])
  );
  const supportingByGoal = new Map<
    string,
    { id: string; name: string; emoji: string; status: 'done' | 'recorded' | 'pending' }[]
  >();
  for (const h of habits) {
    if (!h.goalId) continue;
    // BUGHUNT-54 (3-b #1): /api/habits kini juga mengirim habit dijeda —
    // daftar pendukung tujuan hanya habit AKTIF (habit dijeda tidak bisa
    // "selesai hari ini"; membiarkannya dihitung membuat counter tujuan
    // membengkak dengan anggota yang tidak bisa dipenuhi sampai dilanjutkan).
    if (!h.isActive) continue;
    // VERIFY-48 (48-c F5): habit LULUS tidak pernah bisa "selesai hari ini"
    // lagi — membiarkannya di daftar pendukung membuat counter tujuan
    // (mis. "1/2 selesai") menghitung anggota yang mustahil terpenuhi
    // selamanya. Tracker/Beranda sudah menyaring graduatedAt; ini
    // menyamakan semesta daftar pendukung.
    if (h.graduatedAt) continue;
    const arr = supportingByGoal.get(h.goalId) ?? [];
    const st = todayStatusById.get(h.id);
    const status = !st
      ? 'pending'
      : st.isAvoid
        ? st.logged
          ? 'recorded'
          : 'done'
        : st.logged
          ? 'done'
          : 'pending';
    arr.push({ id: h.id, name: h.name, emoji: h.emoji, status });
    supportingByGoal.set(h.goalId, arr);
  }

  // ── Query goals ────────────────────────────────────────────────────────
  const {
    data: goals,
    isLoading,
    isError,
    refetch,
  } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await fetch('/api/goals');
      if (!res.ok) throw new Error('Gagal memuat tujuan');
      const json = await res.json();
      // Kontrak: { goals: Goal[] }; fallback array untuk toleransi bentuk lama.
      return Array.isArray(json) ? json : (json.goals ?? []);
    },
    retry: 1,
  });

  const list = goals ?? [];
  const total = list.length;
  const completed = list.filter((g) => g.status === 'completed').length;
  const ongoing = list.filter((g) => g.status === 'active').length;

  // BUGHUNT-54 (3-c #3): deep-link openGoalFocus dikonsumsi HANYA setelah
  // data ['goals'] siap (pola daily-tracker 47-d #2). Dulunya efek jalan
  // saat mount dengan cache dingin → kartu belum ter-render → scroll/sorot
  // no-op & timer 2,5 dtk membakar flag SEBELUM data tiba.
  useEffect(() => {
    if (!focusGoalId) return;
    // Data belum siap (pertama kali buka tab Tujuan di sesi segar) — JANGAN
    // konsumsi fokus; efek jalan ulang saat goals terisi.
    if (list.length === 0 && isLoading) return;
    setHighlightId(focusGoalId);
    // Scroll setelah render kartu (requestAnimationFrame menunggu paint).
    requestAnimationFrame(() => {
      document.getElementById(focusGoalId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // Sorot 2,5 detik — cukup terlihat, tidak menjadi noise permanen.
    const t = setTimeout(() => {
      setHighlightId(null);
      clearGoalFocus();
    }, 2500);
    return () => clearTimeout(t);
    // `list`/`isLoading` masuk deps AGAR fokus tertunda sampai data siap —
    // setelah data tiba, fokus dikonsumsi tepat sekali lalu ter-clear.
  }, [focusGoalId, clearGoalFocus, list, isLoading]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const openNewForm = useCallback(() => {
    setEditingGoal(null);
    setDialogOpen(true);
  }, []);

  const openEditForm = useCallback((goal: Goal) => {
    setEditingGoal(goal);
    setDialogOpen(true);
  }, []);

  /** PUT + rollback cache saat gagal. */
  const putGoal = useCallback(
    async (goal: Goal, overrides: Partial<Record<string, unknown>>) => {
      // Optimistic update dulu supaya centang milestone terasa instan.
      queryClient.setQueryData<Goal[]>(['goals'], (prev) =>
        (prev ?? []).map((g) => (g.id === goal.id ? { ...g, ...overrides } : g)),
      );
      try {
        const res = await fetch(`/api/goals/${goal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(goalBody(goal, overrides)),
        });
        if (!res.ok) throw new Error('Gagal memperbarui tujuan');
        queryClient.invalidateQueries({ queryKey: ['goals'] });
      } catch {
        toast.error('Gagal memperbarui tujuan. Mencoba memuat ulang data...');
        queryClient.invalidateQueries({ queryKey: ['goals'] });
      }
    },
    [queryClient],
  );

  /** Toggle milestone ke-i — status ikut diturunkan (BUG-M16). */
  const handleToggleMilestone = useCallback(
    (goal: Goal, index: number) => {
      const milestones: GoalMilestone[] = (goal.milestones ?? []).map((m, i) =>
        i === index ? { ...m, done: !m.done } : m,
      );
      void putGoal(goal, { milestones, status: nextStatusForMilestones(goal.status, milestones) });
    },
    [putGoal],
  );

  /** Hapus milestone ke-i (dipanggil setelah konfirmasi di kartu). */
  const handleDeleteMilestone = useCallback(
    (goal: Goal, index: number) => {
      const milestones: GoalMilestone[] = (goal.milestones ?? []).filter((_, i) => i !== index);
      void putGoal(goal, { milestones, status: nextStatusForMilestones(goal.status, milestones) });
    },
    [putGoal],
  );

  /** Tandai selesai (semua milestone ikut selesai) / aktifkan kembali.
   *  TASK 45: celebration sejajar completion habit — confetti kecil dari
   *  tombol asal + toast yang lebih personal. Logika PUT tidak berubah. */
  const handleCompleteGoal = useCallback(
    (goal: Goal, originEl?: HTMLElement | null) => {
      if (goal.status === 'completed') {
        void putGoal(goal, { status: 'active' });
        return;
      }
      const milestones: GoalMilestone[] = (goal.milestones ?? []).map((m) => ({ ...m, done: true }));
      void putGoal(goal, { milestones, status: 'completed' });
      if (originEl && typeof window !== 'undefined') smallPop(originEl);
      toast.success(`Selamat, "${goal.title}" tercapai! 🎉 Nikmati momen ini.`);
    },
    [putGoal],
  );

  /** Hapus tujuan (dipanggil setelah konfirmasi AlertDialog di kartu). */
  const handleDelete = useCallback(
    async (goal: Goal) => {
      try {
        const res = await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Gagal menghapus tujuan');
        }
        queryClient.setQueryData<Goal[]>(['goals'], (prev) =>
          (prev ?? []).filter((g) => g.id !== goal.id),
        );
        // CONNECTED-APP: server melepas Habit.goalId yang mengarah ke tujuan
        // ini — segarkan cache habit supaya chip "Tujuan" hilang segera.
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        toast.success('Tujuan berhasil dihapus');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menghapus tujuan');
        queryClient.invalidateQueries({ queryKey: ['goals'] });
      }
    },
    [queryClient],
  );

  // ── Stat cards ─────────────────────────────────────────────────────────
  const STATS = [
    { label: 'Total Tujuan', value: total, icon: Target, chip: 'chip-teal', tint: 'text-foreground' },
    { label: 'Selesai', value: completed, icon: CheckCircle2, chip: 'chip-emerald', tint: 'text-success' },
    { label: 'Sedang Berjalan', value: ongoing, icon: Flame, chip: 'chip-amber', tint: 'text-warning' },
  ] as const;

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      {/* Header */}
      <PageHeader
        title="Tujuan"
        subtitle="Kelola tujuan jangka panjang dan milestone-nya"
        icon={Target}
        eyebrow="Sektor"
      >
        <Button onClick={openNewForm} className="btn-primary-gradient">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tujuan Baru
        </Button>
      </PageHeader>

      {/* Stat cards — premium-fade-up stagger (pola 2-c) */}
      <div className="grid grid-cols-3 gap-3">
        {STATS.map((stat, i) => {
          const StatIcon = stat.icon;
          return (
            <div
              key={stat.label}
              className="premium-card premium-card-sheen rounded-2xl p-3 sm:p-4 space-y-2 premium-fade-up"
              style={{ animationDelay: `${40 + i * 50}ms` }}
            >
              <span className={cn('chip-icon h-9 w-9', stat.chip)} aria-hidden="true">
                <StatIcon className="h-4 w-4" />
              </span>
              <p className={cn('premium-stat text-2xl sm:text-3xl', stat.tint)}>
                <CountUpNumber value={stat.value} />
              </p>
              {/* min-h-7: angka tetap sejajar saat label wrap di mobile */}
              <p className="premium-label min-h-7 leading-tight">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Konten */}
      {isLoading ? (
        <GoalsSkeleton />
      ) : isError ? (
        // fix 6-a FIX-5: error state eksplisit + Coba Lagi (refetch).
        <div className="premium-card premium-empty rounded-2xl min-h-[20rem]">
          <div className="premium-empty-orb">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-foreground">Gagal Memuat Tujuan</p>
          <p className="max-w-sm text-xs text-muted-foreground/70 -mt-0.5">
            Terjadi kendala saat mengambil data tujuan. Periksa koneksi kamu lalu coba lagi.
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()} className="mt-2">
            <Loader2 className="h-4 w-4" aria-hidden="true" />
            Coba Lagi
          </Button>
        </div>
      ) : list.length === 0 ? (
        // Empty state premium (pola 2-c): orb Target + headline + CTA.
        <div className="premium-card premium-empty rounded-2xl min-h-[22rem]">
          <div className="premium-empty-orb">
            <Target className="h-9 w-9" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-foreground">Mulai Milestone Pertamamu</p>
          <p className="max-w-sm text-xs text-muted-foreground/70 -mt-0.5">
            Tujuan besar dicapai lewat langkah kecil. Buat tujuan pertama kamu, pecah jadi
            milestone, dan rayakan tiap centangnya.
          </p>
          <Button size="sm" onClick={openNewForm} className="btn-primary-gradient mt-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tujuan Baru
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((goal, i) => (
            <div
              key={goal.id}
              className="premium-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <GoalCard
                goal={goal}
                supportingHabits={supportingByGoal.get(goal.id)}
                highlight={highlightId === goal.id}
                onEdit={openEditForm}
                onComplete={handleCompleteGoal}
                onDelete={(g) => void handleDelete(g)}
                onToggleMilestone={handleToggleMilestone}
                onDeleteMilestone={handleDeleteMilestone}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dialog tambah/edit — key berganti agar state form reset per mode. */}
      <GoalFormDialog
        key={editingGoal?.id ?? 'baru'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editingGoal}
      />
    </div>
  );
}
