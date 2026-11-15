import {
  changedTable,
  decide,
  elementId,
  openingTable,
  openRegister,
  readTableValue,
  slideId,
  type Command,
  type Register,
  type SlideCommand,
  writeTableValue,
} from "@airdesign/document"
import { newTableBreaks, readShapes, readTable } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { elementCommand } from "./element-edit"
import { exportedParts, slideBase } from "./exported-parts"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"
import { shownValue } from "./live-repaint"
import { tableEditName, tableEditable, tableValue } from "./table-edit"

const size = { width: 12192000, height: 6858000 }
const file = [slideId("256")]
const part = "ppt/slides/slide1.xml"

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function slide(register: Register, edit: SlideCommand | null): Register {
  if (edit === null) throw new Error("no edit")
  return applied(register, { command: "slide", file, edit })
}

function inserted() {
  const parts = onSlide(xml(twoBoxSlide))
  const top = { x: 0, y: 0, width: size.width, height: 3000000, rotation: 0, flipH: false, flipV: false }
  const room = { ...size, elements: [{ box: top }] }
  const edit = elementCommand(parts, openRegister("", ""), {
    change: "table",
    index: 0,
    size: room,
    rows: 3,
    columns: 3,
  })
  return { parts, edit, register: slide(openRegister("", ""), edit) }
}

it("puts a new three by three table in clear space under the next free id, empty and ready to type", () => {
  const { edit } = inserted()
  expect(edit).toMatchObject({ slide: "element-add", id: "256", element: { node: "256.4", kind: "table" } })
  if (edit?.slide !== "element-add") throw new Error("element-add")
  expect(edit.element.box).toEqual({ x: 2438400, y: 4235580, cx: 7315200, cy: 1112520 })
  expect(readTableValue(edit.element.value ?? "")?.rows.map((row) => row.cells.length)).toEqual([3, 3, 3])
})

it("puts a table of the picked size in clear space, one row height per row", () => {
  const parts = onSlide(xml(twoBoxSlide))
  const room = { ...size, elements: [] }
  const edit = elementCommand(parts, openRegister("", ""), {
    change: "table",
    index: 0,
    size: room,
    rows: 4,
    columns: 5,
  })
  if (edit?.slide !== "element-add") throw new Error("element-add")
  expect(edit.element.box?.cy).toBe(4 * 370840)
  expect(readTableValue(edit.element.value ?? "")?.rows.map((row) => row.cells.length)).toEqual([5, 5, 5, 5])
})

it("exports a typed table with an added and a removed row, and a table as it was opened changes nothing", () => {
  const { parts, register } = inserted()
  const node = elementId("256.4")
  const base = slideBase(parts, register)
  const shape = readShapes(base).find((each) => each.shape === "4")!
  expect(tableEditable(base, shape)).toBe(true)
  const opened = applied(register, { command: "add", node, floor: "", route: "" })
  const steps = [
    { change: "cell", row: 0, column: 0, text: "Region" },
    { change: "row", row: 0, place: "below" },
    { change: "cell", row: 1, column: 2, text: "North" },
    { change: "remove-row", row: 3 },
  ] as const
  let edited = opened
  for (const change of steps) {
    const value = tableValue(base, shape, shownValue(edited, node, ""), change)
    if (value === null) throw new Error(change.change)
    edited = applied(edited, { command: "person", node, value })
  }
  const exported = exportedParts(parts, edited)
  const cells = readTable(exported, part, "4")?.rows.map((row) => row.cells.map((cell) => cell[0]?.runs[0]?.text ?? ""))
  expect(cells).toEqual([
    ["Region", "", ""],
    ["", "", "North"],
    ["", "", ""],
  ])
  expect(newTableBreaks(base, exported)).toEqual([])
  expect(exportedParts(parts, opened).get(part)).toEqual(base.get(part))
})

