import type { ReactNode } from "react"
import { DesignSection } from "@/editor/design-sections"

export function PanelSection(props: {
  readonly title: string | null
  readonly name: string
  readonly children: ReactNode
}) {
  return (
    <div data-panel-section={props.name} className="contents">
      <DesignSection title={props.title}>{props.children}</DesignSection>
    </div>
  )
}
