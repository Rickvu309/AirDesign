import type { ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ControlProps } from "@/design/panel"
import { EditorIcon } from "@/editor/editor-icons"

export function Beside({ label, fold, children }: { label: string; fold: ControlProps["fold"]; children: ReactNode }) {
  const layout = "grid grid-cols-2 items-center gap-2"
  const title = "text-[length:var(--type-dense)] font-semibold"
  if (fold === undefined)
    return (
      <div className={layout}>
        <h2 className={title}>{label}</h2>
        {children}
      </div>
    )
  return (
    <Collapsible open={fold.open} onOpenChange={fold.onOpen} className={layout}>
      <h2 className={title}>
        <CollapsibleTrigger className="group/fold flex w-full items-center justify-between gap-1 text-left">
          {label}
          <EditorIcon
            name="chevr"
            size={12}
            strokeWidth={1.5}
            className="shrink-0 text-faint group-data-[panel-open]/fold:rotate-90"
          />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
