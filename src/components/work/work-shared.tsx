// ---------------------------------------------------------------------------
// src/components/work/work-shared.tsx — potongan UI kecil yang dipakai lintas
// sub-tab Meja Kerja (Task 17-a): lingkaran toggle, badge, label grup, empty.
// ---------------------------------------------------------------------------
'use client';

import { Check, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkTaskItem } from './work-types';

/** Lingkaran toggle 44px (target sentuh). status menentukan isi lingkaran. */
export function WorkTick({
  status,
  onClick,
  label,
  size = 'md',
}: {
  status: string;
  onClick: () => void;
  label: string;
  size?: 'md' | 'sm';
}) {
  const done = status === 'selesai';
  const nunggu = status === 'nunggu';
  const jalan = status === 'jalan';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={done}
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'active:scale-90 motion-reduce:transition-none',
        size === 'md' ? 'h-11 w-11' : 'h-8 w-8'
      )}
    >
      {done ? (
        <span
          className={cn(
            'grid h-[26px] w-[26px] place-items-center rounded-full bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 text-white premium-fab-shadow',
            size === 'sm' && 'h-[20px] w-[20px]'
          )}
        >
          <Check className={size === 'md' ? 'h-4 w-4' : 'h-3 w-3'} strokeWidth={3} />
        </span>
      ) : nunggu ? (
        <span
          className={cn(
            'grid h-[26px] w-[26px] place-items-center rounded-[9px] bg-warning/15 text-warning',
            size === 'sm' && 'h-[20px] w-[20px] rounded-md'
          )}
        >
          <Clock className={size === 'md' ? 'h-[15px] w-[15px]' : 'h-3 w-3'} strokeWidth={2.2} />
        </span>
      ) : jalan ? (
        <span
          className={cn(
            'grid h-[26px] w-[26px] place-items-center rounded-full border-2 border-dashed border-primary/60 text-primary/80',
            size === 'sm' && 'h-[20px] w-[20px]'
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />
        </span>
      ) : (
        <span
          className={cn(
            'h-[26px] w-[26px] rounded-full border-2 border-muted-foreground/35',
            size === 'sm' && 'h-[20px] w-[20px]'
          )}
        />
      )}
    </button>
  );
}

/** Lingkaran toggle rutinitas (pola sama dengan tugas, tanpa status menunggu). */
export function RoutineTick({
  done,
  onClick,
  label,
}: {
  done: boolean;
  onClick: () => void;
  label: string;
}) {
  return <WorkTick status={done ? 'selesai' : 'todo'} onClick={onClick} label={label} />;
}

/** Badge kecil ala mockup: RUTIN / SEKALI / BARU / MENUNGGU / JALAN. */
export function WorkBadge({
  variant,
  children,
  className,
}: {
  variant: 'rutin' | 'sekali' | 'baru' | 'menunggu' | 'jalan';
  children: React.ReactNode;
  className?: string;
}) {
  const styles: Record<typeof variant, string> = {
    rutin: 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary',
    sekali: 'bg-muted text-muted-foreground',
    baru: 'work-badge-new',
    menunggu: 'bg-warning/10 text-warning dark:bg-warning/15 dark:text-warning/80',
    jalan: 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary/90',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-extrabold tracking-wide',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Label seksi kecil ala mockup (TUGAS HARI INI, PAGI, dsb.). */
export function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'mb-2 mt-4 px-1 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/80 first:mt-1',
        className
      )}
    >
      {children}
    </p>
  );
}

/** Empty state ramah Indonesia. */
export function EmptyHint({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {action}
    </div>
  );
}

/** Spinner aksi (dipakai tombol saat mutasi berjalan). */
export function MiniSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

/** Nama bulan Indonesia dari kunci hari 'yyyy-MM-dd' (tanpa dependensi baru). */
export function formatLongIndoDate(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00Z`);
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** Label meta tugas: "Hari ini" / "lewat tenggat" / "kapan saja". */
export function taskMetaLabel(task: WorkTaskItem, today: string): string | null {
  if (task.overdue) return 'lewat tenggat';
  if (task.kapanSaja) return 'kapan saja';
  if (task.dayKey === today) return 'hari ini';
  return null;
}
