'use client';

// components/habit-tracker/finance-tx-dialog-split-keys.ts — pengelola key
// stabil baris split (diekstrak verbatim dari finance-tx-dialog.tsx, Task
// 71-i).
//
// Task 61-f (audit 61-a P3): splitRows dimiliki parent (use-finance-mutations)
// tanpa id — dialog memelihara daftar key paralel: tambah/hapus lewat wrapper
// lokal (idx persis), perubahan panjang eksternal (reset saat dialog dibuka
// ulang) disinkronkan lewat pola adjust-state-during-render (sama seperti
// prevOpen di CalculatorDialog).

import { useState } from 'react';
import type { SplitRow } from './finance-types';

// Task 61-f (audit 61-a P3): penghasil key stabil baris split — counter uid
// modul (unik sepanjang sesi, tanpa dependency baru).
let splitRowUid = 0;

export function useSplitKeys(
  splitRows: SplitRow[],
  addSplitRow: () => void,
  removeSplitRow: (idx: number) => void
) {
  const [splitKeys, setSplitKeys] = useState<string[]>(() =>
    splitRows.map(() => `split-${++splitRowUid}`)
  );
  const [prevSplitCount, setPrevSplitCount] = useState(splitRows.length);
  if (splitRows.length !== prevSplitCount) {
    setPrevSplitCount(splitRows.length);
    setSplitKeys((prev) => {
      if (splitRows.length >= prev.length) {
        return [
          ...prev,
          ...Array.from({ length: splitRows.length - prev.length }, () => `split-${++splitRowUid}`),
        ];
      }
      return prev.slice(0, splitRows.length);
    });
  }

  const handleAddSplitRow = () => {
    setSplitKeys((prev) => [...prev, `split-${++splitRowUid}`]);
    addSplitRow();
  };

  const handleRemoveSplitRow = (idx: number) => {
    setSplitKeys((prev) => prev.filter((_, i) => i !== idx));
    removeSplitRow(idx);
  };

  return { splitKeys, handleAddSplitRow, handleRemoveSplitRow };
}
