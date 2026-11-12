import { describe, expect, it } from "vitest"
import {
  cellText,
  changedTable,
  limits,
  openingTable,
  readTableValue,
  writeTableValue,
  type TableValue,
} from "./index.js"

const empty = [{ from: 0, runs: [] }]

describe("table value", () => {
  it("opens a new table with one empty cell per row and column, each row its own", () => {
    const table = openingTable(2, 3)
    expect(table.rows.map((row) => row.from)).toEqual([0, 1])
    expect(table.rows.every((row) => row.cells.length === 3 && row.cells.every((cell) => cellText(cell) === ""))).toBe(
      true,
    )
    expect(readTableValue(writeTableValue(table))).toEqual(table)
  })

  it("refuses a value that is not a table a row can be written from", () => {
    const cell = JSON.stringify(empty)
    const read = (rows: string) => readTableValue(`{"rows":${rows}}`)
    expect(read(`[{"from":0,"cells":[${cell}]}]`)).not.toBeNull()
    expect(read("[]")).toBeNull()
    expect(read(`[{"from":0,"cells":[]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":[${cell}]},{"from":1,"cells":[${cell},${cell}]}]`)).toBeNull()
    expect(read(`[{"from":1,"cells":[${cell}]},{"from":0,"cells":[${cell}]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":[${cell}]},{"from":0,"cells":[${cell}]}]`)).toBeNull()
    expect(read(`[{"from":-2,"cells":[${cell}]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":["x"]}]`)).toBeNull()
    expect(read(`[{"from":0,"cells":[${cell}],"h":1}]`)).toBeNull()
    expect(readTableValue(cell)).toBeNull()
    expect(readTableValue("Hello")).toBeNull()
    expect(readTableValue(writeTableValue(openingTable(limits.tableRows + 1, 1)))).toBeNull()
    expect(readTableValue(writeTableValue(openingTable(1, limits.tableColumns + 1)))).toBeNull()
  })

  it("types into one cell and keeps the formatting source of its paragraph and run", () => {
    const formatted: TableValue = { rows: [{ from: 0, cells: [[{ from: 2, runs: [{ from: 1, text: "Old" }] }]] }] }
    const typed = changedTable(formatted, { change: "cell", row: 0, column: 0, text: "New\nLine" })
    expect(typed?.rows[0]?.cells[0]).toEqual([
      { from: 2, runs: [{ from: 1, text: "New" }] },
      { from: 2, runs: [{ from: -1, text: "Line" }] },
    ])
    expect(changedTable(formatted, { change: "cell", row: 0, column: 0, text: "Old" })).toBe(formatted)
    expect(changedTable(formatted, { change: "cell", row: 1, column: 0, text: "x" })).toBeNull()
    expect(changedTable(formatted, { change: "cell", row: 0, column: 1, text: "x" })).toBeNull()
  })

  it("adds an empty row above or below a row and removes any row but the last", () => {
    const table = changedTable(openingTable(2, 2), { change: "cell", row: 1, column: 0, text: "B" })!
    const above = changedTable(table, { change: "row", row: 1, place: "above" })!
    expect(above.rows.map((row) => row.from)).toEqual([0, -1, 1])
    expect(above.rows[1]?.cells).toEqual([empty, empty])
    const below = changedTable(table, { change: "row", row: 1, place: "below" })!
    expect(below.rows.map((row) => row.from)).toEqual([0, 1, -1])
    expect(readTableValue(writeTableValue(below))).toEqual(below)
    const removed = changedTable(below, { change: "remove-row", row: 0 })!
    expect(removed.rows.map((row) => row.from)).toEqual([1, -1])
    expect(cellText(removed.rows[0]!.cells[0]!)).toBe("B")
    const last = changedTable(openingTable(1, 2), { change: "remove-row", row: 0 })
    expect(last).toBeNull()
    expect(changedTable(table, { change: "row", row: 2, place: "below" })).toBeNull()
    expect(changedTable(openingTable(limits.tableRows, 1), { change: "row", row: 0, place: "below" })).toBeNull()
  })
})
