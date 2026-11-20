import { elementId, type Box, type ElementId, type TableChange } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasTable } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

export async function unmountAll(): Promise<void> {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
}

export const id = elementId("256.4")
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

export async function mounted(entering: ElementId | null, overrides: Partial<CanvasElement> = {}, columns = 2) {
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

export function cell(host: HTMLElement, spot: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-table-text="${spot}"]`)
  if (found === null) throw new Error(spot)
  return found
}

export async function typed(target: HTMLElement, text: string) {
  await act(async () => {
    target.textContent = text
    target.dispatchEvent(new InputEvent("input", { bubbles: true }))
  })
}

export function named(host: HTMLElement, label: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[aria-label="${label}"]`)
  if (found === null) throw new Error(label)
  return found
}

export async function clicked(target: HTMLElement) {
  await act(async () => target.click())
}

export async function selected(host: HTMLElement) {
  const frame = host.querySelector<HTMLElement>("[data-canvas-table]")
  if (frame === null) throw new Error("table")
  await act(async () => frame.focus())
  return frame
}

export async function doubleClick(target: HTMLElement) {
  Object.defineProperty(target.ownerDocument, "elementFromPoint", { configurable: true, value: () => target })
  await act(async () => {
    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
  })
  Reflect.deleteProperty(target.ownerDocument, "elementFromPoint")
}

export async function key(target: Element | null, name: string, shiftKey = false) {
  if (!(target instanceof HTMLElement)) throw new Error("target")
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: name, shiftKey }))
  })
}

export async function pointer(target: EventTarget, type: string, x: number, y: number, shiftKey = false) {
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

export function clipboardEvent(type: "copy" | "cut" | "paste", items: Readonly<Record<string, string>> = {}) {
  const held = new Map(Object.entries(items))
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData: (kind: string) => held.get(kind) ?? "",
      setData: (kind: string, value: string) => held.set(kind, value),
    },
  })
  return { event, items: held }
}

export function pasteEvent(items: Readonly<Record<string, string>>) {
  return clipboardEvent("paste", items).event
}

export async function pressed(target: HTMLElement, shiftKey = false) {
  await pointer(target, "pointerdown", 30, 30, shiftKey)
  await pointer(target.ownerDocument, "pointerup", 30, 30, shiftKey)
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, clientX: 30, clientY: 30, shiftKey }),
    )
  })
}
