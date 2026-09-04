'use client';

// ── Delete + Bulk Delete Confirmations ──────────────────────────────────
// Extracted from finance.tsx during SPLIT-PHASE2-UI.
// Two AlertDialog instances controlled by parent via props.

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

export interface FinanceDeleteDialogsProps {
  // ── Single delete ──
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onDelete: () => Promise<void>;
  // ── Bulk delete ──
  bulkDeleteOpen: boolean;
  onBulkDeleteOpenChange: (open: boolean) => void;
  onBulkDelete: () => Promise<void>;
  /** Number of transactions selected for bulk delete (drives the title). */
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
      {/* ─── DELETE CONFIRMATION ─── */}
      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Transaksi?</AlertDialogTitle><AlertDialogDescription>Transaksi yang dihapus tidak bisa dikembalikan. Yakin ingin melanjutkan?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── BULK DELETE CONFIRMATION ─── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={onBulkDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus {selectedCount} Transaksi?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak bisa dibatalkan. {selectedCount} transaksi yang dipilih akan dihapus secara permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={onBulkDelete} className="bg-destructive hover:bg-destructive">Hapus {selectedCount} Transaksi</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
