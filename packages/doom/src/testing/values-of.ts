import type { Doom } from "../index.js"

export function valuesOf(doom: Doom): Record<string, unknown> {
  return Object.fromEntries(
    [...doom.nodes].map(([id, node]) => [
      id,
      Object.fromEntries(Object.entries(node).filter(([key]) => key !== "rev")),
    ]),
  )
}
