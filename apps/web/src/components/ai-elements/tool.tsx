import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Tool({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-1.5", className)} {...props}>
      {children}
    </div>
  )
}

export function ToolHeader({ title, caret = true }: { title: string; caret?: boolean }) {
  return (
    <>
      <span className="text-[13px] text-faint">{title}</span>
      {caret ? (
        <svg viewBox="0 0 10 10" width={10} height={10} className="shrink-0 text-faint" aria-hidden="true">
          <path d="M3.5 2.5 7 5l-3.5 2.5z" fill="currentColor" />
        </svg>
      ) : null}
    </>
  )
}

export function ToolOutput({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>
}
