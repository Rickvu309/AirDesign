import { deckColors } from "@airdesign/pptx"

type Parts = ReadonlyMap<string, Uint8Array>

const shownColors = new WeakMap<Parts, readonly string[]>()

export function colorsIn(parts: Parts): readonly string[] {
  const known = shownColors.get(parts)
  if (known !== undefined) return known
  let found: readonly string[] = []
  try {
    found = deckColors(parts)
  } catch {
    found = []
  }
  shownColors.set(parts, found)
  return found
}
