'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
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
  Edit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { jakartaDateString } from '@/lib/jakarta-date';
import { format, id as idLocale } from '@/lib/date-utils';
// PERF-FIX (FIX-TIER3 / Fix 15): replaced `date-fns` with native Intl-based
// utility module. Output is identical for the patterns used here
// ('EEEE, MMM d, yyyy' and 'MMMM d, yyyy') — verified via test script in
// worklog FIX-TIER3 entry.
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
  { value: '1', emoji: '😫', label: 'Buruk' },
  { value: '2', emoji: '😣', label: 'Lumayan' },
  { value: '3', emoji: '😐', label: 'Biasa' },
  { value: '4', emoji: '🙂', label: 'Baik' },
  { value: '5', emoji: '🤩', label: 'Hebat' },
];

const STRESS_OPTIONS = [
  { value: '1', label: 'Minimal' },
  { value: '2', label: 'Rendah' },
  { value: '3', label: 'Sedang' },
  { value: '4', label: 'Tinggi' },
  { value: '5', label: 'Ekstrem' },
];

const ENERGY_OPTIONS = [
  { value: '1', label: 'Habis' },
  { value: '2', label: 'Rendah' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'Tinggi' },
  { value: '5', label: 'Puncak' },
];

const EMPTY_FORM: FormData = {
  date: jakartaDateString(),
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
      return 'bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive/80';
    case 2:
      return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400';
    case 3:
      return 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80';
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
      return 'text-warning dark:text-warning/80';
    case 4:
      return 'text-orange-600 dark:text-orange-400';
    case 5:
      return 'text-destructive dark:text-destructive/80';
    default:
      return 'text-muted-foreground';
  }
}

function getEnergyColor(energy: number): string {
  switch (energy) {
    case 1:
      return 'text-destructive dark:text-destructive/80';
    case 2:
      return 'text-orange-600 dark:text-orange-400';
    case 3:
      return 'text-warning dark:text-warning/80';
    case 4:
      return 'text-lime-600 dark:text-lime-400';
    case 5:
      return 'text-primary';
    default:
      return 'text-muted-foreground';
  }
}

