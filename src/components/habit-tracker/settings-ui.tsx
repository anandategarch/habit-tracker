'use client';

// components/habit-tracker/settings-ui.tsx — primitif layout Settings.
// SectionCard = div polong premium-card (BUKAN <Card className="premium-card">)
// — anti-pattern cascade flat-shadow (worklog 2-c/4-d/6-c).

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export function SectionCard({ icon: Icon, title, description, className, children }: SectionCardProps) {
  return (
    <section className={cn('premium-card rounded-2xl p-4 sm:p-5', className)}>
      <div className="flex items-center gap-3">
        <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export interface FormRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormRow({ label, description, htmlFor, className, children }: FormRowProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {description && <p className="-mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div>{children}</div>
    </div>
  );
}
