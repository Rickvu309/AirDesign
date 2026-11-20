import type { Landed } from "./decide.js"
import type { Value } from "./value.js"

const measuredSides = new Set(["h", "w,h", "h,w"])

export function measuredOnly(edit: Value): boolean {
  if (edit.v === undefined) return false
  const traits = Object.keys(edit.patch)
  return traits.length === 1 && traits[0] === "box" && measuredSides.has(Object.keys(edit.patch.box ?? {}).join())
}

export function personWrote(row: Landed): boolean {
  return row.actor === "person" && row.visible && !measuredOnly(row)
}
