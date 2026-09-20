'use client';

// components/habit-tracker/finance-recurring-form-state.ts — bentuk form +
// factory tambah/edit transaksi berulang (diekstrak verbatim dari
// finance-recurring.tsx, Task 71-i; dipakai root + form dialog).

import { formatNominalInput } from './finance-types';
import { jakartaDateString, jakartaDateKey } from '@/lib/timezone';
import type { RecurringTransaction } from './finance-types';

export interface RecurringFormState {
  id: string | null;
  name: string;
  amount: string;
  type: string;
  category: string;
  sourceId: string;
  frequency: string;
  startDate: string;
}

export function emptyRecurringForm(): RecurringFormState {
  return {
    id: null,
    name: '',
    amount: '',
    type: 'expense',
    category: '',
    sourceId: '',
    frequency: 'monthly',
    // 6-b FIX-10: default tanggal mulai = hari Jakarta (bukan TZ browser).
    startDate: jakartaDateString(),
  };
}

export function formFromRecurring(rt: RecurringTransaction): RecurringFormState {
  return {
    id: rt.id,
    name: rt.name,
    amount: formatNominalInput(String(Math.round(rt.amount ?? 0))),
    type: rt.type === 'income' ? 'income' : 'expense',
    category: rt.category ?? '',
    sourceId: rt.sourceId ?? '',
    frequency: rt.frequency ?? 'monthly',
    // 6-b FIX-10: recurring dipatok tengah malam Jakarta (+07:00) — baca
    // via jakartaDateKey, bukan konversi TZ browser (menghindari shift -1
    // hari di browser barat Jakarta saat edit + re-save).
    startDate: jakartaDateKey(new Date(rt.startDate)),
  };
}
