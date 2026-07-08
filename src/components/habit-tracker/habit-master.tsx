'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Pencil,
  Trash2,
  MoreVertical,
  Search,
  Filter,
  ListFilter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface Habit {
  id: string;
  name: string;
  icon: string;
  category: string;
  priority: string;
  difficulty: string;
  target: number;
  targetType: string;
  color: string;
  reminder: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

type HabitFormData = Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>;

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Health',
  'Fitness',
  'Learning',
  'Productivity',
  'Mindfulness',
  'Social',
  'Finance',
  'Creative',
  'General',
] as const;

const PRIORITIES = ['High', 'Medium', 'Low'] as const;
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'] as const;
const TARGET_TYPES = ['daily', 'weekly', 'monthly'] as const;
const STATUSES = ['active', 'paused', 'archived'] as const;

const DEFAULT_EMOJIS = ['🎯', '💪', '📚', '🧘', '🏃', '💧', '🍎', '💤', '✍️', '🎨'];

const CATEGORY_COLORS: Record<string, string> = {
  Health: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Fitness: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Learning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Productivity: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  Mindfulness: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Social: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  Finance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  Creative: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  General: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300',
};

const PRIORITY_STYLES: Record<string, { dot: string; text: string }> = {
  High: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  Medium: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  Low: { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
};

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Hard: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Expert: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800/40 dark:text-slate-400',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyForm(): HabitFormData {
  return {
    name: '',
    icon: '🎯',
    category: 'General',
    priority: 'Medium',
    difficulty: 'Medium',
    target: 1,
    targetType: 'daily',
    color: '#22c55e',
    reminder: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    status: 'active',
    notes: '',
    order: 0,
  };
}

