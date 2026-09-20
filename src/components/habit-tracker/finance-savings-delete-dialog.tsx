'use client';

// components/habit-tracker/finance-savings-delete-dialog.tsx — konfirmasi
// hapus target tabungan (diekstrak verbatim dari finance-savings-goals.tsx,
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

export interface SavingsGoalDeleteDialogProps {
  open: boolean;
  name: string | null | undefined;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

export function SavingsGoalDeleteDialog({ open, name, onOpenChange, onDelete }: SavingsGoalDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
              <Trash2 className="h-3.5 w-3.5" />
            </span>
            Hapus Target Tabungan?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Target <strong>{name}</strong> akan dihapus permanen
            beserta progresnya.
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
