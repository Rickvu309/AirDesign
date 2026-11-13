import { expect, it } from "vitest"
import {
  cellText,
  changedTable,
  limits,
  openingTable,
  readTableValue,
  writeTableValue,
  type TableValue,
} from "./index.js"

const texts = (table: TableValue) => table.rows.map((row) => row.cells.map(cellText))

function typed(table: TableValue, row: number, column: number, text: string): TableValue {
  return changedTable(table, { change: "cell", row, column, text })!
}

it("adds an empty column before or after a column in every row and remembers where each column came from", () => {
  const table = typed(typed(openingTable(2, 2), 0, 0, "A"), 1, 1, "D")
  const before = changedTable(table, { change: "column", column: 1, place: "before" })!
  expect(before.columns).toEqual([0, -1, 1])
  expect(texts(before)).toEqual([
    ["A", "", ""],
    ["", "", "D"],
  ])
  const after = changedTable(table, { change: "column", column: 1, place: "after" })!
  expect(after.columns).toEqual([0, 1, -1])
  expect(readTableValue(writeTableValue(after))).toEqual(after)
  expect(writeTableValue(after).startsWith('{"rows"')).toBe(true)
})

it("deletes any column but the last, and a table back to its own columns writes no column list", () => {
  const table = typed(openingTable(2, 3), 0, 2, "C")
  const removed = changedTable(table, { change: "remove-column", column: 1 })!
  expect(removed.columns).toEqual([0, 2])
  expect(texts(removed)).toEqual([
    ["", "C"],
    ["", ""],
  ])
  const grown = changedTable(table, { change: "column", column: 2, place: "after" })!
  const back = changedTable(grown, { change: "remove-column", column: 3 })!
  expect(back).toEqual(table)
  expect(writeTableValue(back)).toBe(writeTableValue(table))
  expect(changedTable(openingTable(2, 1), { change: "remove-column", column: 0 })).toBeNull()
  expect(changedTable(table, { change: "remove-column", column: 3 })).toBeNull()
  expect(changedTable(table, { change: "column", column: 3, place: "after" })).toBeNull()
  expect(changedTable(openingTable(1, limits.tableColumns), { change: "column", column: 0, place: "after" })).toBeNull()
})

it("keeps a row added after a column change as wide as the other rows", () => {
  const grown = changedTable(openingTable(1, 2), { change: "column", column: 0, place: "before" })!
  const rows = changedTable(grown, { change: "row", row: 0, place: "below" })!
  expect(rows.rows.map((row) => row.cells.length)).toEqual([3, 3])
  expect(rows.columns).toEqual([-1, 0, 1])
})

it("refuses a column list that does not fit the cells or reuses a column", () => {
  const cell = JSON.stringify([{ from: 0, runs: [] }])
  const read = (columns: string) =>
    readTableValue(`{"rows":[{"from":0,"cells":[${cell},${cell}]}],"columns":${columns}}`)
  expect(read("[1,-1]")).toEqual({
    rows: [{ from: 0, cells: [[{ from: 0, runs: [] }], [{ from: 0, runs: [] }]] }],
    columns: [1, -1],
  })
  expect(read("[0,1]")).toEqual({ rows: [{ from: 0, cells: [[{ from: 0, runs: [] }], [{ from: 0, runs: [] }]] }] })
  expect(read("[0]")).toBeNull()
  expect(read("[1,0]")).toBeNull()
  expect(read("[0,0]")).toBeNull()
  expect(read("[-1,-2]")).toBeNull()
  expect(read("[0,0.5]")).toBeNull()
  expect(read('"x"')).toBeNull()
})
