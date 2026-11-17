import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import {
  paintStore,
  SlideCanvas,
  type CanvasElement,
  type CanvasSlide,
  type PaintBox,
  type PaintStore,
} from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const wide = { width: 12_192_000, height: 6_858_000, background: null }
const place: PaintBox = {
  x: 457_200,
  y: 457_200,
  width: 5_486_400,
  height: 1_828_800,
  rotation: 0,
  flipH: false,
  flipV: false,
}
const start: Box = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const id = elementId("256.2")
const other = elementId("256.3")

function element(named: ElementId, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${named}`,
    id: named,
    kind: "shape",
    box: place,
    editable: false,
    movable: true,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...overrides,
  }
}

type Mounted = {
  readonly host: HTMLDivElement
  readonly store: PaintStore
  readonly boxes: [ElementId, Box][]
  readonly calls: (readonly [ElementId, Box][])[]
}

async function mounted(
  elements: readonly CanvasElement[],
  text = "",
  editing = false,
  moving = true,
): Promise<Mounted> {
  const store = paintStore()
  for (const each of elements) {
    if (each.id !== null)
      store.publish({ id: each.id, kind: each.kind, text, picture: each.kind === "picture" ? "" : null })
  }
  const boxes: [ElementId, Box][] = []
  const calls: (readonly [ElementId, Box][])[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide: CanvasSlide = { ...wide, elements }
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide,
        width: 800,
        ...(editing ? { onEdit: () => undefined } : {}),
        ...(moving
          ? {
              onBoxes: (moved: readonly { id: ElementId; box: Box }[]) => {
                const told = moved.map(({ id, box }): [ElementId, Box] => [id, box])
                calls.push(told)
                boxes.push(...told)
              },
            }
          : {}),
      }),
    )
  })
  return { host, store, boxes, calls }
}

function frameOf(host: HTMLElement, named: ElementId = id): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${named}"]`)
  if (found === null) throw new Error(`no element ${named}`)
  return found
}

function selection(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>("[data-selection]")
}

async function pointer(target: EventTarget, type: string, x: number, y: number, pointerId = 1): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId, button: 0 }),
    )
  })
}

async function drag(
  target: HTMLElement,
  from: readonly [number, number],
  to: readonly [number, number],
): Promise<void> {
  await pointer(target, "pointerdown", ...from)
  await pointer(target.ownerDocument, "pointermove", from[0] + (to[0] - from[0]) / 2, from[1] + (to[1] - from[1]) / 2)
  await pointer(target.ownerDocument, "pointermove", ...to)
  await pointer(target.ownerDocument, "pointerup", ...to)
}

async function key(target: HTMLElement, type: "keydown" | "keyup", name: string, shiftKey = false): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: name, shiftKey }))
  })
}

async function add(target: HTMLElement): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
        button: 0,
        metaKey: true,
      }),
    )
  })
}

describe("several selected elements", () => {
  const third = elementId("256.4")
  const three = () => [
    element(id),
    element(other, { box: { ...place, y: 2_743_200 } }),
    element(third, { box: { ...place, x: 6_400_800, y: 4_572_000 } }),
  ]
  const moved = (box: Box): Box => ({ ...box, x: box.x + 457_200, y: box.y + 228_600 })

  it("drags all three when one of them is dragged, and tells the three boxes at once", async () => {
    const { host, calls } = await mounted(three())
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointerup", 100, 100)
    await add(frameOf(host, other))
    await add(frameOf(host, third))
    expect(host.querySelectorAll("[data-chosen]")).toHaveLength(3)
    expect(host.querySelector("[data-selection-around]")?.getAttribute("data-selection-around")).toBe("3")
    await drag(frameOf(host, other), [100, 200], [130, 215])
    expect(calls).toEqual([
      [
        [other, moved({ ...start, y: 2_743_200 })],
        [id, moved(start)],
        [third, moved({ ...start, x: 6_400_800, y: 4_572_000 })],
      ],
    ])
  })

  it("nudges all three with one arrow press and keeps them selected", async () => {
    const { host, calls } = await mounted(three())
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointerup", 100, 100)
    await add(frameOf(host, other))
    await add(frameOf(host, third))
    await key(frameOf(host, third), "keydown", "ArrowRight", true)
    await key(frameOf(host, third), "keyup", "ArrowRight", true)
    expect(calls.map((call) => call.map(([node, box]) => [node, box.x]))).toEqual([
      [
        [third, 6_400_800 + 127_000],
        [id, start.x + 127_000],
        [other, start.x + 127_000],
      ],
    ])
    expect(host.querySelectorAll("[data-chosen]")).toHaveLength(3)
  })

  it("selects only the pressed one on a click that does not move", async () => {
    const { host, calls } = await mounted(three())
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointerup", 100, 100)
    await add(frameOf(host, other))
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointerup", 100, 100)
    expect(calls).toEqual([])
    expect(host.querySelectorAll("[data-chosen]")).toHaveLength(0)
    expect(selection(host)?.dataset.selection).toBe(id)
  })
})
