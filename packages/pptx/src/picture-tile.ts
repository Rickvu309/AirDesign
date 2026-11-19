import { fillWritten, pictureAt } from "./blip-edit.js"
import { spliceBytes, type MarkupElement } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import { paintAttribute } from "./paint-color.js"
import { whole, type ElementAt, type Parts } from "./xml-codec.js"

const full = 100_000

function ratio(tile: MarkupElement, axis: "sx" | "sy"): number {
  const raw = paintAttribute(tile, axis) ?? ""
  const value = /^\+?\d+$/.test(raw)
    ? Number(raw)
    : /^\+?\d+(\.\d+)?%$/.test(raw)
      ? Math.round(Number(raw.slice(0, -1)) * 1000)
      : full
  return Number.isSafeInteger(value) && value > 0 ? value : full
}

export function tileRatios(tile: MarkupElement): { x: number; y: number } {
  return { x: ratio(tile, "sx"), y: ratio(tile, "sy") }
}

export function shownTileScale(parts: Parts, at: ElementAt): number | null {
  const found = pictureAt(parts, at)
  const tile = found?.children[found.fill.index]?.find((element) => element.kind === "a:tile")
  if (tile === undefined) return null
  const { x, y } = tileRatios(tile)
  return x === y ? x : null
}

export const tileScaleXml = whole({
  read: shownTileScale,
  write: (parts, at, value: number) =>
    fillWritten(parts, at, (found) => {
      const tile = found.children[found.fill.index]?.find((element) => element.kind === "a:tile")
      if (tile === undefined) return found.bytes
      const edits = ["sx", "sy"].flatMap((axis) => {
        const edit = attributeEdit(found.bytes, tile, axis, String(value))
        return edit === null ? [] : [edit]
      })
      return spliceBytes(found.bytes, edits)
    }),
})
