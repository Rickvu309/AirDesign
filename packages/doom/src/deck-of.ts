import { childrenOf, deckOf as deckNodeOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import type { Doom } from "./doom.js"
import type { Theme } from "./theme.js"

export type DeckLook = {
  readonly theme: Theme
  readonly language?: string
  readonly size: { readonly w: number; readonly h: number }
}

export function deckOf(doom: Doom): DeckLook {
  for (const node of doom.nodes.values())
    if (node.type === "deck" && node.theme !== undefined && node.size !== undefined)
      return {
        theme: node.theme,
        size: node.size,
        ...(node.language === undefined ? {} : { language: node.language }),
      }
  throw new Error("no deck with a theme and a size")
}

export function deckName(doom: Doom): string {
  for (const node of doom.nodes.values()) if (node.type === "deck") return node.name ?? ""
  return ""
}

export function* deckTexts(value: Doom): Iterable<string> {
  function* walk(id: NodeId): Iterable<string> {
    for (const node of childrenOf(value, id)) {
      if (node.type === "shape" && node.text !== undefined) yield node.text.chars
      yield* walk(node.id)
    }
  }
  const deck = deckNodeOf(value)
  if (deck !== undefined) yield* walk(deck.id)
}
