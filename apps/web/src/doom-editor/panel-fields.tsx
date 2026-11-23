import type { ReactNode } from "react"
import { DesignSection } from "@/editor/design-panel"

export function PanelSection(props: { readonly title: string; readonly name: string; readonly children: ReactNode }) {
  return (
    <div data-panel-section={props.name} className="contents">
      <DesignSection title={props.title}>{props.children}</DesignSection>
    </div>
  )
}
