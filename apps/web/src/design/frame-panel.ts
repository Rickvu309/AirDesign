import type { PanelModel, PanelSection } from "./panel"
import { panelOrder } from "./panel-order"

const backdropSections: readonly PanelSection["trait"][] = ["fills", "opacity", "corners", "border"]

export function framePanel(frame: PanelModel, backdrop: PanelModel, auto: boolean): PanelModel {
  const sections = panelOrder.frame.flatMap(({ section, open }): PanelSection[] => {
    const from = (backdropSections as readonly string[]).includes(section) ? backdrop : frame
    const found = from.sections.find(({ trait }) => trait === section)
    return found === undefined ? [] : [{ ...found, open }]
  })
  return { ...frame, kind: "frame", frame: auto ? "auto" : "free", sections }
}
