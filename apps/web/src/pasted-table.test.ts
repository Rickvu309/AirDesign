import {
  cellText,
  currentValue,
  decide,
  elementGone,
  limits,
  openRegister,
  readTableValue,
  redoOf,
  slideId,
  undoOf,
  type Command,
  type Register,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { pastedTableEdit } from "./pasted-table"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"

const room = { width: 12_192_000, height: 6_858_000 }
const file = [slideId("256")]

function applied(register: Register, commands: readonly Command[]): Register {
  return commands.reduce((current, command) => {
    const decision = decide(current, command)
    if (decision.decision !== "apply") throw new Error(decision.code)
    return decision.register
  }, register)
}

function texts(register: Register, node: string): readonly (readonly string[])[] | null {
  const body = register.elements[node as keyof Register["elements"]]
  const table = body === undefined ? null : readTableValue(currentValue(body))
  return table === null ? null : table.rows.map((row) => row.cells.map(cellText))
}

it("adds a table the size of the pasted cells, fills it in one value, and one Undo takes it away and Redo brings it back filled", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const start = openRegister("", "")
  const cells = [
    ["Region", "Sales"],
    ["North", "12"],
    ["South", "9"],
  ]
  const made = pastedTableEdit(parts, start, { index: 0, size: room, cells })
  if (made === null || made === "too-large") throw new Error("no paste")
  expect(made.edit.element.kind).toBe("table")
  const node = made.edit.element.node
  const pasted = applied(start, [
    { command: "slide", file, edit: made.edit },
    { command: "add", node, floor: "", route: start.route },
    { command: "person", node, value: made.value },
  ])
  expect(texts(pasted, node)).toEqual(cells)
  if (made.undoable === null) throw new Error("no undo")
  const undone = undoOf(pasted, made.undoable)
  if (!undone.ok) throw new Error("undo refused")
  const back = applied(pasted, undone.commands)
  expect(elementGone(back, node)).toBe(true)
  const redone = redoOf(back, undone.undoable)
  if (!redone.ok) throw new Error("redo refused")
  const again = applied(back, redone.commands)
  expect(elementGone(again, node)).toBe(false)
  expect(texts(again, node)).toEqual(cells)
})

it("refuses cells that do not fit one table", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const wide = [Array.from({ length: limits.tableColumns + 1 }, () => "x")]
  const long = Array.from({ length: 40 }, () => Array.from({ length: 10 }, () => "a long cell of text"))
  expect(pastedTableEdit(parts, openRegister("", ""), { index: 0, size: room, cells: wide })).toBe("too-large")
  expect(pastedTableEdit(parts, openRegister("", ""), { index: 0, size: room, cells: long })).toBe("too-large")
})
