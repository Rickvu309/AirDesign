declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { changedTable, contrast, type TableChange, type TableValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { decodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { applyStructuralRoute } from "./structural-route.js"
import { readTable, writeTable } from "./table-write.js"

const part = "ppt/slides/slide1.xml"
const box = { x: 100, y: 200, cx: 3000000, cy: 900000, rows: 3, columns: 2 }
const navy = { solid: { rgb: "1F3A5F" } } as const
const pale = { solid: { scheme: "lt2" } } as const
const accent1 = { solid: { scheme: "accent1" } } as const
const header = { rows: [0, 0], columns: [0, 1] } as const
const lead = { rows: [1, 1], columns: [0, 0] } as const
const empty = { rows: [2, 2], columns: [1, 1] } as const

async function newTable(): Promise<ReadonlyMap<string, Uint8Array>> {
  const file = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)
  return applyStructuralRoute(await readParts(file), { name: "graphicFrame.addTable", part, id: 9, ...box })
}

function changed(table: TableValue, changes: readonly TableChange[]): TableValue {
  return changes.reduce((value, change) => changedTable(value, change) ?? value, table)
}

function typed(parts: ReadonlyMap<string, Uint8Array>): TableValue {
  return changed(readTable(parts, part, "9")!, [
    { change: "cell", row: 0, column: 0, text: "Region" },
    { change: "cell", row: 1, column: 0, text: "North" },
  ])
}

function written(parts: ReadonlyMap<string, Uint8Array>, value: TableValue, changes: readonly TableChange[]) {
  return writeTable(parts, part, "9", changed(value, changes))
}

function runs(parts: ReadonlyMap<string, Uint8Array>) {
  const table = paintReader(parts)
    .slide(part)
    .elements.find((each) => each.table !== undefined)?.table
  return (row: number, column: number) => {
    const cell = table?.rows[row]?.cells[column]
    const run = cell?.text?.paragraphs[0]?.runs[0]
    const fill = cell?.fill?.type === "solid" ? cell.fill.color.hex : ""
    return { text: run?.text, color: run?.color?.hex, ratio: contrast(run?.color?.hex ?? "", fill) }
  }
}

it("turns the text in a cell a person fills dark to the theme's light text, typed later too", async () => {
  const opened = await newTable()
  const value = typed(opened)
  const parts = written(opened, value, [
    { change: "fill", cells: lead, fill: navy },
    { change: "fill", cells: empty, fill: navy },
    { change: "cell", row: 2, column: 1, text: "Later" },
  ])
  const shown = runs(parts)
  expect(shown(1, 0)).toMatchObject({ text: "North", color: "FFFFFF" })
  expect(shown(1, 0).ratio).toBeGreaterThanOrEqual(4.5)
  expect(shown(2, 1)).toMatchObject({ text: "Later", color: "FFFFFF" })
  expect(decodeUtf8(parts.get(part)!)).toContain(
    '<a:rPr lang="en-US"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:rPr><a:t>North</a:t>',
  )
})

it("keeps a filled header readable whether the fill is dark or light", async () => {
  const opened = await newTable()
  const value = typed(opened)
  const dark = runs(written(opened, value, [{ change: "fill", cells: header, fill: accent1 }]))
  expect(dark(0, 0)).toMatchObject({ text: "Region", color: "FFFFFF" })
  expect(dark(0, 0).ratio).toBeGreaterThanOrEqual(4.5)
  const light = runs(written(opened, value, [{ change: "fill", cells: header, fill: pale }]))
  expect(light(0, 0)).toMatchObject({ text: "Region", color: "202020" })
  expect(light(0, 0).ratio).toBeGreaterThanOrEqual(4.5)
})

it("follows a second fill back to dark text, and leaves a text colour the person set", async () => {
  const opened = await newTable()
  const value = typed(opened)
  const navyParts = written(opened, value, [{ change: "fill", cells: lead, fill: navy }])
  const paleParts = written(navyParts, readTable(navyParts, part, "9")!, [{ change: "fill", cells: lead, fill: pale }])
  expect(runs(paleParts)(1, 0)).toMatchObject({ text: "North", color: "202020" })
  const red = changed(value, [{ change: "cell", row: 1, column: 0, text: "North" }])
  const colored: TableValue = {
    rows: red.rows.map((row, at) =>
      at === 1
        ? {
            ...row,
            cells: row.cells.map((cell, column) =>
              column === 0
                ? cell.map((p) => ({ ...p, runs: p.runs.map((run) => ({ ...run, color: { scheme: "accent2" } })) }))
                : cell,
            ),
          }
        : row,
    ),
  }
  const kept = written(opened, colored, [{ change: "fill", cells: lead, fill: navy }])
  expect(runs(kept)(1, 0)).toMatchObject({ text: "North", color: "E07A2E" })
})
