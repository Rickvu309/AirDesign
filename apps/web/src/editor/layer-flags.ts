import type { ElementId } from "@airdesign/document"
import { changeDesign, type DesignDeck } from "@/design/design-change"
import { fieldsOf } from "@/editor/panel-fields"

type Parts = ReadonlyMap<string, Uint8Array>

export type LayerFlag = "hidden" | "locked" | "mask"

function flagNow(parts: Parts, node: ElementId, flag: LayerFlag): boolean {
  return fieldsOf(parts, node)?.[`identity.${flag}`]?.value === true
}

export function flagTurnsOn(parts: Parts, nodes: readonly ElementId[], flag: LayerFlag): boolean | null {
  if (nodes.length === 0) return null
  return !nodes.every((node) => flagNow(parts, node, flag))
}

export function setLayerFlag(deck: DesignDeck, nodes: readonly ElementId[], flag: LayerFlag, on: boolean) {
  if (nodes.length === 0) return
  changeDesign(deck, () => nodes.map((node) => ({ target: { node }, identity: { [flag]: on } })))
}

export function toggleLayerFlag(deck: DesignDeck, nodes: readonly ElementId[], flag: LayerFlag) {
  const on = flagTurnsOn(deck.shown.displayParts.current, nodes, flag)
  if (on !== null) setLayerFlag(deck, nodes, flag, on)
}
