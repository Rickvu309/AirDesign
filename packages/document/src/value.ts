import type { Box } from "./box.js"
import type { Row } from "./row.js"

export type Value =
  | { readonly property?: never; readonly value: string; readonly v?: never }
  | { readonly property: "box"; readonly value: Box; readonly v?: never }
  | (Row & { readonly property?: never; readonly value?: never })

export type FormatOneValue = Exclude<Value, Row>

export function storedValue(edit: FormatOneValue): FormatOneValue
export function storedValue(edit: Value): Value
export function storedValue(edit: Value): Value {
  if (edit.v !== undefined) return { v: edit.v, patch: edit.patch }
  if (edit.property === "box") return { property: "box", value: edit.value }
  return { value: edit.value }
}
