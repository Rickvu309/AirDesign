import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { grownTable, paintedRows } from "./table-rows.js"
import { paintStore } from "./index.js"

const table = elementId("256.4")
const box = { x: 0, y: 0, width: 1_000_000, height: 741_680, rotation: 0, flipH: false, flipV: false }

describe("painted table rows", () => {
  it("reads each row's painted height from the grid's tracks, in slide units", () => {
    expect(paintedRows("30px 45.5px", 1 / 15_240)).toEqual([457_200, 693_420])
    expect(paintedRows("minmax(24px, auto) minmax(24px, auto)", 1 / 15_240)).toBeNull()
    expect(paintedRows("", 1 / 15_240)).toBeNull()
  })

  it("keeps a row's own height when it paints within half a pixel of it, so an untouched row writes as it was", () => {
    expect(paintedRows("24.3281px 42px", 1 / 15_240, [370_840, 370_840])).toEqual([370_840, 640_080])
  })

  it("grows the frame to the painted rows measured at its height, and only then", () => {
    const rows = { written: "{}", height: 741_680, heights: [457_200, 685_800] }
    expect(grownTable(box, rows)).toEqual({ ...box, height: 1_143_000 })
    expect(grownTable({ ...box, height: 900_000 }, rows)).toEqual({ ...box, height: 900_000 })
    expect(grownTable(box, { ...rows, heights: [300_000, 300_000] })).toEqual(box)
    expect(grownTable(box, null)).toEqual(box)
  })

  it("keeps the rows the canvas measured, tells the frame when they change, and lists them for the export", () => {
    const store = paintStore()
    const heard: number[] = []
    const stop = store.boxSubscribe(table)(() => heard.push(heard.length))
    const rows = { written: "{}", height: 741_680, heights: [457_200, 685_800] }
    store.placeRows(table, rows)
    store.placeRows(table, { ...rows, heights: [457_200, 685_800] })
    expect(store.getRows(table)).toEqual(rows)
    expect(heard).toHaveLength(1)
    expect([...store.rows()]).toEqual([[table, rows]])
    store.placeRows(table, null)
    expect(store.getRows(table)).toBeNull()
    expect(heard).toHaveLength(2)
    stop()
  })
})
