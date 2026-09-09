'use client';

// components/habit-tracker/habit-groups-section.tsx — kelola grup habit.
// Hapus grup → AlertDialog konfirmasi (destruktif; API me-set-null groupId
// habit anggota sebelum menghapus — kontrak /api/habit-groups/[id]).

import { useState } from 'react';
import { FolderKanban, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { HabitGroup } from './habit-master-types';

const GROUP_COLORS = ['#14b8a6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b'];

export interface HabitGroupsSectionProps {
  groups: HabitGroup[];
  groupsLoading: boolean;
  groupsOpen: boolean;
  setGroupsOpen: (v: boolean) => void;
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  newGroupColor: string;
  setNewGroupColor: (v: string) => void;
  addingGroup: boolean;
  handleCreateGroup: () => void | Promise<void>;
  handleDeleteGroup: (id: string) => void | Promise<void>;
}

export function HabitGroupsSection({
  groups,
  groupsLoading,
  groupsOpen,
  setGroupsOpen,
  newGroupName,
  setNewGroupName,
  newGroupColor,
  setNewGroupColor,
  addingGroup,
  handleCreateGroup,
  handleDeleteGroup,
}: HabitGroupsSectionProps) {
  const [deleteTarget, setDeleteTarget] = useState<HabitGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submitCreate = () => {
    if (!newGroupName.trim()) {
      toast.error('Nama grup wajib diisi');
      return;
    }
    void handleCreateGroup();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await handleDeleteGroup(deleteTarget.id);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="premium-card rounded-2xl">
      {/* Header collapsible */}
      <button
        type="button"
        onClick={() => setGroupsOpen(!groupsOpen)}
        aria-expanded={groupsOpen}
        className="flex w-full items-center gap-3 p-3 sm:p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-2xl"
      >
        <span className="chip-soft chip-soft-amber h-9 w-9 shrink-0" aria-hidden="true">
          <FolderKanban className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">Grup Habit</span>
          <span className="block text-xs text-muted-foreground">
            {groupsLoading ? 'Memuat grup...' : `${groups.length} grup`}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', groupsOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {groupsOpen && (
        <div className="space-y-3 px-3 pb-3 sm:px-4 sm:pb-4">
          {/* Form tambah grup: nama + warna */}
          <div className="flex items-center gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreate();
              }}
              placeholder="Nama grup baru (misal Pagi Hari)..."
              maxLength={40}
              className="rounded-xl h-9"
              aria-label="Nama grup baru"
            />
            <Button
              size="sm"
              onClick={submitCreate}
              disabled={addingGroup || !newGroupName.trim()}
              className="btn-primary-gradient h-9 shrink-0"
            >
              {addingGroup ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Tambah
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewGroupColor(c)}
                aria-label={`Pilih warna grup ${c}`}
                aria-pressed={newGroupColor === c}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                  newGroupColor === c ? 'border-foreground/70 scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Daftar grup */}
          {groups.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Belum ada grup. Grup membantu mengelompokkan habit (misal rutinitas pagi).
            </p>
          ) : (
            <div className="space-y-1.5">
              {groups.map((g) => (
                <div key={g.id} className="premium-list-item px-3! py-2!">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: g.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    aria-label={`Hapus grup ${g.name}`}
                    onClick={() => setDeleteTarget(g)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Konfirmasi hapus grup */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" aria-hidden="true" />
              Hapus Grup
            </AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus grup{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? Habit
              anggota grup tidak ikut terhapus — hanya kehilangan grupnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Menghapus...
                </>
              ) : (
                'Ya, Hapus'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