it("keeps the frame as tall as its rows when a person moves the table after adding a row", () => {
  const { parts, register } = inserted()
  const node = elementId("256.4")
  const base = slideBase(parts, register)
  const shape = readShapes(base).find((each) => each.shape === "4")!
  let edited = applied(register, { command: "add", node, floor: "", route: "" })
  edited = applied(edited, {
    command: "person",
    node,
    property: "box",
    value: { x: 0, y: 0, cx: 7315200, cy: 1112520 },
  })
  edited = applied(edited, {
    command: "person",
    node,
    value: tableValue(base, shape, shownValue(edited, node, ""), { change: "row", row: 2, place: "below" })!,
  })
  const exported = exportedParts(parts, edited)
  expect(readShapes(exported).find((each) => each.shape === "4")?.box).toEqual({ x: 0, y: 0, cx: 7315200, cy: 1483360 })
  expect(newTableBreaks(base, exported)).toEqual([])
})

it("refuses a change that leaves no row, and the first edit of an imported table starts from its file", () => {
  const { parts, register } = inserted()
  const base = slideBase(parts, register)
  const shape = readShapes(base).find((each) => each.shape === "4")!
  const one = { change: "remove-row", row: 0 } as const
  const node = elementId("256.4")
  let edited = applied(register, { command: "add", node, floor: "", route: "" })
  edited = applied(edited, {
    command: "person",
    node,
    value: tableValue(base, shape, shownValue(edited, node, ""), one)!,
  })
  edited = applied(edited, {
    command: "person",
    node,
    value: tableValue(base, shape, shownValue(edited, node, ""), one)!,
  })
  expect(tableValue(base, shape, shownValue(edited, node, ""), one)).toBeNull()
  expect(tableValue(base, shape, null, { change: "cell", row: 0, column: 0, text: "" })).toBeNull()
})

it("exports a table with an added and a deleted column, its frame as wide as its columns, and refuses the last column", () => {
  const { parts, register } = inserted()
  const node = elementId("256.4")
  const base = slideBase(parts, register)
  const shape = readShapes(base).find((each) => each.shape === "4")!
  const steps = [
    { change: "cell", row: 0, column: 1, text: "Sales" },
    { change: "column", column: 1, place: "after" },
    { change: "cell", row: 0, column: 2, text: "Growth" },
    { change: "remove-column", column: 0 },
  ] as const
  let edited = applied(register, { command: "add", node, floor: "", route: "" })
  for (const change of steps) {
    const value = tableValue(base, shape, shownValue(edited, node, ""), change)
    if (value === null) throw new Error(change.change)
    edited = applied(edited, { command: "person", node, value })
  }
  const exported = exportedParts(parts, edited)
  const cells = readTable(exported, part, "4")?.rows.map((row) => row.cells.map((cell) => cell[0]?.runs[0]?.text ?? ""))
  expect(cells).toEqual([
    ["Sales", "Growth", ""],
    ["", "", ""],
    ["", "", ""],
  ])
  expect(readShapes(exported).find((each) => each.shape === "4")?.box).toMatchObject({ cx: 7315200 })
  expect(newTableBreaks(base, exported)).toEqual([])
  const last = { change: "remove-column", column: 0 } as const
  for (let column = 0; column < 2; column += 1)
    edited = applied(edited, {
      command: "person",
      node,
      value: tableValue(base, shape, shownValue(edited, node, ""), last)!,
    })
  expect(tableValue(base, shape, shownValue(edited, node, ""), last)).toBeNull()
})

it("names a table edit by what it changed: the text, a cell's fill or a border", () => {
  const table = openingTable(2, 2)
  const cells = { rows: [0, 0], columns: [0, 1] } as const
  const accent = { solid: { scheme: "accent1" } } as const
  const written = (change: Parameters<typeof changedTable>[1]) => writeTableValue(changedTable(table, change)!)
  const before = writeTableValue(table)
  expect(tableEditName(before, written({ change: "cell", row: 0, column: 0, text: "Q3" }))).toBe("text")
  expect(tableEditName(before, written({ change: "fill", cells, fill: accent }))).toBe("cell-fill")
  expect(tableEditName(before, written({ change: "border", cells, sides: "bottom", border: { width: 12700 } }))).toBe(
    "border",
  )
  expect(tableEditName(before, "Q3")).toBeNull()
})
