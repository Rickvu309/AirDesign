import type { ReactNode } from "react"
import { cn } from "@/lib/class-names"

export function Card({
  title,
  description,
  detail,
  actions,
  align = "center",
  className,
  children,
}: {
  title: string
  description?: string
  detail?: string
  actions?: ReactNode
  align?: "center" | "end"
  className?: string
  children?: ReactNode
}) {
  return (
    <section className={cn("w-[860px] max-w-full rounded-xl bg-canvas p-5", className)}>
      <header
        className={cn(
          "flex justify-between gap-4 max-md:flex-col max-md:items-start",
          align === "end" ? "items-end" : "items-center",
        )}
      >
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
