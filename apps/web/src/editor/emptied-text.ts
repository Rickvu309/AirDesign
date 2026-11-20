import type { ElementId, Register } from "@airdesign/document"
import { emptiedText } from "@airdesign/engine"

export type LeavingDeck = {
  readonly typedIn: (node: ElementId) => boolean
  readonly landed: () => Promise<void>
  readonly saved: () => Promise<Register | null>
  readonly remove: (node: ElementId) => Promise<unknown>
}

export function leftEmptied(deck: LeavingDeck): (node: ElementId) => Promise<void> {
  return async (node) => {
    if (!deck.typedIn(node)) return
    await deck.landed()
    const register = await deck.saved()
    if (register !== null && emptiedText(register, node)) await deck.remove(node)
  }
}
