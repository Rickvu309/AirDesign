import type { LayoutView } from "@airdesign/document"
import type { PanelModel, PanelReads, PanelSection } from "./panel"
import { panelOrder } from "./panel-order"

const backdropSections: readonly PanelSection["trait"][] = ["fills", "corners", "border"]

export function layoutFields(view: LayoutView | null): PanelReads["fields"] {
  if (view === null) return {}
  const { flow, gap, padding, align, opacity } = view
  return {
    "layout.flow": { value: flow, own: true },
    "layout.gap": { value: gap, own: true },
    "layout.padding": { value: padding, own: true },
    "layout.align": { value: align, own: true },
    "layout.opacity": { value: opacity, own: true },
  }
}

export function framePanel(frame: PanelModel, backdrop: PanelModel, auto: boolean): PanelModel {
  const sections = panelOrder.frame.flatMap(({ section, open }): PanelSection[] => {
    const from = (backdropSections as readonly string[]).includes(section) ? backdrop : frame
    const found = from.sections.find(({ trait }) => trait === section)
    return found === undefined ? [] : [{ ...found, open }]
  })
  return { ...frame, kind: "frame", frame: auto ? "auto" : "free", sections }
}
