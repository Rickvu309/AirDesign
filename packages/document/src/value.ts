import type { Box } from "./box.js"
import { bytesOf } from "./limits.js"

export type Value =
  | { readonly property?: never; readonly value: string }
  | { readonly property: "box"; readonly value: Box }

export function storedValue(edit: Value): Value {
  if (edit.property === "box") return { property: "box", value: edit.value }
  return { value: edit.value }
}

export function valueBytes(edit: Value): number {
  return bytesOf(edit.property === "box" ? JSON.stringify(edit.value) : edit.value)
}
