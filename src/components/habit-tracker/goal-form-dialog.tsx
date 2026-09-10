'use client';

// components/habit-tracker/goal-form-dialog.tsx — dialog tambah/edit tujuan.
//
// Kontrak pemakaian: parent merender komponen ini dengan `key` yang berganti
// tiap mode (mis. key={editing?.id ?? 'baru'}) sehingga state form di-init
// ulang tanpa perlu setState di effect.
//
// - Milestone list dinamis: tambah/hapus baris teks + toggle selesai.
// - Submit → POST /api/goals (baru) atau PUT /api/goals/[id] (edit), lalu
//   invalidate cache ['goals'] + toast Indonesia.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Target, Plus, X, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PRIORITY_OPTIONS,
  nextStatusForMilestones,
  type Goal,
  type GoalMilestone,
} from './goals-helpers';

export interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = mode tambah; selain itu mode edit. */
  editing: Goal | null;
}

function emptyMilestones(editing: Goal | null): GoalMilestone[] {
  return editing?.milestones ? editing.milestones.map((m) => ({ ...m })) : [];
}

export function GoalFormDialog({ open, onOpenChange, editing }: GoalFormDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(() => editing?.title ?? '');
  const [description, setDescription] = useState(() => editing?.description ?? '');
  const [priority, setPriority] = useState(() => editing?.priority ?? 'Sedang');
  const [deadline, setDeadline] = useState(() => editing?.deadline ?? '');
  const [milestones, setMilestones] = useState<GoalMilestone[]>(() => emptyMilestones(editing));
  const [submitting, setSubmitting] = useState(false);

  const updateMilestone = (index: number, patch: Partial<GoalMilestone>) => {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const addMilestone = () => {
    setMilestones((prev) => [...prev, { text: '', done: false }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error('Judul tujuan wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const cleanMilestones = milestones
        .map((m) => ({ text: m.text.trim(), done: m.done }))
        .filter((m) => m.text.length > 0);
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        deadline: deadline || null,
        milestones: cleanMilestones,
        // Status diturunkan dari milestone (BUG-M16); 'cancelled' dipertahankan.
        status: editing
          ? nextStatusForMilestones(editing.status, cleanMilestones)
          : nextStatusForMilestones('active', cleanMilestones),
      };
      const res = await fetch(editing ? `/api/goals/${editing.id}` : '/api/goals', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menyimpan tujuan');
      }
      toast.success(editing ? 'Tujuan berhasil diperbarui' : 'Tujuan baru berhasil dibuat');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan tujuan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle asChild>
            <div className="flex items-center gap-3 pr-8">
              <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
                <Target className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="premium-label">Tujuan</p>
                <span className="block text-lg font-semibold leading-tight">
                  {editing ? 'Edit Tujuan' : 'Tujuan Baru'}
                </span>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Perbarui detail tujuan dan milestone-nya.'
              : 'Tentukan tujuan baru beserta milestone pencapaiannya.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          {/* Judul */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">
              Judul <span className="text-destructive">*</span>
            </Label>
            <Input
              id="goal-title"
              placeholder="misal Baca 12 buku tahun ini"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="rounded-xl"
            />
          </div>

          {/* Deskripsi */}
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc">Deskripsi</Label>
            <Textarea
              id="goal-desc"
              placeholder="Deskripsi singkat (opsional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-xl"
            />
          </div>

          {/* Prioritas + Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prioritas</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-deadline">
                Deadline <span className="text-xs text-muted-foreground">(opsional)</span>
              </Label>
              <Input
                id="goal-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Milestones dinamis */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Milestone</Label>
              <span className="text-xs text-muted-foreground">{milestones.length} langkah</span>
            </div>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={m.done}
                    aria-label={`Tandai milestone ${m.text || `ke-${i + 1}`}`}
                    onClick={() => updateMilestone(i, { done: !m.done })}
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      m.done
                        ? 'border-transparent bg-gradient-to-br from-teal-400 to-emerald-500 shadow-[0_0_10px_-2px_rgba(16,185,129,0.55)]'
                        : 'border-muted-foreground/40 hover:border-primary/60',
                    )}
                  >
                    {m.done && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
                  </button>
                  <Input
                    value={m.text}
                    onChange={(e) => updateMilestone(i, { text: e.target.value })}
                    placeholder={`Milestone ke-${i + 1} (misal Baca buku ${i + 1})`}
                    maxLength={120}
                    className="rounded-xl h-9"
                    aria-label={`Teks milestone ke-${i + 1}`}
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`Hapus milestone ke-${i + 1}`}
                    onClick={() => removeMilestone(i)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMilestone}
              className="w-full border-dashed rounded-xl"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah Milestone
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="btn-primary-gradient"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : editing ? (
              'Perbarui Tujuan'
            ) : (
              'Buat Tujuan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
