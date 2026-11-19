import type { ElementId } from "@airdesign/document"
import { changeDesign, type DesignDeck } from "@/design/design-change"
import { fieldsOf } from "@/editor/panel-fields"

type Parts = ReadonlyMap<string, Uint8Array>

function hiddenNow(parts: Parts, node: ElementId): boolean {
  return fieldsOf(parts, node)?.["identity.hidden"]?.value === true
}

export function hidingOf(parts: Parts, nodes: readonly ElementId[]): boolean | null {
  if (nodes.length === 0) return null
  return !nodes.every((node) => hiddenNow(parts, node))
}

export function hideLayers(deck: DesignDeck, nodes: readonly ElementId[], hidden: boolean) {
  if (nodes.length === 0) return
  changeDesign(deck, () => nodes.map((node) => ({ target: { node }, identity: { hidden } })))
}

export function toggleHidden(deck: DesignDeck, nodes: readonly ElementId[]) {
  const hidden = hidingOf(deck.shown.displayParts.current, nodes)
  if (hidden !== null) hideLayers(deck, nodes, hidden)
}
