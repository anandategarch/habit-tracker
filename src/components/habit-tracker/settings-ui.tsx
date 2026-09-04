// Extracted from settings.tsx — reusable building blocks for the settings page.
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
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
