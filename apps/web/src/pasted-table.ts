import {
  bytesOf,
  limits,
  pastedTable,
  slideUndoable,
  writeTableValue,
  type CellTexts,
  type ElementId,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { elementCommand, type SlideRoom } from "@/element-edit"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

type ElementAdd = Extract<SlideCommand, { readonly slide: "element-add" }>

export type TablePaste = { readonly index: number; readonly size: SlideRoom; readonly cells: CellTexts }

export type PastedTableEdit = {
  readonly edit: ElementAdd
  readonly value: string
  readonly undoable: Undoable | null
}

export function pastedTableEdit(
  parts: Parts,
  register: Register,
  asked: TablePaste,
): PastedTableEdit | "too-large" | null {
  const table = pastedTable(asked.cells)
  const value = table === null ? null : writeTableValue(table)
  if (table === null || value === null || bytesOf(value) > limits.valueBytes) return "too-large"
  const rows = table.rows.length
  const columns = table.rows[0]?.cells.length ?? 0
  const edit = elementCommand(parts, register, { change: "table", index: asked.index, size: asked.size, rows, columns })
  if (edit === null || edit.slide !== "element-add") return null
  const added = slideUndoable(register, fileSlides(parts, register), edit)
  const node = edit.element.node
  const step = {
    node,
    before: { table: { value: { set: edit.element.value ?? "" } } },
    after: { table: { value: { set: value } } },
  }
  const undoable = added !== null && "elements" in added ? { ...added, rows: [...(added.rows ?? []), step] } : added
  return { edit, value, undoable }
}

export async function commitPastedTable(
  deckId: string,
  parts: Parts,
  register: Register,
  asked: TablePaste,
  paint: (added: ElementId | null, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const made = pastedTableEdit(parts, register, asked)
  if (made === "too-large") return "too-large"
  if (made === null) return "refused"
  const remote = connect(memoryRemote())
  if (!(await remote.enqueueSlide(deckId, fileSlides(parts, register), made.edit)).ok) return "refused"
  const node = made.edit.element.node
  if (!(await remote.enqueue(deckId, made.value, node, "")).ok) return "refused"
  await paint(node, made.undoable)
  return flushPending(connect, deckId)
}
