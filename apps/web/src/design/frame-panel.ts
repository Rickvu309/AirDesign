import { readLayout, type ElementId, type LayoutView, type Register, type ScopedElement } from "@airdesign/document"
import type { PanelModel, PanelReads, PanelSection } from "./panel"
import { panelOrder } from "./panel-order"

const backdropSections: readonly PanelSection["trait"][] = ["fills", "corners", "border"]

export function layoutFields(view: LayoutView | null): PanelReads["fields"] {
  if (view === null) return {}
  const { flow, gap, padding, align, opacity, width, height } = view
  return {
    "layout.flow": { value: flow, own: true },
    "layout.gap": { value: gap, own: true },
    "layout.padding": { value: padding, own: true },
    "layout.align": { value: align, own: true },
    "layout.opacity": { value: opacity, own: true },
    "layout.width": { value: width, own: true },
    "layout.height": { value: height, own: true },
  }
}

export function sizedFields(laid: Register | null, view: ScopedElement): PanelReads["fields"] {
  if (laid === null) return {}
  if (view.facts.frame !== undefined) return layoutFields(readLayout(laid, view.node))
  if (view.facts.framed !== "auto" || view.parent == null) return {}
  return childFields(readLayout(laid, view.parent), view.node)
}

function childFields(holder: LayoutView | null, node: ElementId): PanelReads["fields"] {
  if (holder === null) return {}
  const fill = holder.children.find((child) => child.node === node)?.fill
  return {
    "layout.width": { value: fill?.width === true ? "fill" : "fixed", own: true },
    "layout.height": { value: fill?.height === true ? "fill" : "fixed", own: true },
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
