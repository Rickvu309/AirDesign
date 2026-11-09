import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function DeckCard({
  name,
  edited,
  preview,
  action,
  titleClassName,
  editedClassName,
  previewClassName,
}: {
  name: string
  edited: string
  preview?: ReactNode
  action?: ReactNode
  titleClassName?: string
  editedClassName?: string
  previewClassName?: string
}) {
  return (
    <article className="relative rounded-[14px] bg-canvas p-1.5">
      <div className="px-2.5 pt-2 pb-2.5">
        <h2 className={cn("h-[21px] truncate text-[14px] leading-[21px] font-medium text-foreground", titleClassName, action && "pr-16")}>{name}</h2>
        <p className={cn("h-[19.5px] truncate text-[13px] leading-[19.5px] text-muted-foreground", editedClassName)}>{edited}</p>
      </div>
      {action ? <div className="absolute top-5 right-3.5">{action}</div> : null}
      <div className={cn("h-[200px] overflow-hidden rounded-[10px] bg-line", previewClassName)}>{preview}</div>
    </article>
  )
}

export function DeckGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-8 grid grid-cols-3 gap-5", className)}>{children}</div>
}
