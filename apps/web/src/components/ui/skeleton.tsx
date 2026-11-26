import type { ComponentProps } from "react"
import { cn } from "@/lib/class-names"

export function Skeleton({ className, tone = "muted", ...props }: ComponentProps<"div"> & { tone?: "muted" | "line" }) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md motion-safe:animate-pulse", tone === "line" ? "bg-line" : "bg-muted", className)}
      {...props}
    />
  )
}
