// Extracted from settings.tsx — loading skeleton shown while settings load.
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex justify-between items-center">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-64" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
