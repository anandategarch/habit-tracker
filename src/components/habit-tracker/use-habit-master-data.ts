'use client';

// components/habit-tracker/use-habit-master-data.ts — lapisan data Habit
// Master (hasil pemecahan habit-master.tsx, Task 71-b): query habits /
// habit-groups / habit-options + seluruh mutasi server (create/update form,
// delete, toggle status, arsip/pulihkan, quick-add, CRUD grup) dengan
// optimistic update, invalidasi, dan toast yang PERSIS implementasi lama.
// Kontrak dijaga: kunci React Query, endpoint API, payload, urutan toast.

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { jakartaDateString } from '@/lib/jakarta-date';
import {
  type Habit,
  type HabitGroup,
  type HabitFormData,
  habitStatus,
} from './habit-master-types';

export function useHabitMasterData() {
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();

  // fix 6-d FOCUS-STALE-1: deep-link openHabitFocus(id) yang belum terkonsumsi
  // bisa mengarah ke habit yang barusan dihapus — deleteHabit membersihkan
  // fokus di store bila cocok.
  const focusHabitId = useAppStore(s => s.focusHabitId);
  const clearHabitFocus = useAppStore(s => s.clearHabitFocus);

  // Opsi label habit (kategori/prioritas/kesulitan) dari /api/habit-options.
  // useHabitOptions mengembalikan query mentah — turunkan ke daftar + map
  // label→opsi (warna dot) untuk form + tabel.
  const optionsQuery = useHabitOptions();
  const habitOptions = optionsQuery.data ?? [];
  const categories = habitOptions.filter(o => o.type === 'category');
  const priorities = habitOptions.filter(o => o.type === 'priority');
  const difficulties = habitOptions.filter(o => o.type === 'difficulty');
  const categoryMap = new Map(categories.map(o => [o.label, o]));
  const priorityMap = new Map(priorities.map(o => [o.label, o]));
  const difficultyMap = new Map(difficulties.map(o => [o.label, o]));

  // ── Fetch habits ─────────────────────────────────────────────────────────

  const { data: habits = [], isLoading: loading } = useQuery<Habit[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Failed to fetch habits');
      const json = await res.json();
      // Kontrak API: { habits: Habit[] } (urut sortOrder server-side).
      // Fallback array untuk toleransi bentuk lama.
      const list = Array.isArray(json) ? json : (json.habits ?? []);
      return list as Habit[];
    },
    staleTime: 30_000,
  });

  // ── Fetch groups ─────────────────────────────────────────────────────────

  const { data: groups = [], isLoading: groupsLoading } = useQuery<HabitGroup[]>({
    queryKey: ['habit-groups'],
    queryFn: async () => {
      const res = await fetch('/api/habit-groups');
      if (!res.ok) return [];
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.groups ?? []);
      return list as HabitGroup[];
    },
    staleTime: 60_000,
  });

  const invalidateHabits = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['habit-groups'] });
    triggerRefresh();
  }, [queryClient, triggerRefresh]);

  // ── Mutasi: simpan form (create/update) ────────────────────────────────
  // Dipanggil oleh sesi dialog (use-habit-master-form). Validasi form
  // dilakukan SEBELUM pemanggilan (di hook sesi) agar urutan toast dan
  // perilaku tombol disabled identik dengan implementasi lama.

  async function submitHabit(
    form: HabitFormData,
    editingId: string | null,
  ): Promise<boolean> {
    try {
      // Payload mengikuti schema Prisma (emoji, isActive, isArchived,
      // sortOrder, vacationUntil) — kolom icon/color/status/order/endDate
      // tidak ada di schema.
      const editingHabit = editingId ? habits.find(h => h.id === editingId) : undefined;
      const payload = {
        ...form,
        name: form.name.trim(),
        emoji: form.icon || '🎯',
        reminder: form.reminder || null,
        notes: form.notes || null,
        // BUG-3 fix: clamp target to 1 — UI only supports binary completion.
        // (Also serves as a safety net for legacy habits edited with target>1.)
        // PHASE3-HABIT: for "amount" habits (daily goal with numeric target),
        // allow target > 1 (up to 1000 — see the form's max attribute).
        target: form.habitType === 'amount' ? Math.min(1000, Math.max(1, form.target || 1)) : 1,
        // Task 36 — Target Lulus: null = habit selamanya; habit 'avoid'
        // tidak punya garis finis. graduatedAt TIDAK dikirim dari form —
        // kelulusan hanya lewat tombol wisuda (tracker) supaya edit biasa
        // tidak kebetulan menghapus status lulus.
        targetDays: form.habitType === 'avoid' ? null : form.targetDays ?? null,
        // Task 37 — Jadwal Tampil: serialisasi jadwal ke kolom scheduleJson
        // (null = setiap hari). Dikirim sebagai string JSON — API menormalkan
        // (dedup + urut) dan menolak jadwal kosong.
        scheduleJson:
          form.scheduleKind === 'daily'
            ? null
            : form.scheduleKind === 'weekly'
              ? JSON.stringify({ kind: 'weekly', days: [...form.scheduleDays].sort((a, b) => a - b) })
              : JSON.stringify({ kind: 'monthly', dates: [...form.scheduleDates].sort((a, b) => a - b) }),
        // targetType is preserved from the form (default 'daily' for new
        // habits; existing habits keep their value). Non-daily options are
        // disabled in the dropdown so users can't pick an unsupported mode,
        // but we don't overwrite legacy values on save (BUG-14 minimal fix).
        targetType: form.targetType || 'daily',
        groupId: form.groupId || null,
        // CONNECTED-APP (Task 49): link habit → tujuan (null = lepas).
        goalId: form.goalId || null,
        sortOrder: editingHabit ? (editingHabit.sortOrder ?? habits.length) : habits.length,
        // Status form aktif/dijeda → flag schema; arsip dipertahankan saat edit.
        isActive: form.status === 'active',
        isArchived: editingHabit ? !!editingHabit.isArchived : false,
        // PHASE1-HABIT: vacation mode + end date. Empty string → null so the
        // API stores null (indefinite vacation) rather than an empty date.
        vacationMode: form.vacationMode,
        vacationUntil: form.vacationEnd || null,
        startDate: form.startDate || jakartaDateString(),
        // PHASE3-HABIT: habit type ("normal" | "avoid" | "amount"). Controls
        // how the daily-tracker interprets the checkbox and how the card is
        // displayed (avoid → red relapse state, amount → progress bar).
        habitType: form.habitType,
      };

      if (editingId) {
        // Update
        const res = await fetch(`/api/habits/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update habit');
        // Optimistic update
        queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
          prev.map((h) =>
            h.id === editingId ? { ...h, ...payload, updatedAt: new Date().toISOString() } : h
          )
        );
        // Task 61-f (audit 61-d P2): rekonsiliasi server — setQueryData
        // optimistik tercemar field form (normalisasi/default API tidak
        // tercermin); tanpa invalidasi cache ['habits'] tak pernah dicek ulang.
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        toast.success('Habit berhasil diperbarui');
      } else {
        // Create
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create habit');
        const newHabit = await res.json();
        // Optimistic update
        queryClient.setQueryData<Habit[]>(['habits'], (prev = []) => [...prev, newHabit]);
        // Task 61-f (audit 61-d P2): rekonsiliasi server pasca-create (urut
        // sortOrder + normalisasi payload — putusan akhir ada di server).
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        toast.success('Habit berhasil dibuat');
        // CONNECTED-APP: pulangkan user ke konteks asal quick-add (Hari Ini /
        // Tracker) — penanganan returnTab (BUGHUNT-47 47-d #4) ada di hook
        // sesi dialog (use-habit-master-form) yang tahu sesi pembukaannya.
      }

      triggerRefresh();
      return true;
    } catch {
      toast.error(editingId ? 'Gagal memperbarui habit' : 'Gagal membuat habit');
      // Re-fetch on failure
      invalidateHabits();
      return false;
    }
  }

  // ── Mutasi: hapus habit ────────────────────────────────────────────────

  async function deleteHabit(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete habit');
      // Optimistic update
      queryClient.setQueryData<Habit[]>(['habits'], (prev = []) => (prev).filter((h) => h.id !== id));
      // CONNECTED-APP: kalender Riwayat + batch log bulanan masih memuat log
      // habit yang dihapus — ikut di-invalidate (triggerRefresh hanya
      // menyegarkan dashboard/insight, bukan react-query kalender).
      queryClient.invalidateQueries({ queryKey: ['habit-logs-batch'] });
      queryClient.invalidateQueries({ queryKey: ['daily-logs-month'] });
      // fix 6-d FOCUS-STALE-1: bersihkan fokus deep-link bila mengarah ke
      // habit yang barusan dihapus (tracker tidak mem-mount dialog 404).
      if (focusHabitId === id) clearHabitFocus();
      toast.success('Habit berhasil dihapus');
      triggerRefresh();
      return true;
    } catch {
      toast.error('Gagal menghapus habit');
      invalidateHabits();
      return false;
    }
  }

  // ── Mutasi: aktif/dijeda (toggle status) ───────────────────────────────

  async function toggleStatus(h: Habit) {
    // Schema: flag isActive (bukan status string) — aktif ↔ dijeda.
    const newActive = !h.isActive;
    const statusLabel = newActive ? 'dilanjutkan' : 'dijeda';
    // Optimistic
    queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
      prev.map((x) => (x.id === h.id ? { ...x, isActive: newActive } : x))
    );
    try {
      const res = await fetch(`/api/habits/${h.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) throw new Error();
      // Task 61-f (audit 61-d P2): rekonsiliasi server pasca-toggle (setQueryData
      // optimistik di atas hanya menulis isActive).
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success(`Habit ${statusLabel}`);
      triggerRefresh();
    } catch {
      toast.error(`Gagal ${statusLabel} habit`);
      invalidateHabits();
    }
  }

  // ── Mutasi: arsipkan / pulihkan ────────────────────────────────────────

  async function archiveHabit(h: Habit) {
    // Schema: flag isArchived — arsipkan ↔ pulihkan.
    const newArchived = !h.isArchived;
    const label = newArchived ? 'diarsipkan' : 'dipulihkan';
    queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
      prev.map((x) => (x.id === h.id ? { ...x, isArchived: newArchived } : x))
    );
    try {
      const res = await fetch(`/api/habits/${h.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newArchived }),
      });
      if (!res.ok) throw new Error();
      // Task 61-f (audit 61-d P2): rekonsiliasi server pasca-arsip/pulihkan
      // (setQueryData optimistik di atas hanya menulis isArchived).
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success(`Habit ${label}`);
      triggerRefresh();
    } catch {
      toast.error(`Gagal ${label} habit`);
      invalidateHabits();
    }
  }

  // ── Mutasi: quick-add bar ──────────────────────────────────────────────

  async function quickAddHabit(name: string, icon: string): Promise<boolean> {
    try {
      // Default label Indonesia (konsisten seed: kategori Umum, label
      // Sedang) dengan fallback ke opsi pertama yang tersedia.
      const payload = {
        name: name.trim(),
        emoji: icon || '🎯',
        category: categories.find(c => c.label === 'Umum')?.label ?? categories[0]?.label ?? 'Umum',
        priority: priorities.find(p => p.label === 'Sedang')?.label ?? priorities[0]?.label ?? 'Sedang',
        difficulty: difficulties.find(d => d.label === 'Sedang')?.label ?? difficulties[0]?.label ?? 'Sedang',
        target: 1,
        targetType: 'daily',
        trackTime: false,
        reminder: null,
        notes: null,
        groupId: null,
        habitType: 'normal',
        sortOrder: habits.length,
        isActive: true,
        isArchived: false,
        vacationMode: false,
        vacationUntil: null,
        startDate: jakartaDateString(),
      };
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const newHabit = await res.json();
      queryClient.setQueryData<Habit[]>(['habits'], (prev = []) => [...prev, newHabit]);
      // Task 61-f (audit 61-d P2): jalur create ke-5 (quick-add bar) — pola
      // rekonsiliasi server yang sama dengan create/edit di atas.
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast.success('Habit berhasil ditambah!');
      triggerRefresh();
      return true;
    } catch {
      toast.error('Gagal menambah habit');
      return false;
    }
  }

  // ── Mutasi: grup habit ─────────────────────────────────────────────────

  async function createGroup(name: string, color: string): Promise<boolean> {
    try {
      const res = await fetch('/api/habit-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          color: color || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create group');
      toast.success('Grup berhasil dibuat');
      invalidateHabits();
      return true;
    } catch {
      toast.error('Gagal membuat grup');
      return false;
    }
  }

  async function deleteGroup(id: string) {
    try {
      // Kontrak API: DELETE /api/habit-groups/[id] (habit anggota di-set-null
      // server-side sebelum hapus).
      const res = await fetch(`/api/habit-groups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete group');
      toast.success('Grup berhasil dihapus');
      invalidateHabits();
    } catch {
      toast.error('Gagal menghapus grup');
    }
  }

  return {
    // Query + derived
    habits,
    loading,
    groups,
    groupsLoading,
    categories,
    priorities,
    difficulties,
    categoryMap,
    priorityMap,
    difficultyMap,
    // Mutasi + utilitas cache
    invalidateHabits,
    submitHabit,
    deleteHabit,
    toggleStatus,
    archiveHabit,
    quickAddHabit,
    createGroup,
    deleteGroup,
  };
}

// ── Derived state: filter habit ──────────────────────────────────────────
// (dipisah sebagai helper murni agar state filter tetap di komposisi root
// tanpa mengubah logika pencocokan lama).

export function filterHabits(
  habits: Habit[],
  search: string,
  categoryFilter: string,
  statusFilter: string,
): Habit[] {
  return habits.filter((h) => {
    const matchSearch =
      !search ||
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.emoji.includes(search);
    const matchCategory =
      categoryFilter === 'all' || h.category === categoryFilter;
    // Schema Prisma memakai flag isActive/isArchived (bukan kolom status) —
    // status tampilan diturunkan lewat habitStatus().
    const matchStatus =
      statusFilter === 'all' || habitStatus(h) === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });
}