function habitToForm(h: Habit): HabitFormData {
  return {
    name: h.name,
    icon: h.icon,
    category: h.category,
    priority: h.priority,
    difficulty: h.difficulty,
    target: h.target,
    targetType: h.targetType,
    color: h.color,
    reminder: h.reminder ?? '',
    startDate: h.startDate ? h.startDate.split('T')[0] : '',
    endDate: h.endDate ? h.endDate.split('T')[0] : '',
    status: h.status,
    notes: h.notes ?? '',
    order: h.order,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HabitMaster() {
  const { refreshKey, triggerRefresh } = useAppStore();

  // Data state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

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

  // ── Fetch habits ─────────────────────────────────────────────────────────

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Failed to fetch habits');
      const data = await res.json();
      data.sort((a: Habit, b: Habit) => a.order - b.order);
      setHabits(data);
    } catch {
      toast.error('Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits, refreshKey]);

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

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Habit name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        reminder: form.reminder || null,
        endDate: form.endDate || null,
        notes: form.notes || null,
        target: Number(form.target) || 1,
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
        setHabits((prev) =>
          prev.map((h) =>
            h.id === editingId ? { ...h, ...payload, updatedAt: new Date().toISOString() } : h
          )
        );
        toast.success('Habit updated successfully');
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
        setHabits((prev) => [...prev, newHabit]);
        toast.success('Habit created successfully');
      }

      setDialogOpen(false);
      triggerRefresh();
    } catch {
      toast.error(editingId ? 'Failed to update habit' : 'Failed to create habit');
      // Re-fetch on failure
      fetchHabits();
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
      setHabits((prev) => prev.filter((h) => h.id !== deleteId));
      toast.success('Habit deleted successfully');
      setDeleteId(null);
      triggerRefresh();
    } catch {
      toast.error('Failed to delete habit');
      fetchHabits();
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleStatus(h: Habit) {
    const newStatus = h.status === 'active' ? 'paused' : 'active';
    const statusLabel = newStatus === 'paused' ? 'paused' : 'resumed';
    // Optimistic
    setHabits((prev) =>
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
      toast.error(`Failed to ${statusLabel} habit`);
      fetchHabits();
    }
  }

  async function handleArchive(h: Habit) {
    const newStatus = h.status === 'archived' ? 'active' : 'archived';
    const label = newStatus === 'archived' ? 'archived' : 'unarchived';
    setHabits((prev) =>
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
      toast.error(`Failed to ${label} habit`);
      fetchHabits();
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
        startDate: new Date().toISOString().split('T')[0],
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
      setHabits((prev) => [...prev, newHabit]);
      setQuickName('');
      toast.success('Habit added quickly!');
      triggerRefresh();
    } catch {
      toast.error('Failed to add habit');
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Habit Master
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and organize all your habits in one place.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openAdd}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Habit
            </Button>
          </DialogTrigger>

          {/* ── Add / Edit Dialog ─────────────────────────────────────── */}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Habit' : 'Create New Habit'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-5 py-2">
              {/* Row: Name + Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                <div className="space-y-2">
                  <Label htmlFor="habit-name">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="habit-name"
                    placeholder="e.g. Morning Meditation"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="relative">
                    <Input
                      className="w-20 text-center text-xl"
                      value={form.icon}
                      onChange={(e) => updateForm('icon', e.target.value)}
                      onFocus={() => setFormEmojiPicker(true)}
                      maxLength={2}
                    />
                    {formEmojiPicker && (
                      <div className="absolute top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-48">
                        {DEFAULT_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="text-2xl hover:bg-accent rounded p-1 transition-colors"
                            onClick={() => {
                              updateForm('icon', e);
                              setFormEmojiPicker(false);
                            }}
                          >
                            {e}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground p-1 transition-colors"
                          onClick={() => setFormEmojiPicker(false)}
                        >
                          close
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row: Category + Priority + Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => updateForm('category', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => updateForm('priority', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Difficulty</Label>
                  <Select
                    value={form.difficulty}
                    onValueChange={(v) => updateForm('difficulty', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
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
                    value={form.target}
                    onChange={(e) => updateForm('target', Number(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Type</Label>
                  <Select
                    value={form.targetType}
                    onValueChange={(v) => updateForm('targetType', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => updateForm('color', e.target.value)}
                      className="h-9 w-9 rounded-md border cursor-pointer bg-transparent p-0.5"
                    />
                    <Input
                      value={form.color}
                      onChange={(e) => updateForm('color', e.target.value)}
                      className="flex-1"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              {/* Row: Reminder + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reminder</Label>
                  <Input
                    placeholder="e.g. 8:00 AM"
                    value={form.reminder}
                    onChange={(e) => updateForm('reminder', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => updateForm('status', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row: Start Date + End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateForm('startDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => updateForm('endDate', e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes about this habit..."
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !form.name.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Habit' : 'Create Habit'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Add Bar */}
      <Card className="border-dashed border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                className="h-9 w-9 flex items-center justify-center rounded-md border bg-background text-lg hover:bg-accent transition-colors"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {quickIcon}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-48">
                  {DEFAULT_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="text-2xl hover:bg-accent rounded p-1 transition-colors"
                      onClick={() => {
                        setQuickIcon(e);
                        setShowEmojiPicker(false);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground p-1"
                    onClick={() => setShowEmojiPicker(false)}
                  >
                    close
                  </button>
                </div>
              )}
            </div>
            <Input
              placeholder="Quick add a habit..."
              className="flex-1"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd();
              }}
              disabled={quickAdding}
            />
            <Button
              onClick={handleQuickAdd}
              disabled={quickAdding || !quickName.trim()}
              className="bg-green-600 hover:bg-green-700 text-white gap-1 shrink-0"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search habits..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Desktop Table ──────────────────────────────────────────────── */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-muted animate-pulse rounded-md"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredHabits.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-muted-foreground font-medium">No habits found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {habits.length === 0
                ? 'Create your first habit to get started!'
                : 'Try adjusting your search or filters.'}
            </p>
            {habits.length === 0 && (
              <Button
                onClick={openAdd}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Habit
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12" />
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHabits.map((habit) => (
                      <TableRow key={habit.id} className="group">
                        <TableCell className="text-xl font-medium">
                          {habit.icon}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: habit.color }}
                            />
                            <span className="font-medium">{habit.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'font-medium border-0',
                              CATEGORY_COLORS[habit.category] ?? CATEGORY_COLORS.General
                            )}
                          >
                            {habit.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                PRIORITY_STYLES[habit.priority]?.dot
                              )}
                            />
                            <span
                              className={cn(
                                'text-sm font-medium',
                                PRIORITY_STYLES[habit.priority]?.text
                              )}
                            >
                              {habit.priority}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'font-medium border-0',
                              DIFFICULTY_STYLES[habit.difficulty]
                            )}
                          >
                            {habit.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {habit.target} / {habit.targetType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'font-medium border-0 capitalize',
                              STATUS_STYLES[habit.status]
                            )}
                          >
                            {habit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(habit)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(habit)}
                              >
                                {habit.status === 'active' ? 'Pause' : 'Resume'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleArchive(habit)}>
                                {habit.status === 'archived' ? 'Unarchive' : 'Archive'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteId(habit.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3 max-h-[600px] overflow-y-auto">
            {filteredHabits.map((habit) => (
              <Card key={habit.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl mt-0.5 shrink-0">{habit.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: habit.color }}
                          />
                          <span className="font-semibold text-sm truncate">
                            {habit.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[11px] px-1.5 py-0 border-0',
                              CATEGORY_COLORS[habit.category] ?? CATEGORY_COLORS.General
                            )}
                          >
                            {habit.category}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[11px] px-1.5 py-0 border-0',
                              DIFFICULTY_STYLES[habit.difficulty]
                            )}
                          >
                            {habit.difficulty}
                          </Badge>
                          <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                            {habit.target}/{habit.targetType}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[11px] px-1.5 py-0 border-0 capitalize',
                              STATUS_STYLES[habit.status]
                            )}
                          >
                            {habit.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              PRIORITY_STYLES[habit.priority]?.dot
                            )}
                          />
                          <span
                            className={cn(
                              'text-xs',
                              PRIORITY_STYLES[habit.priority]?.text
                            )}
                          >
                            {habit.priority} priority
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(habit)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(habit)}>
                          {habit.status === 'active' ? 'Pause' : 'Resume'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleArchive(habit)}>
                          {habit.status === 'archived' ? 'Unarchive' : 'Archive'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(habit.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Habit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this habit? This action cannot be
              undone and all tracking data associated with this habit will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}