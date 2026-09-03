import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * PageHeader (DESIGN-BUG-5 fix)
 *
 * Shared page/tab header — replaces 5+ variants of `<h2 className="text-xl
 * font-semibold tracking-tight">` across 12 files. Provides consistent
 * title typography, optional description, and optional right-aligned
 * action slot (e.g. "Add" button / filter dropdown).
 *
 * Layout: `flex items-start justify-between gap-4 mb-4`. Title column is
 * `min-w-0` so it truncates instead of pushing the action off-screen on
 * narrow viewports. Action column is `shrink-0` so it never wraps.
 */
function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex items-start justify-between gap-4 mb-4",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight truncate">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { PageHeader }
export type { PageHeaderProps }
