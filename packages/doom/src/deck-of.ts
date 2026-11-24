import { defaultTheme } from "./theme.js"
import type { Doom } from "./doom.js"
import type { Theme } from "./theme.js"

export type DeckLook = { readonly theme: Theme; readonly size: { readonly w: number; readonly h: number } }

export function deckOf(doom: Doom): DeckLook {
  for (const node of doom.nodes.values())
    if (node.type === "deck") return { theme: node.theme ?? defaultTheme, size: node.size ?? { w: 1920, h: 1080 } }
  return { theme: defaultTheme, size: { w: 1920, h: 1080 } }
}

export function deckName(doom: Doom): string {
  for (const node of doom.nodes.values()) if (node.type === "deck") return node.name ?? ""
  return ""
}
