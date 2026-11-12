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

function tableAdded(original: ReadonlyMap<string, Uint8Array>) {
  const shape = String(freeShapeId(original, part))
  const element = {
    node: elementId(`256.${shape}`),
    kind: "table" as const,
    value: writeTableValue(openingTable(3, 3)),
    box,
    grouped: false,
  }
  const added = orderedParts(original, { file: [id], order: [{ slide: "element-add", id, element }] })
  const changes: Parameters<typeof changedTable>[1][] = [
    { change: "cell", row: 0, column: 0, text: "Region" },
    { change: "cell", row: 0, column: 1, text: "Sales" },
    { change: "row", row: 1, place: "below" },
    { change: "remove-row", row: 3 },
  ]
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
