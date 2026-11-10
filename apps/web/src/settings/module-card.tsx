import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ModuleCard({
  title,
  description,
  detail,
  actions,
  align = "center",
  children,
}: {
  title: string
  description?: string
  detail?: string
  actions?: ReactNode
  align?: "center" | "end"
  children?: ReactNode
}) {
  return (
    <section className="w-[860px] rounded-xl bg-background p-5 shadow-[inset_0_0_0_1px_var(--line)]">
      <header className={cn("flex justify-between gap-4", align === "end" ? "items-end" : "items-center")}>
        <div className="min-w-0">
          <h2 className="text-[length:var(--type-section)] leading-5 font-semibold text-foreground">{title}</h2>
          {detail ? <p className="mt-1 text-[30px] leading-[39px] font-semibold text-foreground">{detail}</p> : null}
          {description ? (
            <p className="mt-1 text-[length:var(--type-dense)] leading-[17px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </header>
      {children ? <div className="mt-3.5">{children}</div> : null}
    </section>
  )
}
