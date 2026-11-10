import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function StatusPill({
  className,
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-[var(--shape-card)] bg-foreground text-[length:var(--type-dense)] text-white shadow-[0_8px_24px_rgb(0_0_0/20%)]",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  )
}
