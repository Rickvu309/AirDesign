import { readShapes } from "./read-shapes.js"
import { shownText } from "./text-value-route.js"

export function createdShapesLanded(
  parts: ReadonlyMap<string, Uint8Array>,
  landed: readonly { readonly text: string; readonly slide: string }[],
  untouched: readonly string[],
): boolean {
  const rows = readShapes(parts)
  for (const item of landed) {
    const found = rows.filter((row) => shownText(row.text) === item.text)
    if (found.length !== 1) return false
    const row = found[0]
    if (row === undefined || row.slide !== item.slide) return false
  }
  for (const slide of untouched) {
    if (rows.some((row) => row.slide === slide && landed.some((item) => item.text === shownText(row.text))))
      return false
  }
  return true
}
