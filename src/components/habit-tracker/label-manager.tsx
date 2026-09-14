'use client';

// components/habit-tracker/label-manager.tsx — kelola label habit
// (kategori / prioritas / kesulitan) memakai /api/habit-options.
//
// - Rename → PUT (API melakukan CASCADE updateMany ke Habit — kontrak);
//   cache ['habits'] ikut di-invalidate agar badge/filter langsung update
//   (fix 6-d LABEL-RENAME-1 — hook useHabitOptionMutations sudah melakukan
//   invalidasi ganda, komponen ini menambahkan invalidasi eksplisit).
// - Hapus → AlertDialog konfirmasi.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tags, Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react';
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
import { useHabitOptions, useHabitOptionMutations, type HabitOptionRow } from '@/hooks/use-habit-options';

type OptionType = 'category' | 'priority' | 'difficulty';

const TYPE_TABS: { id: OptionType; label: string }[] = [
  { id: 'category', label: 'Kategori' },
  { id: 'priority', label: 'Prioritas' },
  { id: 'difficulty', label: 'Kesulitan' },
];

const DEFAULT_COLORS: Record<OptionType, string> = {
  category: '#14b8a6',
  priority: '#f59e0b',
  difficulty: '#8b5cf6',
};

const TYPE_LABELS: Record<OptionType, string> = {
  category: 'kategori',
  priority: 'prioritas',
  difficulty: 'kesulitan',
};

export default function LabelManager() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<OptionType>('category');
  const { data: options = [], isLoading } = useHabitOptions(type);
  const { create, update, remove } = useHabitOptionMutations();

  // Form tambah
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS.category);

  // Edit inline
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#14b8a6');

  // Konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<HabitOptionRow | null>(null);

  const busy = create.isPending || update.isPending || remove.isPending;

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) {
      toast.error('Nama label wajib diisi');
      return;
    }
    try {
      await create.mutateAsync({ type, label, color: newColor });
      toast.success(`Label ${TYPE_LABELS[type]} "${label}" ditambahkan`);
      setNewLabel('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah label');
    }
  };

  const startEdit = (option: HabitOptionRow) => {
    setEditId(option.id);
    setEditLabel(option.label);
    setEditColor(option.color ?? DEFAULT_COLORS[type]);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditLabel('');
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    const label = editLabel.trim();
    if (!label) {
      toast.error('Nama label wajib diisi');
      return;
    }
    try {
      await update.mutateAsync({ id: editId, label, color: editColor });
      // fix 6-d LABEL-RENAME-1: pastikan cache habit ikut diperbarui (rename
      // di-cascade server-side ke Habit.category/priority/difficulty).
      await queryClient.invalidateQueries({ queryKey: ['habits'] });
      // VERIFY-48 (48-b): rename label juga menggeser kategori di chart
      // Progres + badge prioritas Beranda (turunan /api/dashboard dari
      // habit.category) — dulu hanya ['habits'] yang disegarkan → stale.
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Label berhasil diperbarui');
      cancelEdit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memperbarui label');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: ['habits'] });
      // VERIFY-48 (48-b): sama dengan rename — dashboard ikut disegarkan.
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Label berhasil dihapus');
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus label');
    }
  };

  return (
    <section className="premium-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="chip-soft chip-soft-violet h-9 w-9 shrink-0" aria-hidden="true">
          <Tags className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">Label Habit</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Kelola label kategori, prioritas, dan kesulitan yang dipakai habit.
          </p>
        </div>
      </div>

      {/* Tab tipe label — premium-segment */}
      <div className="mt-4 premium-segment flex-wrap" role="group" aria-label="Tipe label habit">
        {TYPE_TABS.map((tab) => {
          const active = type === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setType(tab.id);
                setNewColor(DEFAULT_COLORS[tab.id]);
                cancelEdit();
              }}
              data-active={active}
              aria-pressed={active}
              className="premium-segment-item"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Form tambah */}
      <div className="mt-4 flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleAdd();
          }}
          placeholder={`Nama ${TYPE_LABELS[type]} baru...`}
          maxLength={40}
          className="rounded-xl h-9"
          aria-label={`Nama ${TYPE_LABELS[type]} baru`}
        />
        <Input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-9 w-11 shrink-0 rounded-xl p-1 cursor-pointer"
          aria-label={`Warna ${TYPE_LABELS[type]} baru`}
          title="Warna label"
        />
        <Button
          size="sm"
          onClick={() => void handleAdd()}
          disabled={busy || !newLabel.trim()}
          className="btn-primary-gradient h-9 shrink-0"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah
        </Button>
      </div>

      {/* Daftar label */}
      <div className="mt-3 space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Memuat label...
          </div>
        ) : options.length === 0 ? (
          <p className="py-5 text-center text-xs text-muted-foreground">
            Belum ada label {TYPE_LABELS[type]}. Tambahkan yang pertama di atas.
          </p>
        ) : (
          options.map((option) => {
            const editing = editId === option.id;
            if (editing) {
              return (
                <div
                  key={option.id}
                  className="premium-list-item px-3! py-2! anim-press"
                  role="group"
                  aria-label={`Mengedit label ${option.label}`}
                >
                  <Input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-10 shrink-0 rounded-lg p-1 cursor-pointer"
                    aria-label={`Warna label ${option.label}`}
                  />
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    maxLength={40}
                    className="h-8 rounded-lg"
                    aria-label={`Nama label ${option.label}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10"
                    onClick={() => void handleSaveEdit()}
                    disabled={busy}
                    aria-label={`Simpan label ${option.label}`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={cancelEdit}
                    disabled={busy}
                    aria-label={`Batal edit label ${option.label}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            }
            return (
              <div key={option.id} className="premium-list-item px-3! py-2!">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: option.color ?? 'var(--muted)' }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.label}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                      'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    )}
                    aria-label={`Edit label ${option.label}`}
                    onClick={() => startEdit(option)}
                    disabled={busy}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                      'hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                    )}
                    aria-label={`Hapus label ${option.label}`}
                    onClick={() => setDeleteTarget(option)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Konfirmasi hapus label */}
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
              Hapus Label
            </AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus label{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.label}</span>?
              Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Batal</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={remove.isPending}
            >
              {remove.isPending ? (
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
    </section>
  );
}
