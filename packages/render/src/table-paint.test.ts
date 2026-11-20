import {
  elementId,
  openingTable,
  writeTableValue,
  type Box,
  type ElementId,
  type TableChange,
} from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasTable } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.4")
const words = {
  addRow: "Add row",
  addColumn: "Add column",
  insertRow: (row: number) => `Insert row below row ${String(row)}`,
  insertColumn: (column: number) => `Insert column after column ${String(column)}`,
  row: (row: number) => `Row ${String(row)}`,
  column: (column: number) => `Column ${String(column)}`,
}
const empty = { gridSpan: 1, rowSpan: 1, hMerge: false, vMerge: false, fill: null, text: null }
const borders = { left: null, right: null, top: null, bottom: null }

function grid(rows: number, columns: number): CanvasTable {
  return {
    columns: Array.from({ length: columns }, () => 100_000),
    rows: Array.from({ length: rows }, () => ({
      height: 370_840,
      cells: Array.from({ length: columns }, () => ({ ...empty, borders })),
    })),
  }
}

function table(rows: number, overrides: Partial<CanvasElement> = {}, columns = 2): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${id}`,
    id,
    kind: "table",
    box: { x: 457_200, y: 457_200, width: 5_486_400, height: 741_680, rotation: 0, flipH: false, flipV: false },
    editable: true,
    movable: true,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    table: grid(rows, columns),
    ...overrides,
  }
}

async function mounted(entering: ElementId | null, overrides: Partial<CanvasElement> = {}, columns = 2) {
  const store = paintStore()
  store.publish({ id, kind: "table", text: "" })
  const changes: TableChange[] = []
  const scopes: unknown[] = []
  const removed: ElementId[] = []
  const boxes: Box[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const draw = async (rows: number, across = columns) =>
    act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: {
            width: 12_192_000,
            height: 6_858_000,
            background: null,
            elements: [table(rows, overrides, across)],
          },
          width: 800,
          entering: entering === null ? null : { id: entering },
          onEdit: () => undefined,
          onBoxes: (moved: readonly { id: ElementId; box: Box }[]) => boxes.push(...moved.map(({ box }) => box)),
          onRemove: (targets: readonly ElementId[]) => removed.push(...targets),
          onTable: (_: ElementId, change: TableChange) => changes.push(change),
          tableWords: words,
          onCells: (_: ElementId, cells: unknown) => scopes.push(cells),
        }),
      )
    })
  await draw(2)
  return { host, store, changes, scopes, removed, boxes, draw }
}

function cell(host: HTMLElement, spot: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-table-text="${spot}"]`)
  if (found === null) throw new Error(spot)
  return found
}

async function typed(target: HTMLElement, text: string) {
  await act(async () => {
    target.textContent = text
    target.dispatchEvent(new InputEvent("input", { bubbles: true }))
  })
}

