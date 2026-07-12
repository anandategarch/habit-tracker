'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  BookOpen,
  Trash2,
  Calendar,
  Smile,
  Frown,
  Meh,
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface Journal {
  id: string;
  date: string;
  mood: number;
  stress: number;
  energy: number;
  sleep: number;
  reflection: string;
  winToday: string;
  lessonLearned: string;
  tomorrowPlan: string;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  id?: string;
  date: string;
  mood: string;
  stress: string;
  energy: string;
  sleep: string;
  reflection: string;
  winToday: string;
  lessonLearned: string;
  tomorrowPlan: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MOOD_OPTIONS = [
  { value: '1', emoji: '😫', label: 'Terrible' },
  { value: '2', emoji: '😣', label: 'Bad' },
  { value: '3', emoji: '😐', label: 'Okay' },
  { value: '4', emoji: '🙂', label: 'Good' },
  { value: '5', emoji: '🤩', label: 'Amazing' },
];

const STRESS_OPTIONS = [
  { value: '1', label: 'Minimal' },
  { value: '2', label: 'Low' },
  { value: '3', label: 'Moderate' },
  { value: '4', label: 'High' },
  { value: '5', label: 'Extreme' },
];

const ENERGY_OPTIONS = [
  { value: '1', label: 'Drained' },
  { value: '2', label: 'Low' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'High' },
  { value: '5', label: 'Peak' },
];

const EMPTY_FORM: FormData = {
  date: new Date().toISOString().split('T')[0],
  mood: '',
  stress: '',
  energy: '',
  sleep: '',
  reflection: '',
  winToday: '',
  lessonLearned: '',
  tomorrowPlan: '',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMoodEmoji(mood: number): string {
  return MOOD_OPTIONS.find((m) => m.value === String(mood))?.emoji ?? '😐';
}

function getMoodLabel(mood: number): string {
  return MOOD_OPTIONS.find((m) => m.value === String(mood))?.label ?? 'N/A';
}

function getStressLabel(stress: number): string {
  return STRESS_OPTIONS.find((s) => s.value === String(stress))?.label ?? 'N/A';
}

function getEnergyLabel(energy: number): string {
  return ENERGY_OPTIONS.find((e) => e.value === String(energy))?.label ?? 'N/A';
}

function getMoodColor(mood: number): string {
  switch (mood) {
    case 1:
      return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
    case 2:
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400';
    case 3:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
    case 4:
      return 'bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400';
    case 5:
      return 'bg-primary/10 text-primary';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
}

function getStressColor(stress: number): string {
  switch (stress) {
    case 1:
      return 'text-primary';
    case 2:
      return 'text-lime-600 dark:text-lime-400';
    case 3:
      return 'text-amber-600 dark:text-amber-400';
    case 4:
      return 'text-orange-600 dark:text-orange-400';
    case 5:
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

function getEnergyColor(energy: number): string {
  switch (energy) {
    case 1:
      return 'text-red-600 dark:text-red-400';
    case 2:
      return 'text-orange-600 dark:text-orange-400';
    case 3:
      return 'text-amber-600 dark:text-amber-400';
    case 4:
      return 'text-lime-600 dark:text-lime-400';
    case 5:
      return 'text-primary';
    default:
      return 'text-muted-foreground';
  }
}

function getSleepColor(sleep: number): string {
  if (sleep < 6) return 'text-red-500';
  if (sleep < 7) return 'text-amber-500';
  if (sleep < 9) return 'text-primary';
  return 'text-primary';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function JournalTab() {
  const { refreshKey, triggerRefresh } = useAppStore();

  const [journals, setJournals] = useState<Journal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Journal | null>(null);

  // Expanded entry
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch journals ────────────────────────────────────────────────────────

  const fetchJournals = useCallback(async () => {
    try {
      const res = await fetch('/api/journals');
      if (!res.ok) throw new Error('Failed to fetch journals');
      const data = await res.json();
      // Sort by date descending
      data.sort((a: Journal, b: Journal) => b.date.localeCompare(a.date));
      setJournals(data);
    } catch {
      toast.error('Failed to load journals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals, refreshKey]);

  // ── Form handlers ─────────────────────────────────────────────────────────

  function openNewForm() {
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] });
    setFormOpen(true);
  }

  function openEditForm(entry: Journal) {
    setForm({
      id: entry.id,
      date: entry.date,
      mood: String(entry.mood),
      stress: String(entry.stress),
      energy: String(entry.energy),
      sleep: String(entry.sleep),
      reflection: entry.reflection ?? '',
      winToday: entry.winToday ?? '',
      lessonLearned: entry.lessonLearned ?? '',
      tomorrowPlan: entry.tomorrowPlan ?? '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.mood) {
      toast.error('Please select a mood');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: form.date,
        mood: Number(form.mood),
        stress: Number(form.stress) || null,
        energy: Number(form.energy) || null,
        sleep: Number(form.sleep) || null,
        reflection: form.reflection || null,
        winToday: form.winToday || null,
        lessonLearned: form.lessonLearned || null,
        tomorrowPlan: form.tomorrowPlan || null,
      };

      const res = await fetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save journal');

      toast.success('Journal entry saved');
      setFormOpen(false);
      triggerRefresh();
      await fetchJournals();
    } catch {
      toast.error('Failed to save journal entry');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/journals/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success('Journal entry deleted');
      setDeleteTarget(null);
      triggerRefresh();
      await fetchJournals();
    } catch {
      toast.error('Failed to delete journal entry');
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderForm() {
    return (
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogTrigger asChild>
          <Button
            onClick={openNewForm}
            className="bg-primary hover:bg-primary text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {form.id ? 'Edit Journal Entry' : 'New Journal Entry'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="journal-date">Date</Label>
              <Input
                id="journal-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Mood */}
            <div className="space-y-2">
              <Label>Mood *</Label>
              <div className="flex gap-2 flex-wrap">
                {MOOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mood: opt.value }))}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 transition-all hover:scale-105',
                      form.mood === opt.value
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    )}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Stress & Energy row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stress Level</Label>
                <Select
                  value={form.stress}
                  onValueChange={(v) => setForm((f) => ({ ...f, stress: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stress level" />
                  </SelectTrigger>
                  <SelectContent>
                    {STRESS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Energy Level</Label>
                <Select
                  value={form.energy}
                  onValueChange={(v) => setForm((f) => ({ ...f, energy: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select energy level" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENERGY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sleep */}
            <div className="space-y-2">
              <Label htmlFor="journal-sleep">Sleep Hours</Label>
              <Input
                id="journal-sleep"
                type="number"
                min={0}
                max={24}
                step={0.5}
                placeholder="e.g. 7.5"
                value={form.sleep}
                onChange={(e) => setForm((f) => ({ ...f, sleep: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Text areas */}
            <div className="space-y-2">
              <Label htmlFor="journal-reflection">Reflection</Label>
              <Textarea
                id="journal-reflection"
                placeholder="How was your day? What stood out?"
                rows={4}
                value={form.reflection}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reflection: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-win">Win Today</Label>
              <Textarea
                id="journal-win"
                placeholder="What went well today?"
                rows={2}
                value={form.winToday}
                onChange={(e) =>
                  setForm((f) => ({ ...f, winToday: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-lesson">Lesson Learned</Label>
              <Textarea
                id="journal-lesson"
                placeholder="What did you learn today?"
                rows={2}
                value={form.lessonLearned}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lessonLearned: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-tomorrow">Tomorrow&apos;s Plan</Label>
              <Textarea
                id="journal-tomorrow"
                placeholder="What do you plan to do tomorrow?"
                rows={2}
                value={form.tomorrowPlan}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tomorrowPlan: e.target.value }))
                }
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary text-white min-w-[120px]"
              >
                {saving ? 'Saving...' : 'Save Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderEntryCard(entry: Journal) {
    const isExpanded = expandedId === entry.id;
    const formattedDate = format(new Date(entry.date + 'T00:00:00'), 'EEEE, MMM d, yyyy');
    const isToday = entry.date === new Date().toISOString().split('T')[0];

    return (
      <Card
        key={entry.id}
        className="group transition-all hover:shadow-md"
      >
        <CardContent className="p-4 sm:p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <button
                onClick={() => toggleExpand(entry.id)}
                className="text-3xl flex-shrink-0 mt-0.5 hover:scale-110 transition-transform"
              >
                {getMoodEmoji(entry.mood)}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm sm:text-base truncate">
                    {formattedDate}
                  </span>
                  {isToday && (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary text-[10px] px-1.5 py-0"
                    >
                      Today
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className={cn('text-[10px] px-1.5 py-0', getMoodColor(entry.mood))}
                  >
                    {getMoodLabel(entry.mood)}
                  </Badge>
                </div>
                {entry.reflection && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {entry.reflection}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => openEditForm(entry)}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={() => setDeleteTarget(entry)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick metrics - always visible */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {entry.sleep > 0 && (
              <span className={cn('flex items-center gap-1', getSleepColor(entry.sleep))}>
                <Calendar className="h-3 w-3" />
                {entry.sleep}h sleep
              </span>
            )}
            {entry.stress > 0 && (
              <span className={cn('flex items-center gap-1', getStressColor(entry.stress))}>
                Stress: {getStressLabel(entry.stress)}
              </span>
            )}
            {entry.energy > 0 && (
              <span className={cn('flex items-center gap-1', getEnergyColor(entry.energy))}>
                Energy: {getEnergyLabel(entry.energy)}
              </span>
            )}
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <Separator />

              {entry.reflection && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Reflection
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.reflection}
                  </p>
                </div>
              )}

              {entry.winToday && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    Win Today
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.winToday}
                  </p>
                </div>
              )}

              {entry.lessonLearned && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    Lesson Learned
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.lessonLearned}
                  </p>
                </div>
              )}

              {entry.tomorrowPlan && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">
                    Tomorrow&apos;s Plan
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.tomorrowPlan}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading || journals === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full max-w-xs" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
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
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Journal</h2>
            <p className="text-xs text-muted-foreground">
              {journals.length} {journals.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        {renderForm()}
      </div>

      {/* Entries list */}
      {journals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-medium text-sm mb-1">No journal entries yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Start writing your first journal entry to track your mood, reflections, and daily wins.
            </p>
            <Button
              onClick={openNewForm}
              className="mt-4 bg-primary hover:bg-primary text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Write First Entry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 custom-scrollbar">
          {journals.map((entry) => renderEntryCard(entry))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the journal entry for{' '}
              <span className="font-medium text-foreground">
                {deleteTarget
                  ? format(new Date(deleteTarget.date + 'T00:00:00'), 'MMMM d, yyyy')
                  : ''}
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