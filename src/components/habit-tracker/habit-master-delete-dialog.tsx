'use client';

// components/habit-tracker/habit-master-delete-dialog.tsx — AlertDialog
// konfirmasi hapus habit (hasil pemecahan habit-master.tsx, Task 71-b;
// markup dipindah apa adanya).

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

export interface HabitDeleteDialogProps {
  open: boolean;
  deleting: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function HabitDeleteDialog({
  open,
  deleting,
  onConfirm,
  onClose,
}: HabitDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
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
            onClick={onConfirm}
            disabled={deleting}
            className="bg-destructive hover:bg-destructive text-white focus:ring-destructive"
          >
            {deleting ? 'Menghapus...' : 'Hapus'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
