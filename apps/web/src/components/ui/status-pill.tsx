import { CircleAlert } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function StatusPill({
  className,
  style,
  children,
  error = false,
}: {
  className?: string
  style?: CSSProperties
  error?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-[var(--shape-card)] bg-foreground text-[length:var(--type-dense)] text-white shadow-dark-overlay",
        error && "bg-background text-danger-text",
        className,
      )}
      style={style}
    >
      {error ? <CircleAlert aria-hidden="true" className="size-4 shrink-0" /> : null}
      {children}
    </div>
  )
}
