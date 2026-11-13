import type { MarkupElement } from "./element-span.js"
import { sameBytes } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import type { TableEdit } from "./route-table-host.js"
import { applyStructuralRoute } from "./structural-route.js"
import { newTableBreaks } from "./table-check.js"
import { gridOf } from "./table-grid.js"

type Parts = ReadonlyMap<string, Uint8Array>

function rowAt(bytes: Uint8Array, row: number): MarkupElement | undefined {
  return requireMarkup(bytes).elements.filter((element) => element.kind === "a:tr")[row - 1]
}

function frameOf(bytes: Uint8Array, shape: string): MarkupElement {
  const grid = gridOf(bytes, shape)
  const frame = grid.elements.find(
    (element) => element.kind === "p:graphicFrame" && element.index < grid.table.index && element.end >= grid.table.end,
  )
  if (frame === undefined) throw new Error("p:graphicFrame")
  return frame
}

function removedRowKept(old: Uint8Array, next: Uint8Array, row: number): string | null {
  const found = rowAt(old, row)
  if (found === undefined) return "a:tr"
  return sameBytes(next.subarray(next.length - old.length + found.end), old.subarray(found.end))
    ? null
    : "after the row"
}

function removedColumnKept(old: Uint8Array, next: Uint8Array, shape: string): string | null {
  const was = frameOf(old, shape)
  const now = frameOf(next, shape)
  if (gridOf(next, shape).columns !== gridOf(old, shape).columns - 1) return "a:gridCol"
  const outside =
    sameBytes(next.subarray(0, now.start), old.subarray(0, was.start)) &&
    sameBytes(next.subarray(now.end), old.subarray(was.end))
  return outside ? null : "outside the table"
}

function undoneKept(after: Parts, old: Uint8Array, edit: TableEdit): string | null {
  const back =
    edit.name === "tbl.addRow"
      ? applyStructuralRoute(after, { ...edit, name: "tbl.removeRow", row: edit.row + 1 })
      : edit.name === "tbl.addColumn"
        ? applyStructuralRoute(after, {
            name: "tbl.removeColumn",
            part: edit.part,
            shape: edit.shape,
            column: edit.place === "after" ? edit.column + 1 : edit.column,
          })
        : after
  return sameBytes(back.get(edit.part) ?? new Uint8Array(), old) ? null : "not undone"
}

export function tableEditFault(before: Parts, after: Parts, edit: TableEdit): string | null {
  const old = before.get(edit.part)
  const next = after.get(edit.part)
  if (old === undefined || next === undefined) return "part"
  const breaks = newTableBreaks(before, after)
  if (breaks.length > 0) return JSON.stringify(breaks)
  switch (edit.name) {
    case "tbl.removeRow":
      return removedRowKept(old, next, edit.row)
    case "tbl.removeColumn":
      return removedColumnKept(old, next, edit.shape)
    case "tbl.addRow":
    case "tbl.addColumn":
      return undoneKept(after, old, edit)
    case "tbl.orderRow":
      return "order"
  }
}
