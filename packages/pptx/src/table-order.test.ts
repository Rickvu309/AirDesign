declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { changedTable, elementId, openingTable, slideId, writeTableValue, type TableValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { freeShapeId, newTableBreaks, orderedParts, readParts, readShapes, readTable, writeTable } from "./index.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const id = slideId("256")
const part = "ppt/slides/slide1.xml"
const box = { x: 2438400, y: 4983480, cx: 7315200, cy: 1112520 }

function fixture(name: string) {
  return readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
}

type Change = Parameters<typeof changedTable>[1]

const rowChanges: readonly Change[] = [
  { change: "cell", row: 0, column: 0, text: "Region" },
  { change: "cell", row: 0, column: 1, text: "Sales" },
  { change: "row", row: 1, place: "below" },
  { change: "remove-row", row: 3 },
]

const columnChanges: readonly Change[] = [
  { change: "cell", row: 0, column: 0, text: "Region" },
  { change: "cell", row: 0, column: 1, text: "Sales" },
  { change: "cell", row: 0, column: 2, text: "Total" },
  { change: "column", column: 1, place: "after" },
  { change: "cell", row: 0, column: 2, text: "Growth" },
  { change: "remove-column", column: 3 },
  { change: "column", column: 0, place: "before" },
  { change: "cell", row: 1, column: 0, text: "North" },
  { change: "row", row: 1, place: "below" },
]

function tableAdded(original: ReadonlyMap<string, Uint8Array>, changes: readonly Change[] = rowChanges) {
  const shape = String(freeShapeId(original, part))
  const element = {
    node: elementId(`256.${shape}`),
    kind: "table" as const,
    value: writeTableValue(openingTable(3, 3)),
    box,
    grouped: false,
  }
  const added = orderedParts(original, { file: [id], order: [{ slide: "element-add", id, element }] })
  const value = changes.reduce<TableValue>(
    (table, change) => changedTable(table, change) ?? table,
    readTable(added, part, shape)!,
  )
  return { shape, added, written: writeTable(added, part, shape, value) }
}

it("adds a table under its own id with a frame as tall as its rows, changing only that slide's part", async () => {
  const original = await fixture("blank.pptx")
  const { shape, added, written } = tableAdded(original)
  expect(readShapes(added).find((each) => each.shape === shape)).toMatchObject({ kind: "p:graphicFrame", box })
  expect(readTable(added, part, shape)).toEqual(openingTable(3, 3))
  for (const [name, bytes] of original) {
    if (name === part) expect(written.get(name)).not.toEqual(bytes)
    else expect(written.get(name)).toBe(bytes)
  }
  expect(newTableBreaks(original, written)).toEqual([])
  const table = readTable(written, part, shape)!
  expect(
    table.rows.map((row) => row.cells.map((cell) => cell.flatMap((each) => each.runs.map((run) => run.text)).join(""))),
  ).toEqual([
    ["Region", "Sales", ""],
    ["", "", ""],
    ["", "", ""],
  ])
})

it("writes the same slide part the validator judges in the table-added case", async () => {
  const { written } = tableAdded(await fixture("blank.pptx"))
  expect(written.get(part)).toEqual((await fixture("table-added.pptx")).get(part))
})

it("adds and deletes columns of a new table, widening the frame by each column's width", async () => {
  const original = await fixture("blank.pptx")
  const { shape, written } = tableAdded(original, columnChanges)
  const table = readTable(written, part, shape)!
  expect(
    table.rows.map((row) => row.cells.map((cell) => cell.flatMap((each) => each.runs.map((run) => run.text)).join(""))),
  ).toEqual([
    ["", "Region", "Sales", "Growth"],
    ["North", "", "", ""],
    ["", "", "", ""],
    ["", "", "", ""],
  ])
  expect(readShapes(written).find((each) => each.shape === shape)?.box).toMatchObject({ cx: 9753600, cy: 1483360 })
  expect(newTableBreaks(original, written)).toEqual([])
  for (const [name, bytes] of original) if (name !== part) expect(written.get(name)).toBe(bytes)
})

it("writes the same slide part the validator judges in the table-columns case", async () => {
  const { written } = tableAdded(await fixture("blank.pptx"), columnChanges)
  expect(written.get(part)).toEqual((await fixture("table-columns.pptx")).get(part))
})
