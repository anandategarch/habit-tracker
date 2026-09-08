// Extracted from settings.tsx — reusable building blocks for the settings page.
//
// PREMIUM-UI ("Rutina Aurora"): SectionCard sekarang pakai div polong
// `.premium-card .premium-card-sheen` (bukan komponen Card shadcn — pola agent
// 2-a/2-b/2-c: `.card-shadow-premium` milik Card menimpa multi-layer shadow
// premium; div polong menjaga efek premium penuh). API props tetap identik.

'use client';

import { Label } from '@/components/ui/label';

export function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="premium-card premium-card-sheen rounded-2xl">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <span className="chip-soft chip-soft-teal h-9 w-9" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
    </div>
  );
}

export function FormRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="sm:w-64 shrink-0">{children}</div>
    </div>
  );
}
