'use client';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

/** Header halaman dengan label editorial + subteks. */
export function PageHeader({ title, subtitle, className, children }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {/* FIX H-DUPE: dulu h1 — shell header page.tsx sudah punya h1 judul
            tab, jadi PageHeader bikin h1 ganda (Tujuan/Pengaturan = 2 h1
            identik; Habit Master = 3). Semantik: h2 subjudul halaman. */}
        <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}
