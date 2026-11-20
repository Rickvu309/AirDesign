import type { Color, ElementId, SetChange } from "@airdesign/document"
import type { PanelControl } from "@/design/panel"
import { selectedDesign, type DesigningDeck } from "@/editor/live-design-panel"

function colorControlOf(deck: DesigningDeck, node: ElementId): PanelControl | undefined {
  const design = selectedDesign({ ...deck, selection: { ...deck.selection, ids: [node] } })
  if (design === null) return undefined
  return design.model.kind === "text"
    ? design.controls.find((each) => each.trait === "textFill" && each.field === "value")
    : design.controls.find((each) => each.trait === "fills" && each.field === "paint")
}

export function eyedropperChanges(deck: DesigningDeck, color: Color): readonly SetChange[] {
  const solid = { solid: color }
  return deck.selection.ids.flatMap((node) => {
    const control = colorControlOf(deck, node)
    return control === undefined ? [] : [control.change(solid)]
  })
}

export function hasEyedropperTarget(deck: DesigningDeck): boolean {
  return deck.selection.ids.some((node) => colorControlOf(deck, node) !== undefined)
}
