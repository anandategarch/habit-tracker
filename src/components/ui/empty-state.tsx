import * as React from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  variant?: "default" | "primary"
}

/**
 * EmptyState (DESIGN-BUG-5 fix)
 *
 * Shared empty-state primitive — replaces 5+ ad-hoc patterns across
 * goals/rewards/badges/challenges/journal/daily-tracker/settings/
 * habit-quick-add/learning/push-notification-settings.
 *
 * Variants:
 *  - default: muted bg + dashed border (neutral "nothing here yet")
 *  - primary: primary-tinted bg + dashed primary/20 border (CTA-driven)
 *
 * Recommended usage:
 *   <EmptyState
 *     icon={Target}
 *     title="Belum ada goals"
 *     description="Tambahkan goal pertama Anda untuk mulai mengejar."
 *     action={<Button>Tambah Goal</Button>}
 *   />
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed",
        variant === "primary"
          ? "border-primary/20 bg-primary/5"
          : "border-border bg-muted/20",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mb-3",
            variant === "primary" ? "bg-primary/10" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-6 w-6",
              variant === "primary" ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
