import { elementId, type Box, type ElementId } from "@airdesign/document"
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
        }),
      )
    })
  await draw(2)
  return { host, store, removed, boxes, draw }
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

  it("selects an imported table as an object with no cell editing and Delete removes it", async () => {
    const { host, removed } = await mounted(null)
    const frame = host.querySelector<HTMLElement>("[data-canvas-table]")
    if (frame === null) throw new Error("table")
    await act(async () => frame.focus())
    expect(host.querySelector("[data-selection]")).not.toBeNull()
    expect(frame.querySelector('[contenteditable="true"]')).toBeNull()
    expect(host.querySelector("[data-table-bar]")).toBeNull()
    await key(frame, "Delete")
    expect(removed).toEqual([id])
  })
})
