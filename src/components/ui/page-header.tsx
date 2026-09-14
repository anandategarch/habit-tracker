'use client';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
  /** Ikon lucide kecil di chip gradien — Task 41: semua sektor pakai
   *  header seragam (eyebrow + judul + subteks), seperti referensi
   *  desain dashboard modern (eyebrow kecil uppercase di atas judul). */
  icon?: React.ElementType;
  /** Label kecil uppercase di atas judul (konteks sektor, mis. "Keuangan"). */
  eyebrow?: string;
  /** Warna chip ikon (default teal = netral brand). */
  chipClassName?: string;
}

/** Header halaman dengan label editorial + subteks. */
export function PageHeader({
  title,
  subtitle,
  className,
  children,
  icon: Icon,
  eyebrow,
  chipClassName = 'chip-teal',
}: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span
            className={cn('chip-icon h-10 w-10 shrink-0', chipClassName)}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          {/* FIX H-DUPE: dulu h1 — shell header page.tsx sudah punya h1 judul
              tab, jadi PageHeader bikin h1 ganda (Tujuan/Pengaturan = 2 h1
              identik; Habit Master = 3). Semantik: h2 subjudul halaman. */}
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}
