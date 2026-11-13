import type { ComponentProps, ReactNode } from "react"
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
      <div className="flex items-start gap-2 px-2.5 pt-2 pb-2.5">
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "h-[21px] truncate text-[length:var(--type-body)] leading-[var(--leading-body)] font-medium text-foreground",
              titleClassName,
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
        {action ? <div className="-mr-0.5 shrink-0 pt-1.5">{action}</div> : null}
      </div>
      <div className={cn("h-[200px] overflow-hidden rounded-[var(--shape-card)] bg-line", previewClassName)}>
        {preview}
      </div>
    </article>
  )
}

export function DeckGrid({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & ComponentProps<"div">) {
  return (
    <div className={cn("mt-8 grid grid-cols-3 gap-5 max-md:grid-cols-1", className)} {...props}>
      {children}
    </div>
  )
}
