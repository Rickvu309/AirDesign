import { designCopy } from "@/copy/design-copy"
import { optionWord } from "@/copy/option-copy"
import type { PanelModel, PanelSection } from "@/design/panel"

const controls = (sections: readonly PanelSection[]) => sections.flatMap((section) => section.strips.flat())

export function panelTitle({ kind, nodes, sections, frame }: PanelModel): string {
  if (kind === "frame" && frame === "auto") return designCopy.autoFrame
  if (kind === "shape") {
    const preset = controls(sections).find(
      (control) => control.trait === "geometry" && control.field === "preset",
    )?.value
    if (typeof preset === "string") return preset === "rect" ? designCopy.square : optionWord("shape.preset", preset)
  }
  if (
    kind === "picture" &&
    controls(sections).some((control) => control.trait === "image" && control.field === "weight")
  )
    return designCopy.titles.icon
  if (kind === "text" || kind === "picture") return designCopy.titles[kind]
  if (kind === "many") return designCopy.selected(nodes.length)
  return kind === null ? designCopy.panels.kept : designCopy.panels[kind]
}
