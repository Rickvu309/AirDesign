import { defaultTheme } from "./default-theme-art.js"
import type { Scene } from "./scene.js"
import type { Theme } from "./theme.js"

export type DeckLook = { readonly theme: Theme; readonly size: { readonly w: number; readonly h: number } }

export function deckOf(scene: Scene): DeckLook {
  for (const node of scene.nodes.values())
    if (node.type === "deck") return { theme: node.theme ?? defaultTheme, size: node.size ?? { w: 1920, h: 1080 } }
  return { theme: defaultTheme, size: { w: 1920, h: 1080 } }
}