function named(host: HTMLElement, label: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[aria-label="${label}"]`)
  if (found === null) throw new Error(label)
  return found
}

async function clicked(target: HTMLElement) {
  await act(async () => target.click())
}

async function selected(host: HTMLElement) {
  const frame = host.querySelector<HTMLElement>("[data-canvas-table]")
  if (frame === null) throw new Error("table")
  await act(async () => frame.focus())
  return frame
}

async function doubleClick(target: HTMLElement) {
  Object.defineProperty(target.ownerDocument, "elementFromPoint", { configurable: true, value: () => target })
  await act(async () => {
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
  })
  Reflect.deleteProperty(target.ownerDocument, "elementFromPoint")
}

async function key(target: Element | null, name: string, shiftKey = false) {
  if (!(target instanceof HTMLElement)) throw new Error("target")
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: name, shiftKey }))
  })
}

async function pointer(target: EventTarget, type: string, x: number, y: number, shiftKey = false) {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        shiftKey,
      }),
    )
  })
}

async function pressed(target: HTMLElement, shiftKey = false) {
  await pointer(target, "pointerdown", 30, 30, shiftKey)
  await pointer(target.ownerDocument, "pointerup", 30, 30, shiftKey)
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 30, clientY: 30, shiftKey }),
    )
  })
}

describe("SlideCanvas table", () => {
  it("resizes a table by a corner and paints its columns and rows at the new size", async () => {
    const { host, boxes } = await mounted(id)
    const corner = host.querySelector<HTMLElement>('[data-selection] [data-grip="bottom-right"]')
    if (corner === null) throw new Error("no corner")
    await pointer(corner, "pointerdown", 390, 79)
    await pointer(host.ownerDocument, "pointermove", 420, 99)
    await pointer(host.ownerDocument, "pointerup", 420, 99)
    expect(boxes).toEqual([{ x: 457_200, y: 457_200, cx: 5_943_600, cy: 1_046_480 }])
    const art = host.querySelector<HTMLElement>("[aria-colcount]")
    expect(art?.style.gridTemplateColumns).toBe("195px 195px")
    expect(art?.style.gridTemplateRows).toBe("minmax(34.3333px, auto) minmax(34.3333px, auto)")
  })

  it("selects a new table and puts the caret in its first cell, and typing sends that cell's text", async () => {
    const { host, changes } = await mounted(id)
    expect(host.ownerDocument.activeElement).toBe(cell(host, "0.0"))
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    await typed(cell(host, "0.0"), "Region")
    expect(changes).toEqual([{ change: "cell", row: 0, column: 0, text: "Region" }])
    expect(host.querySelectorAll("[data-typing]")).toHaveLength(1)
    expect(host.querySelector('[data-table-cell="0.0"] [data-typing]')).not.toBeNull()
  })

  it("selects a table on focus and starts typing in the cell a double-click lands on", async () => {
    const { host, changes } = await mounted(null)
    const frame = host.querySelector<HTMLElement>("[data-canvas-table]")
    if (frame === null) throw new Error("table")
    await act(async () => frame.focus())
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    expect(frame.style.outlineColor).toBe("transparent")
    const target = host.querySelector<HTMLElement>('[data-table-cell="1.1"]')
    if (target === null) throw new Error("cell")
    await doubleClick(target)
    expect(host.ownerDocument.activeElement).toBe(cell(host, "1.1"))
    await typed(cell(host, "1.1"), "12%")
    expect(changes).toEqual([{ change: "cell", row: 1, column: 1, text: "12%" }])
  })

  it("moves through the cells with Tab and Shift+Tab, and Tab in the last cell adds a row and enters it", async () => {
    const { host, changes, draw } = await mounted(id)
    const document = host.ownerDocument
    await key(document.activeElement, "Tab")
    expect(document.activeElement).toBe(cell(host, "0.1"))
    await key(document.activeElement, "Tab", true)
    expect(document.activeElement).toBe(cell(host, "0.0"))
    await act(async () => cell(host, "1.1").focus())
    await key(document.activeElement, "Tab")
    expect(changes).toEqual([{ change: "row", row: 1, place: "below" }])
    await draw(3)
    expect(document.activeElement).toBe(cell(host, "2.0"))
  })

  it("leaves the cell for the table on Escape, and Delete then removes the whole table", async () => {
    const { host, removed } = await mounted(id)
    await key(host.ownerDocument.activeElement, "Escape")
    const frame = host.querySelector<HTMLElement>("[data-canvas-table]")
    expect(host.ownerDocument.activeElement).toBe(frame)
    await key(cell(host, "0.0"), "Delete")
    expect(removed).toEqual([])
    await key(frame, "Delete")
    expect(removed).toEqual([id])
  })

  it("paints a focused cell from the store, keeps what is being typed, and refuses the browser's own undo", async () => {
    const { host, store } = await mounted(id)
    const typing = cell(host, "0.0")
    const shown = (text: string) => {
      const value = openingTable(2, 2)
      const rows = value.rows.map((row, at) =>
        at === 0
          ? { ...row, cells: [[{ from: 0, runs: text === "" ? [] : [{ from: -1, text }] }], ...row.cells.slice(1)] }
          : row,
      )
      return act(async () => {
        store.publish({ id, kind: "table", text: writeTableValue({ rows }) })
      })
    }
    await typed(typing, "Re")
    await typed(typing, "Region")
    await shown("Re")
    expect(typing.textContent).toBe("Region")
    await shown("Region")
    await shown("")
    expect(typing.textContent).toBe("")
    expect(host.ownerDocument.activeElement).toBe(typing)
    const undo = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "historyUndo" })
    typing.dispatchEvent(undo)
    expect(undo.defaultPrevented).toBe(true)
  })

  it("adds a row or a column at the end from the bars at the table's edges, only while it is selected", async () => {
    const { host, changes } = await mounted(null)
    expect(host.querySelector('[aria-label="Add row"]')).toBeNull()
    await selected(host)
    await clicked(named(host, "Add column"))
    await clicked(named(host, "Add row"))
    expect(changes).toEqual([
      { change: "column", column: 1, place: "after" },
      { change: "row", row: 1, place: "below" },
    ])
  })

  it("inserts a row or a column between two with the plus at their boundary", async () => {
    const { host, changes } = await mounted(null)
    await selected(host)
    await clicked(named(host, "Insert column after column 1"))
    await clicked(named(host, "Insert row below row 1"))
    expect(host.querySelector('[aria-label="Insert column after column 2"]')).toBeNull()
    expect(changes).toEqual([
      { change: "column", column: 0, place: "after" },
      { change: "row", row: 0, place: "below" },
    ])
  })

  it("selects a row or a column with its handle, and Delete removes it rather than the table", async () => {
    const { host, changes, removed } = await mounted(null)
    await selected(host)
    const row = named(host, "Row 2")
    await clicked(row)
    expect(row.getAttribute("aria-pressed")).toBe("true")
    expect(host.querySelectorAll("[data-table-picked]")).toHaveLength(2)
    await key(row, "Delete")
    const column = named(host, "Column 1")
    await clicked(column)
    await key(column, "Backspace")
    expect(changes).toEqual([
      { change: "remove-row", row: 1 },
      { change: "remove-column", column: 0 },
    ])
    expect(removed).toEqual([])
    await clicked(named(host, "Column 2"))
    await key(named(host, "Column 2"), "Escape")
    expect(host.querySelectorAll("[data-table-picked]")).toHaveLength(0)
  })

  it("tells the panel which cells a picked row, a picked column or the cell being typed in names", async () => {
    const { host, scopes } = await mounted(null)
    await selected(host)
    await clicked(named(host, "Row 2"))
    expect(scopes.at(-1)).toEqual({ rows: [1, 1], columns: [0, 1] })
    await clicked(named(host, "Column 1"))
    expect(scopes.at(-1)).toEqual({ rows: [0, 1], columns: [0, 0] })
    await act(async () => cell(host, "0.1").focus())
    expect(scopes.at(-1)).toEqual({ rows: [0, 0], columns: [1, 1] })
  })

  it("names the whole table once Escape leaves the cell being typed in", async () => {
    const { host, scopes } = await mounted(id)
    expect(scopes.at(-1)).toEqual({ rows: [0, 0], columns: [0, 0] })
    await key(host.ownerDocument.activeElement, "Escape")
    expect(host.ownerDocument.activeElement).toBe(host.querySelector("[data-canvas-table]"))
    expect(scopes.at(-1)).toBeNull()
  })

  it("names the whole table when it is selected again after its cell was left by a click away", async () => {
    const { host, scopes } = await mounted(id)
    await act(async () => cell(host, "1.1").focus())
    expect(scopes.at(-1)).toEqual({ rows: [1, 1], columns: [1, 1] })
    const surface = host.querySelector<HTMLElement>("[data-slide-paint]")
    if (surface === null) throw new Error("surface")
    await act(async () => surface.focus())
    expect(host.querySelector("[data-selection]")).toBeNull()
    await selected(host)
    expect(scopes.at(-1)).toBeNull()
  })

  it("picks the cell a click lands on once the table is selected, and Shift-click picks the range to another", async () => {
    const { host, scopes } = await mounted(null, {}, 3)
    const at = (spot: string) => {
      const found = host.querySelector<HTMLElement>(`[data-table-cell="${spot}"]`)
      if (found === null) throw new Error(spot)
      return found
    }
    await pressed(at("0.1"))
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    expect(scopes.filter((scope) => scope !== null)).toEqual([])
    await pressed(at("0.1"))
    expect(scopes.at(-1)).toEqual({ rows: [0, 0], columns: [1, 1] })
    expect(host.querySelectorAll("[data-table-picked]")).toHaveLength(1)
    await pressed(at("1.2"), true)
    expect(scopes.at(-1)).toEqual({ rows: [0, 1], columns: [1, 2] })
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    expect(host.querySelectorAll("[data-table-picked]")).toHaveLength(4)
    await key(host.querySelector("[data-canvas-table]"), "Escape")
    expect(scopes.at(-1)).toBeNull()
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    expect(host.querySelectorAll("[data-table-picked]")).toHaveLength(0)
  })

  it("clears the picked cells' text on Delete and keeps the table", async () => {
    const { host, changes, removed } = await mounted(null)
    const target = host.querySelector<HTMLElement>('[data-table-cell="1.0"]')
    if (target === null) throw new Error("cell")
    await pressed(target)
    await pressed(target)
    await key(host.querySelector("[data-canvas-table]"), "Delete")
    expect(changes).toEqual([{ change: "clear", cells: { rows: [1, 1], columns: [0, 0] } }])
    expect(removed).toEqual([])
  })

  it("moves the table on a drag from a cell without picking that cell", async () => {
    const { host, scopes, boxes } = await mounted(null)
    const target = host.querySelector<HTMLElement>('[data-table-cell="1.0"]')
    if (target === null) throw new Error("cell")
    await pressed(target)
    await pointer(target, "pointerdown", 40, 40)
    await pointer(host.ownerDocument, "pointermove", 80, 60)
    await pointer(host.ownerDocument, "pointerup", 80, 60)
    await act(async () => target.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 80, clientY: 60 })))
    expect(boxes).toHaveLength(1)
    expect(scopes.filter((scope) => scope !== null)).toEqual([])
  })

  it("picks a run of rows with Shift-click on a second handle, and Delete removes them all", async () => {
    const { host, scopes, changes, draw } = await mounted(null)
    await draw(4)
    await selected(host)
    await clicked(named(host, "Row 2"))
    await act(async () =>
      named(host, "Row 4").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })),
    )
    expect(scopes.at(-1)).toEqual({ rows: [1, 3], columns: [0, 1] })
    expect(named(host, "Row 3").getAttribute("aria-pressed")).toBe("true")
    await key(named(host, "Row 4"), "Delete")
    expect(changes).toEqual([{ change: "remove-row", row: 1, through: 3 }])
  })

  it("drags the border between two columns to move width from one to the other, and sends the widths once", async () => {
    const { host, changes } = await mounted(null)
    await selected(host)
    const border = host.querySelector<HTMLElement>('[data-column-border="0"]')
    if (border === null) throw new Error("border")
    await pointer(border, "pointerdown", 200, 50)
    await pointer(border, "pointermove", 210, 50)
    await pointer(border, "pointermove", 220, 50)
    const art = host.querySelector<HTMLElement>("[aria-colcount]")
    expect(art?.style.gridTemplateColumns).toBe("200px 160px")
    await pointer(border, "pointerup", 220, 50)
    expect(changes).toEqual([{ change: "widths", widths: [111_111, 88_889] }])
  })

  it("drags the border under a row to move height from it to the next, and sends the heights once", async () => {
    const { host, changes } = await mounted(null)
    await selected(host)
    const border = host.querySelector<HTMLElement>('[data-row-border="0"]')
    if (border === null) throw new Error("border")
    await pointer(border, "pointerdown", 100, 60)
    await pointer(border, "pointermove", 100, 66)
    await pointer(border, "pointerup", 100, 66)
    const [change] = changes
    expect(change?.change).toBe("heights")
    if (change?.change !== "heights") return
    expect(change.heights[0]! + change.heights[1]!).toBe(741_680)
    expect(change.heights[0]).toBeGreaterThan(370_840)
  })

  it("paints a table the deck cannot edit with no text to type in, and Delete removes it", async () => {
    const { host, removed } = await mounted(null, { editable: false })
    const frame = host.querySelector<HTMLElement>("[data-canvas-table]")
    if (frame === null) throw new Error("table")
    await act(async () => frame.focus())
    expect(host.querySelector("[data-table-text]")).toBeNull()
    await key(frame, "Delete")
    expect(removed).toEqual([id])
  })
})
