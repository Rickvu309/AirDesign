import { fitFramesRows, readLayout, type ElementId } from "@airdesign/document"
import { changeRows, type DesignDeck } from "@/design/design-change"
import { indexedRegister } from "@/editing/indexed-register"

function indexedOf(deck: DesignDeck) {
  const register = deck.shown.shownRegister.current
  return register === null ? null : indexedRegister(deck.shown.shownParts.current, register)
}

export function hasPlainFrame(deck: DesignDeck, nodes: readonly ElementId[]): boolean {
  const register = indexedOf(deck)
  if (register === null) return false
  return nodes.some((node) => readLayout(register, node)?.flow === "none")
}

export function resizeFramesToFit(deck: DesignDeck, nodes: readonly ElementId[]): boolean {
  if (!hasPlainFrame(deck, nodes)) return false
  changeRows(deck, (current) => fitFramesRows(current, nodes) ?? [], "resize-to-fit")
  return true
}
