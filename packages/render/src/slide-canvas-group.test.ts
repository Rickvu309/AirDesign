import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide, type PaintBox } from "./index.js"

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

const placed = (x: number, y: number, width: number, height: number): PaintBox => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  flipH: false,
  flipV: false,
})

const group = elementId("256.9")
const first = elementId("256.2")
const second = elementId("256.3")
const loose = elementId("256.4")
const groupBox = placed(1_524_000, 1_524_000, 3_048_000, 1_524_000)
const carry = { id: group, box: groupBox }

function element(id: ElementId, box: PaintBox, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${id}`,
    id,
    kind: "shape",
    box,
    editable: false,
    movable: false,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...overrides,
  }
}

const elements: readonly CanvasElement[] = [
  element(group, groupBox, { kind: "group", movable: true, filled: false }),
  element(first, placed(1_524_000, 1_524_000, 1_524_000, 1_524_000), { group: carry }),
  element(second, placed(3_048_000, 1_524_000, 1_524_000, 1_524_000), { group: carry }),
  element(loose, placed(6_096_000, 3_048_000, 1_524_000, 1_524_000), { movable: true }),
]

type Told = { boxes: [ElementId, Box][]; grouped: (readonly ElementId[])[]; ungrouped: ElementId[] }

async function mounted() {
  const store = paintStore()
  for (const each of elements)
    if (each.id !== null) store.publish({ id: each.id, kind: each.kind, text: "", picture: null })
  const told: Told = { boxes: [], grouped: [], ungrouped: [] }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements }
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide,
        width: 1200,
        onBox: (target: ElementId, box: Box) => told.boxes.push([target, box]),
        onGroup: (ids: readonly ElementId[]) => told.grouped.push(ids),
        onUngroup: (id: ElementId) => told.ungrouped.push(id),
      }),
    )
  })
  return { host, told }
}

function frameOf(host: HTMLElement, id: ElementId): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${id}"]`)
  if (found === null) throw new Error(`no element ${id}`)
  return found
}

async function pointer(target: EventTarget, type: string, x: number, y: number, shiftKey = false): Promise<void> {
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

async function click(target: HTMLElement, shiftKey = false) {
  await pointer(target, "pointerdown", 200, 200, shiftKey)
  await pointer(target.ownerDocument, "pointerup", 200, 200)
}

async function chord(target: HTMLElement, shiftKey: boolean) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "g",
        code: "KeyG",
        ctrlKey: true,
        shiftKey,
      }),
    )
  })
}

const selected = (host: HTMLElement) => host.querySelector("[data-selection]")?.getAttribute("data-selection") ?? null

describe("SlideCanvas groups", () => {
  it("picks a child's group on the first press and the child on the next", async () => {
    const { host } = await mounted()
    await click(frameOf(host, first))
    expect(selected(host)).toBe(group)
    await click(frameOf(host, first))
    expect(selected(host)).toBe(first)
    await click(frameOf(host, second))
    expect(selected(host)).toBe(second)
  })

  it("drags a group by any child, its children follow, and the group's box lands", async () => {
    const { host, told } = await mounted()
    const child = frameOf(host, second)
    expect(child.style.left).toBe("300px")
    await pointer(child, "pointerdown", 200, 200)
    await pointer(host.ownerDocument, "pointermove", 250, 200)
    await pointer(host.ownerDocument, "pointermove", 300, 200)
    expect(child.style.left).toBe("400px")
    await pointer(host.ownerDocument, "pointerup", 300, 200)
    expect(told.boxes).toEqual([[group, { x: 2_540_000, y: 1_524_000, cx: 3_048_000, cy: 1_524_000 }]])
  })

  it("adds to the selection with Shift, outlines each element, and groups them with Ctrl+G", async () => {
    const { host, told } = await mounted()
    await click(frameOf(host, loose))
    await click(frameOf(host, first), true)
    expect(selected(host)).toBe(group)
    expect(host.querySelector("[data-chosen]")?.getAttribute("data-chosen")).toBe(loose)
    await chord(frameOf(host, group), false)
    expect(told.grouped).toEqual([[loose, group]])
  })

  it("ungroups the selected group with Ctrl+Shift+G and groups nothing alone", async () => {
    const { host, told } = await mounted()
    await click(frameOf(host, first))
    await chord(frameOf(host, group), false)
    expect(told.grouped).toEqual([])
    await chord(frameOf(host, group), true)
    expect(told.ungrouped).toEqual([group])
  })
})
