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

async function mounted(entering: ElementId | null, overrides: Partial<CanvasElement> = {}) {
  const store = paintStore()
  store.publish({ id, kind: "table", text: "" })
  const changes: TableChange[] = []
  const removed: ElementId[] = []
  const boxes: Box[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const draw = async (rows: number, columns = 2) =>
    act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: {
            width: 12_192_000,
            height: 6_858_000,
            background: null,
            elements: [table(rows, overrides, columns)],
          },
          width: 800,
          entering: entering === null ? null : { id: entering },
          onEdit: () => undefined,
          onBoxes: (moved: readonly { id: ElementId; box: Box }[]) => boxes.push(...moved.map(({ box }) => box)),
          onRemove: (targets: readonly ElementId[]) => removed.push(...targets),
          onTable: (_: ElementId, change: TableChange) => changes.push(change),
        }),
      )
    })
  await draw(2)
  return { host, store, changes, removed, boxes, draw }
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

async function pointer(target: EventTarget, type: string, x: number, y: number) {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
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
