// Extracted from dashboard.tsx in PHASE-A-2 — "Terakhir Dilakukan" card.
// Self-contained: includes the empty-state guard so the parent can drop in
// a single <LastDoneSummary data={...} /> call.
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, History } from 'lucide-react';
import { ChartInfo } from './dashboard-helpers';
import type { LastDoneSummary } from './dashboard-types';

export function LastDoneSummaryCard({
  data,
}: {
  data: LastDoneSummary[];
}) {
  if (data.length === 0) return null;

  return (
    <section aria-label="Last done habits">
      <Card className="p-4">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Terakhir Dilakukan
              <ChartInfo text="Menampilkan habit yang di-track kapan terakhir kali dikerjakan. Diurutkan dari yang paling lama / paling urgent." />
            </h3>
            <Badge variant="secondary" className="text-xs">
              {data.filter(l => l.overdue).length} overdue
            </Badge>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {data.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 transition-colors',
                  item.overdue ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900' : 'hover:bg-muted/30'
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">{item.name}</span>
                    {item.interval && (
                      <span className="text-xs text-muted-foreground">setiap {item.interval}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {item.completedAt && (
                    <span className="text-xs text-muted-foreground font-mono">{item.completedAt}</span>
                  )}
                  {item.daysAgo !== null ? (
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      item.overdue
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : item.daysAgo === 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : item.daysAgo <= 2
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground'
                    )}>
                      {item.daysAgo === 0 ? 'Hari ini' : `${item.daysAgo} hari lalu`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Belum pernah</span>
                  )}
                  {item.overdue && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
