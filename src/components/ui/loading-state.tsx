import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface LoadingStateProps {
  text?: string
  className?: string
}

/**
 * LoadingState (DESIGN-BUG-5 fix)
 *
 * Shared inline loading indicator — replaces ad-hoc
 * `<div className="text-center py-8 text-muted-foreground">Memuat...</div>`
 * patterns scattered across tabs. Uses lucide's `Loader2` with
 * `animate-spin` (Tailwind's built-in spin keyframe, no custom CSS).
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
        "flex items-center justify-center gap-2 py-8 text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

export { LoadingState }
export type { LoadingStateProps }
