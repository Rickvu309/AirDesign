import type { ReactNode } from "react"

export function ModuleRow({
  title,
  status,
  mark,
  action,
}: {
  title: string
  status?: string
  mark?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 shadow-[inset_0_1px_0_0_var(--line)]">
      {mark}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-[18px] font-medium text-foreground">{title}</div>
        {status ? <div className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{status}</div> : null}
      </div>
      {action}
    </div>
  )
}
