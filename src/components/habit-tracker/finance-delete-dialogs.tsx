'use client';

// components/habit-tracker/finance-delete-dialogs.tsx — konfirmasi hapus
// transaksi tunggal + hapus massal (bulk). Semua destructive memakai
// AlertDialog (aturan app-wide), teks Indonesia, tombol disabled saat
// in-flight (guard double-submit).

import { Trash2, AlertTriangle } from 'lucide-react';
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

interface FinanceDeleteDialogsProps {
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onDelete: () => void | Promise<void>;
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  onBulkDelete: () => void | Promise<void>;
  selectedCount: number;
}

export function FinanceDeleteDialogs({
  deleteOpen,
  onDeleteOpenChange,
  onDelete,
  bulkDeleteOpen,
  onBulkDeleteOpenChange,
  onBulkDelete,
  selectedCount,
}: FinanceDeleteDialogsProps) {
  return (
    <>
      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              Hapus Transaksi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi akan dihapus permanen dan saldo sumber dana disesuaikan.
              Transaksi transfer dihapus berpasangan (kedua sisi sekaligus).
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={onBulkDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-destructive/10 text-destructive shrink-0" aria-hidden="true">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              Hapus {selectedCount} Transaksi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Semua transaksi terpilih akan dihapus permanen. Tindakan ini tidak
              bisa dibatalkan — pastikan pilihan sudah benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive"
              onClick={(e) => { e.preventDefault(); void onBulkDelete(); }}
            >
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
