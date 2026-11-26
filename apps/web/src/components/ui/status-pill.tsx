import { CircleAlert } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function StatusPill({
  className,
  style,
  children,
  error = false,
  layout,
}: {
  className?: string
  style?: CSSProperties
  error?: boolean
  children: ReactNode
  layout?: "action" | "message"
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-[var(--shape-card)] bg-foreground text-[length:var(--type-dense)] text-white shadow-dark-overlay",
        error && "bg-background text-danger-text",
        layout === "action" && "h-auto min-h-10 max-w-full gap-2.5 py-1.5 pr-1.5 pl-3.5",
        layout === "message" && "h-auto min-h-10 px-3.5 py-2 [overflow-wrap:anywhere]",
        className,
      )}
      style={style}
    >
      {error ? <CircleAlert aria-hidden="true" className="size-4 shrink-0" /> : null}
      {children}
    </div>
  )
}
