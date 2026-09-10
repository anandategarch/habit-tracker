// ---------------------------------------------------------------------------
// src/components/work/work-routines.tsx — sub-tab "Rutinitas" (Task 17-a):
// template tugas harian berulang, grup pagi/siang/sore + kartu info.
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeleteRoutine, useSaveRoutine, useSetRoutineActive } from './use-work-api';
import { WORK_TIME_LABELS, WORK_TIME_OF_DAYS, type WorkPayload, type WorkRoutineItem, type WorkTimeOfDay } from './work-types';
import { EmptyHint, GroupLabel, MiniSpinner } from './work-shared';

function AddRoutineForm({ date }: { date: string }) {
  const saveRoutine = useSaveRoutine(date);
  const [title, setTitle] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<WorkTimeOfDay>('pagi');
  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle('');
    saveRoutine.mutate({ title: trimmed, timeOfDay });
  };
  return (
    <div className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Tambah rutinitas berulang…"
        aria-label="Judul rutinitas baru"
        maxLength={200}
      />
      <Select value={timeOfDay} onValueChange={(v) => setTimeOfDay(v as WorkTimeOfDay)}>
        <SelectTrigger className="w-[110px] shrink-0" aria-label="Waktu rutinitas">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WORK_TIME_OF_DAYS.map((t) => (
            <SelectItem key={t} value={t}>
              {WORK_TIME_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={!title.trim() || saveRoutine.isPending}
        aria-label="Tambah rutinitas"
        className="btn-primary-gradient shrink-0"
      >
        {saveRoutine.isPending ? <MiniSpinner className="text-white" /> : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function RoutineManageRow({ routine, date, onRename }: { routine: WorkRoutineItem; date: string; onRename: (routine: WorkRoutineItem) => void }) {
  const setActive = useSetRoutineActive(date);
  const deleteRoutine = useDeleteRoutine(date);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div
      className={cn(
        'premium-list-item px-3 py-2.5',
        !routine.active && 'opacity-60'
      )}
    >
      <button
        type="button"
        onClick={() => onRename(routine)}
        aria-label={`Ganti nama ${routine.title}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[13.5px] font-semibold', !routine.active ? 'text-muted-foreground' : 'text-foreground')}>
            {routine.title}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {routine.doneToday ? 'sudah selesai hari ini' : 'belum dicentang hari ini'}
          </span>
        </span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        aria-label={`Hapus rutinitas ${routine.title}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <Switch
        checked={routine.active}
        onCheckedChange={(checked) => setActive.mutate({ id: routine.id, active: checked })}
        aria-label={`${routine.active ? 'Nonaktifkan' : 'Aktifkan'} rutinitas ${routine.title}`}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus rutinitas?</DialogTitle>
            <DialogDescription>
              “{routine.title}” dan riwayat centangnya akan dihapus. Tugas lepas hari ini tidak terpengaruh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteRoutine.isPending}
              onClick={() => deleteRoutine.mutate(routine.id, { onSuccess: () => setConfirmDelete(false) })}
            >
              {deleteRoutine.isPending ? <MiniSpinner /> : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkRoutines({ date, data, isLoading }: { date: string; data: WorkPayload | undefined; isLoading: boolean }) {
  const saveRoutine = useSaveRoutine(date);
  const [editing, setEditing] = useState<WorkRoutineItem | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const openEditor = (routine: WorkRoutineItem) => {
    setEditing(routine);
    setEditTitle(routine.title);
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-3 pt-3">
        <div className="h-11 animate-pulse rounded-xl bg-muted" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted/60" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    );
  }

  const routines = data.routines;

  return (
    <div className="pt-1">
      <AddRoutineForm date={date} />

      {routines.length === 0 ? (
        <div className="mt-3">
          <EmptyHint
            icon={<Repeat className="h-5 w-5" aria-hidden="true" />}
            title="Belum ada template harian"
            hint="Contoh: “Bersihin inbox” (pagi), “Update progres proyek” (siang), “Rekap 2 menit” (sore). Atur sekali, tiap hari muncul sendiri."
          />
        </div>
      ) : (
        WORK_TIME_OF_DAYS.map((group) => {
          const groupRoutines = routines.filter((r) => r.timeOfDay === group);
          if (groupRoutines.length === 0) return null;
          return (
            <section key={group} aria-label={`Rutinitas ${group}`}>
              <GroupLabel>{WORK_TIME_LABELS[group].toUpperCase()}</GroupLabel>
              <div className="space-y-2">
                {groupRoutines.map((routine) => (
                  <RoutineManageRow key={routine.id} routine={routine} date={date} onRename={openEditor} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {/* Kartu info ala mockup */}
      <div className="premium-card mt-5 p-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
          <Repeat className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Kadang tugasnya ganti?
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Santai — rutinitas cuma template. Tugas lepas seperti kirim invoice atau review konten tinggal ditambah di layar Hari
          Ini. Besok, rutinitasmu tetap rapi.
        </p>
      </div>

      {/* Dialog edit nama */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ganti nama rutinitas</DialogTitle>
            <DialogDescription>Nama baru dipakai mulai sekarang — centang hari ini tetap tersimpan.</DialogDescription>
          </DialogHeader>
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Nama rutinitas"
            maxLength={200}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editing && editTitle.trim()) {
                saveRoutine.mutate(
                  { id: editing.id, title: editTitle.trim(), timeOfDay: editing.timeOfDay },
                  { onSuccess: () => setEditing(null) }
                );
              }
            }}
          />
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Batal
            </Button>
            <Button
              type="button"
              className="btn-primary-gradient"
              disabled={!editTitle.trim() || saveRoutine.isPending}
              onClick={() => {
                if (!editing || !editTitle.trim()) return;
                saveRoutine.mutate(
                  { id: editing.id, title: editTitle.trim(), timeOfDay: editing.timeOfDay },
                  { onSuccess: () => setEditing(null) }
                );
              }}
            >
              {saveRoutine.isPending ? <MiniSpinner className="text-white" /> : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
