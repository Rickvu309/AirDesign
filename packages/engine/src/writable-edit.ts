import type { AgentChange } from "@airdesign/catalog"
import {
  openingElement,
  paragraphedTable,
  paragraphedText,
  placedTable,
  placedText,
  slideKind,
  type Register,
} from "@airdesign/document"

type Held = { readonly value?: unknown } | undefined

function written<Input extends Held>(input: Input, writable: (stored: string) => string): Input {
  if (input === undefined || typeof input.value !== "string") return input
  const value = writable(input.value)
  return value === input.value ? input : { ...input, value }
}

const addedText = (stored: string) => placedText(paragraphedText(stored))
const addedTable = (stored: string) => placedTable(paragraphedTable(stored))

export function writableEdit(register: Register, edit: AgentChange): AgentChange {
  if ("op" in edit) {
    if (edit.op === "add") {
      if (edit.kind === "table") return { ...edit, table: written(edit.table, addedTable) }
      return "text" in edit && edit.text !== undefined ? { ...edit, text: written(edit.text, addedText) } : edit
    }
    if (edit.op !== "set") return edit
    const typed = edit.text === undefined ? edit : { ...edit, text: written(edit.text, paragraphedText) }
    return typed.table === undefined ? typed : { ...typed, table: written(typed.table, paragraphedTable) }
  }
  if (edit.property === "box" || slideKind(edit.node) !== null) return edit
  const kind = openingElement(register, edit.node)?.kind
  if (kind === "shape") return { ...edit, value: paragraphedText(edit.value) }
  if (kind === "table") return { ...edit, value: paragraphedTable(edit.value) }
  return edit
}
