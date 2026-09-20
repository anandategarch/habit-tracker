'use client';

// ---------------------------------------------------------------------------
// src/components/gym/zone-set-history.tsx — seksi "Catatan Latihan" di Zone
// Focus Sheet (Task 74 F3): jurnal set 30 hari terakhir, dikelompokkan per
// hari (terbaru dulu). Kosong → seksi tidak tampil.
// ---------------------------------------------------------------------------

import { ScrollText } from 'lucide-react';
import type { GymSetLogRow, MuscleZoneKey } from '@/lib/muscle-map';
import { formatDayKey } from './set-log-format';

interface DayGroup {
  dayKey: string;
  label: string;
  logs: GymSetLogRow[];
}

/** Kelompokkan log terbaru-dulu per hari (input sudah terurut newest-first). */
function groupByDay(logs: GymSetLogRow[], todayYmd: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const log of logs) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === log.dayKey) {
      last.logs.push(log);
    } else {
      groups.push({ dayKey: log.dayKey, label: formatDayKey(log.dayKey, todayYmd), logs: [log] });
    }
  }
  return groups;
}

export function ZoneSetHistory({
  zoneKey,
  logs,
  todayYmd,
}: {
  zoneKey: MuscleZoneKey;
  logs: GymSetLogRow[];
  todayYmd: string;
}) {
  if (logs.length === 0) return null;
  const groups = groupByDay(logs, todayYmd);

  return (
    <section aria-label={`Riwayat catatan latihan zona ${zoneKey}`}>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ScrollText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Catatan Latihan · 30 hari
      </h3>
      {/* Task 70 (audit 70-d MINOR #10): custom-scrollbar pada daftar panjang. */}
      <div className="custom-scrollbar mt-2 max-h-56 space-y-3 overflow-y-auto pr-0.5">
        {groups.map((g) => (
          <div key={g.dayKey}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
              <span className="ml-1.5 font-normal normal-case">· {g.logs.length} gerakan</span>
            </p>
            <ul className="mt-1 space-y-1">
              {g.logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-2.5 py-1 text-[11px]"
                >
                  <span className="min-w-0 truncate font-medium">{log.exercise}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {log.sets} × {log.amount} {log.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
