'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
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
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Clock,
  History,
  Palmtree,
  Shield,
  Ban,
  Gauge,
  Sprout,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { deriveColorFromEmoji } from '@/lib/emoji-color';
import { Skeleton } from '@/components/ui/skeleton';
import { TimePicker } from './time-picker';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { useHabitOptions } from '@/hooks/use-habit-options';
import { jakartaDateString } from '@/lib/jakarta-date';

// ── Types & Constants (imported from habit-master-types) ──────────────────
import {
  type Habit, type HabitGroup, type HabitFormData,
  TARGET_TYPES, STATUSES, DEFAULT_EMOJIS,
  emptyForm, habitToForm,
} from './habit-master-types';
// Sub-components
import { QuickAddBar } from './habit-quick-add';
import { FiltersBar } from './habit-filters';
import { HabitGroupsSection } from './habit-groups-section';
import { HabitTable } from './habit-table';
import { HabitMobileCards } from './habit-mobile-cards';

// ── Component ────────────────────────────────────────────────────────────────

export default function HabitMaster() {
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();
  const { categories, priorities, difficulties, categoryMap, priorityMap, difficultyMap } = useHabitOptions();

  // Data state

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HabitFormData>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick add
  const [quickName, setQuickName] = useState('');
  const [quickIcon, setQuickIcon] = useState('🎯');
  const [quickAdding, setQuickAdding] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formEmojiPicker, setFormEmojiPicker] = useState(false);

  // Groups
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('📌');
  const [newGroupColor, setNewGroupColor] = useState('#22c55e');
  const [addingGroup, setAddingGroup] = useState(false);
  const [showGroupEmojiPicker, setShowGroupEmojiPicker] = useState(false);

  // ── Fetch habits ─────────────────────────────────────────────────────────

  const { data: habits = [], isLoading: loading } = useQuery<Habit[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Failed to fetch habits');
      const data = await res.json();
      data.sort((a: Habit, b: Habit) => a.order - b.order);
      return data;
    },
    staleTime: 30_000,
  });

  // ── Fetch groups ─────────────────────────────────────────────────────────

  const { data: groups = [], isLoading: groupsLoading } = useQuery<HabitGroup[]>({
    queryKey: ['habit-groups'],
    queryFn: async () => {
      const res = await fetch('/api/habit-groups');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const invalidateHabits = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
    queryClient.invalidateQueries({ queryKey: ['habit-groups'] });
    triggerRefresh();
  }, [queryClient, triggerRefresh]);

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      const res = await fetch('/api/habit-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          emoji: newGroupEmoji || null,
          color: newGroupColor || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create group');
      toast.success('Grup berhasil dibuat');
      setNewGroupName('');
      setNewGroupEmoji('📌');
      setNewGroupColor('#22c55e');
      invalidateHabits();
    } catch {
      toast.error('Gagal membuat grup');
    } finally {
      setAddingGroup(false);
    }
  }

  async function handleDeleteGroup(id: string) {
    try {
      const res = await fetch(`/api/habit-groups?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete group');
      toast.success('Grup berhasil dihapus');
      invalidateHabits();
    } catch {
      toast.error('Gagal menghapus grup');
    }
  }

  // ── Filtered habits ─────────────────────────────────────────────────────

  const filteredHabits = habits.filter((h) => {
    const matchSearch =
      !search ||
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.icon.includes(search);
    const matchCategory =
      categoryFilter === 'all' || h.category === categoryFilter;
    const matchStatus =
      statusFilter === 'all' || h.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  // ── CRUD Handlers ──────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(h: Habit) {
    setEditingId(h.id);
    setForm(habitToForm(h));
    setDialogOpen(true);
  }

  // BUGHUNT-ROUND2 FAB-1: FAB quick-add consumer. The mobile FAB "Habit
  // Baru" button navigates to the Settings tab; settings.tsx switches to
  // the 'habits' section (mounting this component), then this effect opens
  // the add-habit dialog and clears the store action. If the user is
  // already on this section, it fires directly.
  const quickAddAction = useAppStore(s => s.quickAddAction);
  const clearQuickAdd = useAppStore(s => s.clearQuickAdd);
  const openAddRef = useRef(openAdd);
  openAddRef.current = openAdd;
  useEffect(() => {
    if (quickAddAction === 'habit') {
      openAddRef.current();
      clearQuickAdd();
    }
  }, [quickAddAction, clearQuickAdd]);

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Nama habit wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        reminder: form.reminder || null,
        endDate: form.endDate || null,
        notes: form.notes || null,
        // BUG-3 fix: clamp target to 1 — UI only supports binary completion.
        // (Also serves as a safety net for legacy habits edited with target>1.)
        // PHASE3-HABIT: for "amount" habits (daily goal with numeric target),
        // allow target > 1 (up to 1000 — see the form's max attribute).
        target: form.habitType === 'amount' ? Math.min(1000, Math.max(1, form.target || 1)) : 1,
        // targetType is preserved from the form (default 'daily' for new
        // habits; existing habits keep their value). Non-daily options are
        // disabled in the dropdown so users can't pick an unsupported mode,
        // but we don't overwrite legacy values on save (BUG-14 minimal fix).
        targetTime: form.targetTime || null,
        trackLastDone: form.trackLastDone,
        lastDoneInterval: form.lastDoneInterval || null,
        groupId: form.groupId || null,
        // PHASE1-HABIT: vacation mode + end date. Empty string → null so the
        // API stores null (indefinite vacation) rather than an empty date.
        vacationMode: form.vacationMode,
        vacationEnd: form.vacationEnd || null,
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
        toast.success('Habit berhasil dibuat');
      }

      setDialogOpen(false);
      triggerRefresh();
    } catch {
      toast.error(editingId ? 'Gagal memperbarui habit' : 'Gagal membuat habit');
      // Re-fetch on failure
      invalidateHabits();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/habits/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete habit');
      // Optimistic update
      queryClient.setQueryData<Habit[]>(['habits'], (prev = []) => (prev).filter((h) => h.id !== deleteId));
      toast.success('Habit berhasil dihapus');
      setDeleteId(null);
      triggerRefresh();
    } catch {
      toast.error('Gagal menghapus habit');
      invalidateHabits();
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleStatus(h: Habit) {
    const newStatus = h.status === 'active' ? 'paused' : 'active';
    const statusLabel = newStatus === 'paused' ? 'dijeda' : 'dilanjutkan';
    // Optimistic
    queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
      prev.map((x) => (x.id === h.id ? { ...x, status: newStatus } : x))
    );
    try {
      const res = await fetch(`/api/habits/${h.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Habit ${statusLabel}`);
      triggerRefresh();
    } catch {
      toast.error(`Gagal ${statusLabel} habit`);
      invalidateHabits();
    }
  }

  async function handleArchive(h: Habit) {
    const newStatus = h.status === 'archived' ? 'active' : 'archived';
    const label = newStatus === 'archived' ? 'diarsipkan' : 'dipulihkan';
    queryClient.setQueryData<Habit[]>(['habits'], (prev = []) =>
      prev.map((x) => (x.id === h.id ? { ...x, status: newStatus } : x))
    );
    try {
      const res = await fetch(`/api/habits/${h.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Habit ${label}`);
      triggerRefresh();
    } catch {
      toast.error(`Gagal ${label} habit`);
      invalidateHabits();
    }
  }

  async function handleQuickAdd() {
    if (!quickName.trim()) return;
    setQuickAdding(true);
    try {
      const payload = {
        name: quickName.trim(),
        icon: quickIcon,
        category: 'General',
        priority: 'Medium' as const,
        difficulty: 'Medium' as const,
        target: 1,
        targetType: 'daily' as const,
        color: '#22c55e',
        reminder: null,
        startDate: jakartaDateString(),
        endDate: null,
        status: 'active' as const,
        notes: null,
        order: habits.length,
      };
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const newHabit = await res.json();
      queryClient.setQueryData<Habit[]>(['habits'], (prev = []) => [...prev, newHabit]);
      setQuickName('');
      toast.success('Habit berhasil ditambah!');
      triggerRefresh();
    } catch {
      toast.error('Gagal menambah habit');
    } finally {
      setQuickAdding(false);
    }
  }

  // ── Form field updater ─────────────────────────────────────────────────

  function updateForm<K extends keyof HabitFormData>(key: K, value: HabitFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Habit Master"
        description="Kelola dan atur semua habit kamu di satu tempat."
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openAdd}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Habit Baru
              </Button>
            </DialogTrigger>

          {/* ── Add / Edit Dialog ─────────────────────────────────────── */}
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle asChild>
                <div className="flex items-center gap-3 pr-8">
                  <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
                    <Sprout className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="premium-label">Habit Master</p>
                    <span className="block text-lg font-semibold leading-tight">
                      {editingId ? 'Edit Habit' : 'Buat Habit Baru'}
                    </span>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-2">
              {/* Row: Name + Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="habit-name">
                    Nama <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="habit-name"
                    placeholder="misal Meditasi Pagi"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="relative">
                    <Input
                      className="w-20 text-center text-xl rounded-xl"
                      value={form.icon}
                      onChange={(e) => {
                        const icon = e.target.value;
                        updateForm('icon', icon);
                        // Auto-derive color when icon changes (manual type)
                        if (icon) {
                          // BUG-1 fix: include ALL habits (active + paused + archived)
                          // in conflict check. A paused/archived habit's color is
                          // still "taken" — if we exclude it, un-pausing later
                          // could reveal a duplicate color.
                          const existingColors = habits
                            .filter(h => h.id !== editingId)
                            .map(h => h.color)
                            .filter((c): c is string => !!c);
                          const derived = deriveColorFromEmoji(icon, existingColors);
                          updateForm('color', derived);
                        }
                      }}
                      onFocus={() => setFormEmojiPicker(true)}
                      maxLength={11}
                    />
                    {formEmojiPicker && (
                      <div className="absolute top-full mt-1.5 z-50 rounded-2xl border border-border bg-popover/95 backdrop-blur shadow-lg p-2 grid grid-cols-4 gap-1 w-48">
                        {DEFAULT_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="text-2xl hover:bg-accent rounded-xl p-1.5 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                            onClick={() => {
                              updateForm('icon', e);
                              // Auto-derive color from emoji — extract dominant
                              // color via Canvas, resolve conflicts with existing
                              // habits' colors so no two share the same hue.
                              // BUG-1 fix: include ALL habits (active + paused +
                              // archived) — paused habit's color is still "taken".
                              const existingColors = habits
                                .filter(h => h.id !== editingId)
                                .map(h => h.color)
                                .filter((c): c is string => !!c);
                              const derived = deriveColorFromEmoji(e, existingColors);
                              updateForm('color', derived);
                              setFormEmojiPicker(false);
                            }}
                          >
                            {e}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="col-span-4 text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                          onClick={() => setFormEmojiPicker(false)}
                        >
                          tutup
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row: Category + Priority + Grup */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => updateForm('category', v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioritas</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => updateForm('priority', v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grup</Label>
                  <Select
                    value={form.groupId || '__none__'}
                    onValueChange={(v) => updateForm('groupId', v === '__none__' ? null : v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Tanpa Grup" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Tanpa Grup</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.emoji || '📌'} {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row: Target + Target Type + Color */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Target</Label>
                  <Input
                    type="number"
                    min={1}
                    max={form.habitType === 'amount' ? 1000 : 1}
                    value={form.target}
                    onChange={(e) => {
                      // BUG-3 fix: clamp target to 1. The UI only sends binary
                      // completion (done/not-done); allowing target > 1 would
                      // create a habit that can never be "completed" since the
                      // UI never increments `value` past 1. Existing habits
                      // with target > 1 (legacy data) are left untouched by
                      // this clamp — only new edits are affected.
                      //
                      // PHASE3-HABIT: for "amount" habits (daily goal with a
                      // numeric target, e.g. "drink 2L water"), allow target
                      // up to 1000. The HabitLog.value column tracks progress
                      // toward this target.
                      const max = form.habitType === 'amount' ? 1000 : 1;
                      const n = Number(e.target.value) || 1;
                      updateForm('target', Math.min(max, Math.max(1, n)));
                    }}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.habitType === 'amount'
                      ? 'Target harian (mis. 2 untuk 2 gelas, 30 untuk 30 menit).'
                      : 'Multi-completion (target > 1) belum didukung.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Tipe Target</Label>
                  <Select
                    value={form.targetType}
                    onValueChange={(v) => updateForm('targetType', v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_TYPES.map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                          // BUG-14 fix: weekly/monthly target types are stored
                          // on the habit but the UI/completion logic treats
                          // every habit as daily. Disable non-daily options to
                          // prevent users from selecting an unsupported mode
                          // (existing habits with targetType=weekly/monthly
                          // remain editable; the field is preserved on save).
                          disabled={t !== 'daily'}
                        >
                          {t === 'daily' ? 'Harian' : t === 'weekly' ? 'Mingguan' : 'Bulanan'}
                          {t !== 'daily' ? ' (segera)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Hanya &lsquo;Harian&rsquo; yang didukung saat ini.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Level Kesulitan</Label>
                  <Select
                    value={form.difficulty}
                    onValueChange={(v) => updateForm('difficulty', v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map((d) => (
                        <SelectItem key={d.name} value={d.name}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* PHASE3-HABIT: Habit type selector (Normal / Avoid / Amount).
                  Controls how the daily-tracker interprets the checkbox and
                  how the habit card is displayed.
                    normal → checking = success (green). Default.
                    avoid  → checking = relapse (red). Streak = days WITHOUT
                             a check. Use for "quit" habits (no smoking, no
                             sugar, no social media before noon).
                    amount → daily goal with numeric target (e.g. "drink 2L
                             water", "read 30 pages"). HabitLog.value tracks
                             progress toward habit.target. */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  {
                    value: 'normal',
                    label: 'Normal',
                    desc: 'Centang = selesai',
                    icon: <Shield className="h-4 w-4" />,
                    tint: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/10',
                    active: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30',
                  },
                  {
                    value: 'avoid',
                    label: 'Hindari',
                    desc: 'Centang = kambuh (merah)',
                    icon: <Ban className="h-4 w-4" />,
                    tint: 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10',
                    active: 'border-red-500 bg-red-50 dark:bg-red-950/30 ring-2 ring-red-500/30',
                  },
                  {
                    value: 'amount',
                    label: 'Jumlah',
                    desc: 'Target harian (mis. 2L air)',
                    icon: <Gauge className="h-4 w-4" />,
                    tint: 'border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/10',
                    active: 'border-sky-500 bg-sky-50 dark:bg-sky-950/30 ring-2 ring-sky-500/30',
                  },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateForm('habitType', opt.value)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-all flex items-start gap-2',
                      opt.tint,
                      form.habitType === opt.value
                        ? opt.active
                        : 'hover:bg-accent/40',
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      {opt.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {opt.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground leading-snug">
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {form.habitType === 'avoid' && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Streak dihitung sebagai hari berturut-turut tanpa centang.
                  Cocok untuk &ldquo;berhenti&rdquo; habit (tidak merokok, tidak
                  gula, tidak scroll medsos pagi).
                </p>
              )}
              {form.habitType === 'amount' && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Gunakan kolom Target di atas untuk menetapkan target harian.
                  Pelacakan progres per hari akan tampil di kartu habit.
                </p>
              )}

              {/* Row: Color preview (auto-derived from emoji, no manual picker) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Warna</Label>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-9 w-9 rounded-md border border-border shrink-0"
                      style={{ backgroundColor: form.color }}
                      aria-label={`Warna otomatis: ${form.color}`}
                    />
                    <p className="text-xs text-muted-foreground">Otomatis dari emoji</p>
                  </div>
                </div>
              </div>

              {/* Row: Reminder + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pengingat</Label>
                  <Input
                    placeholder="misal 08:00"
                    value={form.reminder ?? ''}
                    onChange={(e) => updateForm('reminder', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateForm('status', v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s === 'active' ? 'Aktif' : s === 'paused' ? 'Dijeda' : 'Diarsipkan'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row: Start Date + End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Mulai</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateForm('startDate', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Berakhir <span className="text-muted-foreground text-xs">(opsional)</span></Label>
                  <Input
                    type="date"
                    value={form.endDate ?? ''}
                    onChange={(e) => updateForm('endDate', e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Track Time */}
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="track-time" className="cursor-pointer">Track Waktu</Label>
                  </div>
                  <Switch
                    id="track-time"
                    checked={form.trackTime}
                    onCheckedChange={(v) => updateForm('trackTime', v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Catat waktu saat habit dicentang. Cocok untuk bangun pagi, olahraga, dll.
                </p>
                {form.trackTime && (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="target-time">
                      Target Jam <span className="text-muted-foreground text-xs">(opsional)</span>
                    </Label>
                    <TimePicker
                      value={form.targetTime || '07:00'}
                      onChange={(v) => updateForm('targetTime', v)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Digunakan untuk menghitung apakah kamu tepat waktu.
                    </p>
                  </div>
                )}
              </div>

              {/* Track Last Done */}
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="track-last-done" className="cursor-pointer">Track Terakhir</Label>
                  </div>
                  <Switch
                    id="track-last-done"
                    checked={form.trackLastDone}
                    onCheckedChange={(v) => updateForm('trackLastDone', v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Tampilkan di dashboard kapan terakhir kali habit ini dikerjakan.
                </p>
                {form.trackLastDone && (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="last-done-interval">
                      Interval <span className="text-muted-foreground text-xs">(opsional, misal: 3d, 1w)</span>
                    </Label>
                    <Input
                      id="last-done-interval"
                      placeholder="3d"
                      value={form.lastDoneInterval || ''}
                      onChange={(e) => updateForm('lastDoneInterval', e.target.value)}
                      className="w-40 rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Contoh: 3d = setiap 3 hari, 1w = setiap minggu. Akan ditandai overdue jika lewat.
                    </p>
                  </div>
                )}
              </div>

              {/* PHASE1-HABIT: Vacation Mode */}
              <div className="rounded-xl border p-4 space-y-3 bg-sky-50/40 dark:bg-sky-950/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palmtree className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <Label htmlFor="vacation-mode" className="cursor-pointer">
                      Mode Liburan
                    </Label>
                  </div>
                  <Switch
                    id="vacation-mode"
                    checked={form.vacationMode}
                    onCheckedChange={(v) => updateForm('vacationMode', v)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Jeda habit tanpa memutus streak. Habit tidak dihitung sebagai
                  &ldquo;belum selesai&rdquo; selama liburan. Streak dipertahankan
                  dan akan menyala kembali otomatis setelah tanggal berakhir.
                </p>
                {form.vacationMode && (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="vacation-end">
                      Berakhir Pada{' '}
                      <span className="text-muted-foreground text-xs">
                        (opsional — kosongkan untuk liburan tanpa batas)
                      </span>
                    </Label>
                    <Input
                      id="vacation-end"
                      type="date"
                      value={form.vacationEnd ?? ''}
                      onChange={(e) => updateForm('vacationEnd', e.target.value)}
                      min={jakartaDateString()}
                      className="w-48 rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground">
                      Setelah tanggal ini, mode liburan otomatis nonaktif dan habit
                      kembali ditrack normal.
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea
                  placeholder="Catatan tambahan tentang habit ini..."
                  value={form.notes ?? ''}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  rows={3}
                  className="rounded-xl"
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !form.name.trim()}
                  className="btn-primary-gradient"
                >
                  {submitting ? 'Menyimpan...' : editingId ? 'Perbarui Habit' : 'Buat Habit'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        }
      />

      {/* Quick Add Bar */}
      <QuickAddBar
        quickIcon={quickIcon}
        setQuickIcon={setQuickIcon}
        quickName={quickName}
        setQuickName={setQuickName}
        handleQuickAdd={handleQuickAdd}
        quickAdding={quickAdding}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
      />

      {/* Filters Bar */}
      <FiltersBar
        search={search}
        setSearch={setSearch}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categories={categories}
      />

      {/* Habit Groups */}
      <HabitGroupsSection
        groups={groups}
        groupsLoading={groupsLoading}
        groupsOpen={groupsOpen}
        setGroupsOpen={setGroupsOpen}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        newGroupEmoji={newGroupEmoji}
        setNewGroupEmoji={setNewGroupEmoji}
        newGroupColor={newGroupColor}
        setNewGroupColor={setNewGroupColor}
        showGroupEmojiPicker={showGroupEmojiPicker}
        setShowGroupEmojiPicker={setShowGroupEmojiPicker}
        addingGroup={addingGroup}
        handleCreateGroup={handleCreateGroup}
        handleDeleteGroup={handleDeleteGroup}
      />

      {/* ── Habit List (Desktop Table + Mobile Cards) ────────────────────── */}
      {loading ? (
        // Skeleton — meniru layout baris final (avatar emoji squircle 40px +
        // title bar + meta bar), pola goals-skeleton (div polong premium-card).
        <div className="premium-card rounded-2xl p-4 sm:p-5 space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 py-2.5">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredHabits.length === 0 ? (
        // Empty state premium — orb + headline + CTA (CTA membuka dialog yang
        // sama dengan tombol "Habit Baru" di header).
        <div className="premium-card premium-empty rounded-2xl min-h-[18rem]">
          <div className="premium-empty-orb">
            <Sprout className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Belum Ada Habit</p>
          <p className="text-xs text-muted-foreground/70 -mt-0.5">
            {habits.length === 0
              ? 'Buat habit pertama kamu untuk mulai!'
              : 'Coba ubah pencarian atau filter.'}
          </p>
          {habits.length === 0 && (
            <Button
              size="sm"
              className="btn-primary-gradient mt-2"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" />
              Habit Baru
            </Button>
          )}
        </div>
      ) : (
        <>
          <HabitTable
            habits={filteredHabits}
            categoryMap={categoryMap}
            priorityMap={priorityMap}
            difficultyMap={difficultyMap}
            onEdit={openEdit}
            onToggleStatus={handleToggleStatus}
            onArchive={handleArchive}
            onDelete={setDeleteId}
          />
          <HabitMobileCards
            habits={filteredHabits}
            categoryMap={categoryMap}
            priorityMap={priorityMap}
            difficultyMap={difficultyMap}
            onEdit={openEdit}
            onToggleStatus={handleToggleStatus}
            onArchive={handleArchive}
            onDelete={setDeleteId}
          />
        </>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Habit</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus habit ini? Tindakan ini tidak bisa dibatalkan
              dan semua data tracking yang terkait dengan habit ini akan dihapus
              secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive text-white focus:ring-destructive"
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}