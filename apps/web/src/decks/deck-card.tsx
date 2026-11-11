import type { ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function DeckCard({
  name,
  edited,
  preview,
  action,
  titleClassName,
  editedClassName,
  previewClassName,
  href,
}: {
  name: string
  edited: string
  preview?: ReactNode
  action?: ReactNode
  titleClassName?: string
  editedClassName?: string
  previewClassName?: string
  href?: string
}) {
  return (
    <article className="relative rounded-[var(--shape-dialog)] bg-background p-1.5">
      <div className="px-2.5 pt-2 pb-2.5">
        <h2
          className={cn(
            "h-[21px] truncate text-[length:var(--type-body)] leading-[var(--leading-body)] font-medium text-foreground",
            titleClassName,
            action && "pr-16",
          )}
        >
          {href ? <a href={href}>{name}</a> : name}
        </h2>
        <p
          className={cn(
            "h-[19.5px] truncate text-[length:var(--type-dense)] leading-[var(--leading-body)] text-muted-foreground",
            editedClassName,
          )}
        >
          {edited}
        </p>
      </div>
      {action ? <div className="absolute top-5 right-3.5">{action}</div> : null}
      <div className={cn("h-[200px] overflow-hidden rounded-[var(--shape-card)] bg-line", previewClassName)}>
        {preview}
      </div>
    </article>
  )
}

export function DeckGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-8 grid grid-cols-3 gap-5", className)}>{children}</div>
}
