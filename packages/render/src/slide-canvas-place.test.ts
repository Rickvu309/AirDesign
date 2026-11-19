import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide, type PaintBox } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const perPixel = 15_240
const wide = { width: 12_192_000, height: 6_858_000, background: null }
const still = elementId("256.2")
const moving = elementId("256.3")

function pixels(x: number, y: number, width: number, height: number): PaintBox {
  return {
    x: x * perPixel,
    y: y * perPixel,
    width: width * perPixel,
    height: height * perPixel,
    rotation: 0,
    flipH: false,
    flipV: false,
  }
}

function element(named: ElementId, box: PaintBox): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${named}`,
    id: named,
    kind: "shape",
    box,
    editable: false,
    movable: true,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
  }
}

async function mounted(): Promise<{ host: HTMLDivElement; boxes: [ElementId, Box][] }> {
  const elements = [element(still, pixels(30, 30, 360, 120)), element(moving, pixels(450, 300, 120, 60))]
  const store = paintStore()
  for (const each of elements) if (each.id !== null) store.publish({ id: each.id, kind: "shape", text: "" })
  const boxes: [ElementId, Box][] = []
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
        onBoxes: (moved: readonly { id: ElementId; box: Box }[]) => {
          boxes.push(...moved.map(({ id, box }): [ElementId, Box] => [id, box]))
        },
      }),
    )
  })
  return { host, boxes }
}

function found(host: HTMLElement, selector: string): HTMLElement {
  const target = host.querySelector<HTMLElement>(selector)
  if (target === null) throw new Error(`nothing at ${selector}`)
  return target
}

const movingFrame = `[data-canvas-element="ppt/slides/slide1.xml#${moving}"]`
const stillFrame = `[data-canvas-element="ppt/slides/slide1.xml#${still}"]`

type Held = { readonly ctrlKey?: boolean; readonly altKey?: boolean }

async function pointer(target: EventTarget, type: string, x: number, y: number, held: Held = {}): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        ...held,
      }),
    )
    if (type === "pointermove") await new Promise((painted) => requestAnimationFrame(painted))
  })
}

function guideLines(host: HTMLElement): readonly string[] {
  return [...host.querySelectorAll("[data-guides] [data-guide]")].map((line) => line.getAttribute("data-guide") ?? "")
}

describe("SlideCanvas snapping", () => {
  it("snaps a dragged layer's edge onto a nearby layer, shows the guide while held, and saves the snapped box", async () => {
    const { host, boxes } = await mounted()
    await pointer(found(host, movingFrame), "pointerdown", 500, 330)
    await pointer(host.ownerDocument, "pointermove", 470, 330)
    await pointer(host.ownerDocument, "pointermove", 443, 330)
    expect(found(host, movingFrame).style.left).toBe("390px")
    expect(guideLines(host)).toEqual(["snap x 390"])
    await pointer(host.ownerDocument, "pointerup", 443, 330)
    expect(guideLines(host)).toEqual([])
    expect(host.querySelector("[data-guides]")).toBeNull()
    expect(boxes).toEqual([[moving, { x: 390 * perPixel, y: 300 * perPixel, cx: 120 * perPixel, cy: 60 * perPixel }]])
  })

  it("drags with no snapping and no guides while Control is held", async () => {
    const { host, boxes } = await mounted()
    await pointer(found(host, movingFrame), "pointerdown", 500, 330)
    await pointer(host.ownerDocument, "pointermove", 470, 330, { ctrlKey: true })
    await pointer(host.ownerDocument, "pointermove", 443, 330, { ctrlKey: true })
    expect(found(host, movingFrame).style.left).toBe("393px")
    expect(host.querySelector("[data-guides]")).toBeNull()
    await pointer(host.ownerDocument, "pointerup", 443, 330, { ctrlKey: true })
    expect(boxes).toEqual([[moving, { x: 393 * perPixel, y: 300 * perPixel, cx: 120 * perPixel, cy: 60 * perPixel }]])
  })

  it("snaps the edge a corner handle pulls onto the slide's middle", async () => {
    const { host, boxes } = await mounted()
    await pointer(found(host, movingFrame), "pointerdown", 500, 330)
    await pointer(host.ownerDocument, "pointerup", 500, 330)
    await pointer(found(host, '[data-grip="top-left"]'), "pointerdown", 450, 300)
    await pointer(host.ownerDocument, "pointermove", 450, 260)
    await pointer(host.ownerDocument, "pointermove", 450, 228)
    expect(guideLines(host)).toEqual(["snap y 225"])
    await pointer(host.ownerDocument, "pointerup", 450, 228)
    expect(boxes).toEqual([[moving, { x: 450 * perPixel, y: 225 * perPixel, cx: 120 * perPixel, cy: 135 * perPixel }]])
  })
})

async function alt(target: EventTarget, type: "keydown" | "keyup"): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent(type, { bubbles: true, cancelable: true, key: "Alt", altKey: type === "keydown" }),
    )
  })
}

function labels(host: HTMLElement): readonly string[] {
  return [...host.querySelectorAll("[data-guides] [data-distance]")].map((label) => label.textContent ?? "")
}

describe("SlideCanvas measuring", () => {
  it("shows the distances to the layer under the pointer while Alt is held, and to the slide's edges off any layer", async () => {
    const { host } = await mounted()
    await pointer(found(host, movingFrame), "pointerdown", 500, 330)
    await pointer(host.ownerDocument, "pointerup", 500, 330)
    await alt(found(host, movingFrame), "keydown")
    await pointer(found(host, stillFrame), "pointermove", 200, 90, { altKey: true })
    expect(guideLines(host)).toEqual([
      "outline 30 30 390 150",
      "distance x 390 450",
      "extension y 390",
      "distance y 150 300",
      "extension x 150",
    ])
    expect(labels(host)).toEqual(["72", "180"])
    await pointer(found(host, "[data-slide-paint]"), "pointermove", 700, 420, { altKey: true })
    expect(guideLines(host)).toEqual([
      "outline 0 0 800 450",
      "distance x 0 450",
      "distance x 570 800",
      "distance y 0 300",
      "distance y 360 450",
    ])
    await alt(found(host, movingFrame), "keyup")
    expect(host.querySelector("[data-guides]")).toBeNull()
  })

  it("measures nothing with no layer selected", async () => {
    const { host } = await mounted()
    await alt(host.ownerDocument.body, "keydown")
    await pointer(found(host, stillFrame), "pointermove", 200, 90, { altKey: true })
    expect(host.querySelector("[data-guides]")).toBeNull()
  })
})