function getSleepColor(sleep: number): string {
  if (sleep < 6) return 'text-destructive';
  if (sleep < 7) return 'text-warning';
  if (sleep < 9) return 'text-primary';
  return 'text-primary';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function JournalTab() {
  const refreshKey = useAppStore(s => s.refreshKey);
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Journal | null>(null);

  // Expanded entry
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch journals ────────────────────────────────────────────────────────

  const { data: journals = null, isLoading: loading } = useQuery<Journal[]>({
    queryKey: ['journals', refreshKey],
    queryFn: async () => {
      const res = await fetch('/api/journals');
      if (!res.ok) throw new Error('Failed to fetch journals');
      const data = await res.json();
      data.sort((a: Journal, b: Journal) => b.date.localeCompare(a.date));
      return data;
    },
    staleTime: 30_000,
  });

  const invalidateJournals = useCallback(() => {
    // Invalidate the TanStack Query cache for the journals list, then bump the
    // `refreshKey` state so the `useQuery` above refetches with a new queryKey.
    // Previously this called `invalidateJournals()` recursively (infinite
    // loop → RangeError: Maximum call stack size exceeded) on every save/delete.
    queryClient.invalidateQueries({ queryKey: ['journals'] });
    triggerRefresh();
  }, [queryClient, triggerRefresh]);

  // ── Form handlers ─────────────────────────────────────────────────────────

  function openNewForm() {
    setForm({ ...EMPTY_FORM, date: jakartaDateString() });
    setFormOpen(true);
  }

  function openEditForm(entry: Journal) {
    // BUGHUNT-OTHER-1 BUG-M11: `String(null)` produces the literal string
    // "null", which is truthy → `Number("null")` returns NaN on save →
    // API rejects with 400 or stores NaN. Convert null/undefined to ''
    // so the form fields render empty (and `form.stress ? ...` falls
    // through to `null` on save as intended).
    const numOrEmpty = (v: number | null | undefined): string =>
      v === null || v === undefined ? '' : String(v);
    setForm({
      id: entry.id,
      date: entry.date,
      mood: numOrEmpty(entry.mood),
      stress: numOrEmpty(entry.stress),
      energy: numOrEmpty(entry.energy),
      sleep: numOrEmpty(entry.sleep),
      reflection: entry.reflection ?? '',
      winToday: entry.winToday ?? '',
      lessonLearned: entry.lessonLearned ?? '',
      tomorrowPlan: entry.tomorrowPlan ?? '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.mood) {
      toast.error('Pilih mood dulu');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date: form.date,
        mood: Number(form.mood),
        // Use ternary instead of || — `Number('0') || null` returns null
        // because 0 is falsy. Sleep=0 is a valid value (slept 0 hours).
        stress: form.stress ? Number(form.stress) : null,
        energy: form.energy ? Number(form.energy) : null,
        sleep: form.sleep !== '' ? Number(form.sleep) : null,
        reflection: form.reflection || null,
        winToday: form.winToday || null,
        lessonLearned: form.lessonLearned || null,
        tomorrowPlan: form.tomorrowPlan || null,
      };

      const res = form.id
        ? await fetch(`/api/journals/${form.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/journals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error('Failed to save journal');

      toast.success('Entri jurnal tersimpan');
      setFormOpen(false);
      invalidateJournals();
    } catch {
      toast.error('Gagal menyimpan entri jurnal');
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

      toast.success('Entri jurnal dihapus');
      setDeleteTarget(null);
      invalidateJournals();
    } catch {
      toast.error('Gagal menghapus entri jurnal');
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
          >
            <Plus className="h-4 w-4" />
            Entri Baru
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {form.id ? 'Edit Entri Jurnal' : 'Entri Jurnal Baru'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="journal-date">Tanggal</Label>
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
                <Label>Tingkat Stress</Label>
                <Select
                  value={form.stress}
                  onValueChange={(v) => setForm((f) => ({ ...f, stress: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tingkat stress" />
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
                <Label>Tingkat Energi</Label>
                <Select
                  value={form.energy}
                  onValueChange={(v) => setForm((f) => ({ ...f, energy: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tingkat energi" />
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
              <Label htmlFor="journal-sleep">Jam Tidur</Label>
              <Input
                id="journal-sleep"
                type="number"
                min={0}
                max={24}
                step={0.5}
                placeholder="misal 7.5"
                value={form.sleep}
                onChange={(e) => setForm((f) => ({ ...f, sleep: e.target.value }))}
              />
            </div>

            <Separator />

            {/* Text areas */}
            <div className="space-y-2">
              <Label htmlFor="journal-reflection">Refleksi</Label>
              <Textarea
                id="journal-reflection"
                placeholder="Bagaimana harimu? Apa yang menonjol?"
                rows={4}
                value={form.reflection}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reflection: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-win">Win Hari Ini</Label>
              <Textarea
                id="journal-win"
                placeholder="Apa yang berjalan baik hari ini?"
                rows={2}
                value={form.winToday}
                onChange={(e) =>
                  setForm((f) => ({ ...f, winToday: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-lesson">Pelajaran Hari Ini</Label>
              <Textarea
                id="journal-lesson"
                placeholder="Apa yang kamu pelajari hari ini?"
                rows={2}
                value={form.lessonLearned}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lessonLearned: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-tomorrow">Rencana Besok</Label>
              <Textarea
                id="journal-tomorrow"
                placeholder="Apa rencana kamu untuk besok?"
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
                className="min-w-[120px]"
              >
                {saving ? 'Menyimpan...' : 'Simpan Entri'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function renderEntryCard(entry: Journal) {
    const isExpanded = expandedId === entry.id;
    // BUGHUNT-OTHER-1 BUG-M2: `entry.date` is an ISO string with UTC
    // midnight (e.g. "2025-01-15T00:00:00.000Z"). `new Date(entry.date)`
    // in a negative-offset browser would shift to Jan 14 19:00 local →
    // `format(...)` shows Jan 14 (wrong day). Build the Date from the YMD
    // portion of the ISO so the calendar day is preserved in any tz.
    const ymd = entry.date.slice(0, 10);
    const [y, m, d] = ymd.split('-').map(Number);
    const entryDate = new Date(y, m - 1, d);
    const formattedDate = format(entryDate, 'EEEE, d MMM yyyy', { locale: idLocale });
    const isToday = ymd === jakartaDateString();

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
                      className="bg-primary/10 text-primary text-xs px-1.5 py-0"
                    >
                      Hari Ini
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className={cn('text-xs px-1.5 py-0', getMoodColor(entry.mood))}
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
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15"
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
                {entry.sleep}h tidur
              </span>
            )}
            {entry.stress > 0 && (
              <span className={cn('flex items-center gap-1', getStressColor(entry.stress))}>
                Stress: {getStressLabel(entry.stress)}
              </span>
            )}
            {entry.energy > 0 && (
              <span className={cn('flex items-center gap-1', getEnergyColor(entry.energy))}>
                Energi: {getEnergyLabel(entry.energy)}
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
                    Refleksi
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.reflection}
                  </p>
                </div>
              )}

              {entry.winToday && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    Win Hari Ini
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.winToday}
                  </p>
                </div>
              )}

              {entry.lessonLearned && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-warning dark:text-warning/80 mb-1">
                    Pelajaran Hari Ini
                  </h4>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {entry.lessonLearned}
                  </p>
                </div>
              )}

              {entry.tomorrowPlan && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">
                    Rencana Besok
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
      <PageHeader
        title="Jurnal"
        description={`${journals.length} entri`}
        action={renderForm()}
      />

      {/* Entries list */}
      {journals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-medium text-sm mb-1">Belum ada entri jurnal</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Mulai tulis entri jurnal pertama kamu untuk melacak mood, refleksi, dan win harian.
            </p>
            <Button
              onClick={openNewForm}
              className="mt-4"
            >
              <Plus className="h-4 w-4" />
              Entri Baru
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
            <AlertDialogTitle>Hapus Entri Jurnal</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus entri jurnal untuk tanggal{' '}
              <span className="font-medium text-foreground">
                {deleteTarget
                  ? format(new Date(deleteTarget.date), 'd MMMM yyyy', { locale: idLocale })
                  : ''}
              </span>
              ? Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive text-white"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}