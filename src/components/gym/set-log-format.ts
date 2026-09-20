// ---------------------------------------------------------------------------
// src/components/gym/set-log-format.ts — util format tampilan JURNAL SET
// (Task 74 F3). Murni presentasi: label hari Indonesia dari dayKey + ringkas
// satu catatan. Dipakai zone-pr-list.tsx & zone-set-history.tsx.
// ---------------------------------------------------------------------------

import { dateFromYMD } from '@/lib/timezone';
import { dayKeyShift } from '@/lib/muscle-map';

/** "Hari ini" | "Kemarin" | "Sab, 20 Sep" (stabil — format UTC dari YMD). */
export function formatDayKey(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return 'Hari ini';
  if (ymd === dayKeyShift(todayYmd, -1)) return 'Kemarin';
  const d = dateFromYMD(ymd);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}
