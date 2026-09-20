'use client';

// components/habit-tracker/finance-recurring-delete-dialog.tsx — konfirmasi
// hapus transaksi berulang (diekstrak verbatim dari finance-recurring.tsx,
// Task 71-i).

import { Trash2 } from 'lucide-react';
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

export interface RecurringDeleteDialogProps {
  open: boolean;
  name: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

export function RecurringDeleteDialog({ open, name, onOpenChange, onDelete }: RecurringDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
              <Trash2 className="h-3.5 w-3.5" />
            </span>
            Hapus Transaksi Berulang?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{name}</strong> akan dihapus. Transaksi instance
            yang sudah dibuat tetap tersimpan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive"
            onClick={(e) => { e.preventDefault(); void onDelete(); }}
          >
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
