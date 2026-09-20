'use client';

// components/habit-tracker/habit-master-form-dialog.tsx — dialog besar
// create/edit habit (hasil pemecahan habit-master.tsx, Task 71-b): shell
// Dialog (trigger "Habit Baru" + header + tombol simpan) yang menggabung
// bagian-bagian form dari habit-form-*. State sesi ada di
// use-habit-master-form; mutasi server di use-habit-master-data.

import { Plus, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { HabitOptionRow } from '@/hooks/use-habit-options';
import type { HabitGroup } from './habit-master-types';
import type { HabitFormSession } from './use-habit-master-form';
import { HabitFormBasicFields } from './habit-form-basic-fields';
import { HabitFormScheduleSection } from './habit-form-schedule-section';
import { HabitFormTypeSection } from './habit-form-type-section';
import { HabitFormStatusFields } from './habit-form-status-fields';

export interface HabitFormDialogProps {
  session: HabitFormSession;
  categories: HabitOptionRow[];
  priorities: HabitOptionRow[];
  difficulties: HabitOptionRow[];
  groups: HabitGroup[];
}

export function HabitFormDialog({
  session,
  categories,
  priorities,
  difficulties,
  groups,
}: HabitFormDialogProps) {
  const {
    dialogOpen,
    handleDialogOpenChange,
    openAdd,
    editingId,
    form,
    submitting,
    submit,
  } = session;

  return (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button
          onClick={openAdd}
          className="btn-primary-gradient w-full sm:w-auto"
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
          {/* a11y (Task 36): deskripsi ter-taut — radix tidak lagi
              memperingatkan "Description missing" saat dialog dibuka. */}
          <DialogDescription className="sr-only">
            {editingId ? 'Perbarui detail habit' : 'Isi detail habit baru'}
            — termasuk Target Lulus (garis finis habit).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-2">
          {/* Nama + emoji + kategori/prioritas/grup + target/kesulitan */}
          <HabitFormBasicFields
            session={session}
            categories={categories}
            priorities={priorities}
            difficulties={difficulties}
            groups={groups}
          />

          {/* Jadwal Tampil (Task 37) + Target Lulus (Task 36) */}
          <HabitFormScheduleSection session={session} />

          {/* Tipe habit (PHASE3-HABIT: Normal / Hindari / Jumlah) */}
          <HabitFormTypeSection session={session} />

          {/* Pengingat/status/tanggal mulai/track waktu/liburan/catatan */}
          <HabitFormStatusFields session={session} />

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !form.name.trim()}
              className="btn-primary-gradient"
            >
              {submitting ? 'Menyimpan...' : editingId ? 'Perbarui Habit' : 'Buat Habit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
