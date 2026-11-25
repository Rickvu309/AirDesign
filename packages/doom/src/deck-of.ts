import { defaultTheme } from "./theme.js"
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
    if (node.type === "deck")
      return {
        theme: node.theme ?? defaultTheme,
        size: node.size ?? { w: 1920, h: 1080 },
        ...(node.language === undefined ? {} : { language: node.language }),
      }
  return { theme: defaultTheme, size: { w: 1920, h: 1080 } }
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
