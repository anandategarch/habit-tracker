import { AuroraRing } from "@/components/ui/loaders"

import { cn } from "@/lib/utils"

interface LoadingStateProps {
  text?: string
  className?: string
}

/**
 * LoadingState (DESIGN-BUG-5 fix + loader upgrade)
 *
 * Shared inline loading indicator — uses AuroraRing (gradient emerald→teal
 * circular progress with breathing sprout in center). Replaces old Loader2
 * spinner with premium 2025-style loader.
 *
 * Default text is Indonesian ("Memuat...") to match the dominant language
 * already in use in the app; override per-call if needed.
 */
function LoadingState({
  text = "Memuat...",
  className,
}: LoadingStateProps) {
  return (
    <div
      data-slot="loading-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground",
        className
      )}
    >
      <AuroraRing size="sm" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export { LoadingState }
export type { LoadingStateProps }
