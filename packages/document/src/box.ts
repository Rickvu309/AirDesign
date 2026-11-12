import { onlyKeys, record } from "./plain-object.js"

export type Box = { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number }

export const coordinates = { lowest: -27_273_042_329_600, highest: 27_273_042_316_900 } as const

const boxKeys = ["x", "y", "cx", "cy"]

function coordinate(raw: unknown, lowest: number): number | null {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < lowest || raw > coordinates.highest) {
    return null
  }
  return Object.is(raw, -0) ? 0 : raw
}

export function readBox(raw: unknown): Box | null {
  const box = record(raw)
  if (box === null || !onlyKeys(box, boxKeys)) {
    return null
  }
  const x = coordinate(box.x, coordinates.lowest)
  const y = coordinate(box.y, coordinates.lowest)
  const cx = coordinate(box.cx, 0)
  const cy = coordinate(box.cy, 0)
  if (x === null || y === null || cx === null || cy === null) {
    return null
  }
  return { x, y, cx, cy }
}
