import type { HTMLAttributes } from "react"
import { cn } from "@/lib/class-names"

export function Message({
  from,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { from: "user" | "assistant" }) {
  return (
    <div
      data-role={from}
      className={cn(
        "flex w-full flex-col gap-1.5",
        from === "user" ? "max-w-70 items-end self-end" : "gap-3.5",
        className,
      )}
      {...props}
    />
  )
}

export function MessageContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-[length:var(--type-dense)] leading-[1.5] text-foreground",
        "group-data-[role=user]:rounded-[var(--shape-dialog)] in-data-[role=user]:rounded-[var(--shape-dialog)]",
        className,
      )}
      {...props}
    />
  )
}

export function MessageResponse({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[length:var(--type-dense)] leading-[1.6] text-foreground", className)} {...props} />
}
