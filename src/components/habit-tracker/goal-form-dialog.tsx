// ---------------------------------------------------------------------------
// GoalFormDialog — Add/Edit Goal dialog + "Tujuan Baru" trigger button.
// Extracted from goals.tsx during PHASE-A-3.
//
// Controlled by the parent via props. The parent owns:
//   - `form` state (GoalFormData) + `setForm` setter (supports functional
//     updates: `setForm((f) => ({ ...f, title: value }))`)
//   - `formOpen` / `setFormOpen` controlled-dialog state
//   - `newMilestone` / `setNewMilestone` for the "add milestone" input
//   - `addMilestone`, `removeMilestone`, `updateMilestoneText` mutation handlers
//   - `handleSave` (POST/PUT) + `saving` flag
//   - `openNewForm` (called by the trigger Button onClick — resets the form
//     to EMPTY_FORM and opens the dialog)
//
// The DialogTrigger Button is rendered AS THE FIRST CHILD of the Dialog so
// the parent's PageHeader can pass the entire dialog component as its
// `action` prop (preserving the original layout where the "Tujuan Baru"
// button lives in the header).
// ---------------------------------------------------------------------------

'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Separator } from '@/components/ui/separator';
import { Plus, Target, X } from 'lucide-react';
import type { GoalFormData } from './goals-types';

export interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: GoalFormData;
  setForm: React.Dispatch<React.SetStateAction<GoalFormData>>;
  newMilestone: string;
  setNewMilestone: (s: string) => void;
  /** Called when the "Tujuan Baru" trigger button is clicked. Resets the form + opens the dialog. */
  onCreateNew: () => void;
  onAddMilestone: () => void;
  onRemoveMilestone: (index: number) => void;
  onUpdateMilestoneText: (index: number, text: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function GoalFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  newMilestone,
  setNewMilestone,
  onCreateNew,
  onAddMilestone,
  onRemoveMilestone,
  onUpdateMilestoneText,
  onSave,
  saving,
}: GoalFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          onClick={onCreateNew}
        >
          <Plus className="h-4 w-4" />
          Tujuan Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {form.id ? 'Edit Tujuan' : 'Tujuan Baru'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="goal-title">Judul *</Label>
            <Input
              id="goal-title"
              placeholder="Apa yang ingin kamu capai?"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="goal-desc">Deskripsi</Label>
            <Textarea
              id="goal-desc"
              placeholder="Jelaskan tujuan kamu secara detail..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Deadline + Priority row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goal-deadline">Tenggat</Label>
              <Input
                id="goal-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioritas</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">Tinggi</SelectItem>
                  <SelectItem value="Medium">Sedang</SelectItem>
                  <SelectItem value="Low">Rendah</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Milestones */}
          <div className="space-y-3">
            <Label>Milestone</Label>
            <p className="text-xs text-muted-foreground">
              Pecah tujuan kamu jadi langkah kecil yang bisa dilacak
            </p>

            {/* Existing milestones */}
            {form.milestones.length > 0 && (
              <div className="space-y-2">
                {form.milestones.map((ms, idx) => (
                  <div key={ms.id ?? idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        value={ms.text}
                        onChange={(e) => onUpdateMilestoneText(idx, e.target.value)}
                        placeholder="Deskripsi milestone"
                        className="h-9 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive/80 hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/15 flex-shrink-0"
                      onClick={() => onRemoveMilestone(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add milestone */}
            <div className="flex items-center gap-2">
              <Input
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onAddMilestone();
                  }
                }}
                placeholder="Tambah milestone..."
                className="h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddMilestone}
                disabled={!newMilestone.trim()}
                className="h-9 flex-shrink-0 border-primary/20 text-primary hover:bg-primary/5"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </Button>
            </div>

            {form.milestones.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {form.milestones.length} milestone ·{' '}
                {form.milestones.filter((m) => m.done).length} selesai
              </p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={onSave}
              disabled={saving || !form.title.trim()}
              className="min-w-[120px]"
            >
              {saving ? 'Menyimpan...' : form.id ? 'Perbarui Tujuan' : 'Buat Tujuan'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
