import { elementId, openingTable, writeTableValue, type ElementId, type TableChange } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasTable, type TableBar } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

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

function grid(rows: number): CanvasTable {
  return {
    columns: [100_000, 100_000],
    rows: Array.from({ length: rows }, () => ({ height: 370_840, cells: [0, 1].map(() => ({ ...empty, borders })) })),
  }
}

function table(rows: number, overrides: Partial<CanvasElement> = {}): CanvasElement {
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
    table: grid(rows),
    ...overrides,
  }
}

const bar: TableBar = ({ row, rows, change }) =>
  createElement(
    "button",
    { type: "button", disabled: rows < 2, onClick: () => change({ change: "remove-row", row }) },
    `Delete row ${row + 1}`,
  )

async function mounted(entering: ElementId | null, overrides: Partial<CanvasElement> = {}) {
  const store = paintStore()
  store.publish({ id, kind: "table", text: "", picture: null })
  const changes: TableChange[] = []
  const removed: ElementId[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const draw = async (rows: number) =>
    act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: { width: 12_192_000, height: 6_858_000, background: null, elements: [table(rows, overrides)] },
          width: 800,
          entering,
          onEdit: () => undefined,
          onBox: () => undefined,
          onRemove: (target: ElementId) => removed.push(target),
          onTable: (_: ElementId, change: TableChange) => changes.push(change),
          tableBar: bar,
        }),
      )
    })
  await draw(2)
  return { host, store, changes, removed, draw }
}

function cell(host: HTMLElement, spot: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-table-text="${spot}"]`)
  if (found === null) throw new Error(spot)
  return found
}

async function key(target: Element | null, name: string, shiftKey = false) {
  if (!(target instanceof HTMLElement)) throw new Error("target")
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: name, shiftKey }))
  })
}

async function typed(target: HTMLElement, text: string) {
  await act(async () => {
    target.textContent = text
    target.dispatchEvent(new InputEvent("input", { bubbles: true }))
  })
}

describe("SlideCanvas table", () => {
  it("selects a new table and puts the caret in its first cell, and typing sends that cell's text", async () => {
    const { host, changes } = await mounted(id)
    expect(host.ownerDocument.activeElement).toBe(cell(host, "0.0"))
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
    expect(host.querySelector("[data-selection] [style*='nwse-resize']")).toBeNull()
    await typed(cell(host, "0.0"), "Region")
    expect(changes).toEqual([{ change: "cell", row: 0, column: 0, text: "Region" }])
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

  it("shows the row control for the row being edited while the table has focus", async () => {
    const { host, changes } = await mounted(null)
    expect(host.querySelector("[data-table-bar]")).toBeNull()
    await act(async () => cell(host, "1.0").focus())
    const button = host.querySelector<HTMLButtonElement>("[data-table-bar] button")
    expect(button?.textContent).toBe("Delete row 2")
    await act(async () => button?.click())
    expect(changes).toEqual([{ change: "remove-row", row: 1 }])
    await act(async () => cell(host, "1.0").blur())
    expect(host.querySelector("[data-table-bar]")).toBeNull()
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
        store.publish({ id, kind: "table", text: writeTableValue({ rows }), picture: null })
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

  it("paints a table the deck cannot edit with no text to type in", async () => {
    const { host } = await mounted(null, { editable: false })
    expect(host.querySelector("[data-table-text]")).toBeNull()
  })
})
