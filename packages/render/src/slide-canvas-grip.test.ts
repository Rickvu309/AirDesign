import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { nudgeStep } from "./box-gesture.js"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.2")
const start: Box = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const element: CanvasElement = {
  key: `ppt/slides/slide1.xml#${id}`,
  id,
  kind: "shape",
  box: { x: start.x, y: start.y, width: start.cx, height: start.cy, rotation: 0, flipH: false, flipV: false },
  editable: false,
  movable: true,
  placeholder: false,
  filled: true,
  fill: null,
  line: null,
  outline: "box",
  text: null,
}

async function mounted() {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "" })
  const boxes: [ElementId, Box][] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { width: 12_192_000, height: 6_858_000, background: null, elements: [element] },
        width: 800,
        onBoxes: (moved: readonly { id: ElementId; box: Box }[]) =>
          boxes.push(...moved.map(({ id, box }): [ElementId, Box] => [id, box])),
      }),
    )
  })
  const frame = () => {
    const found = host.querySelector<HTMLElement>(`[data-canvas-element="${element.key}"]`)
    if (found === null) throw new Error("no element")
    return found
  }
  const placement = () => [frame().style.left, frame().style.top, frame().style.width, frame().style.height]
  return { root, store, boxes, frame, placement }
}

async function pointer(target: EventTarget, type: string, x: number, y: number): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
    )
  })
}

async function key(target: HTMLElement, type: "keydown" | "keyup", name: string): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: name }))
  })
}

describe("SlideCanvas gestures under a repaint", () => {
  it("keeps a drag that a repaint lands under before the pointer is released, then reports it", async () => {
    const { store, boxes, frame, placement } = await mounted()
    await pointer(frame(), "pointerdown", 100, 100)
    await pointer(document, "pointermove", 130, 160)
    await act(async () => store.placeBox(id, null))
    expect(placement()).toEqual(["60px", "90px", "360px", "120px"])
    await pointer(document, "pointerup", 130, 160)
    expect(boxes).toEqual([[id, { ...start, x: 914_400, y: 1_371_600 }]])
    expect(placement()).toEqual(["60px", "90px", "360px", "120px"])
  })

  it("lands a repaint made during a press that never travelled, or a cancelled drag, once the gesture ends", async () => {
    const { store, boxes, frame, placement } = await mounted()
    await pointer(frame(), "pointerdown", 100, 100)
    await act(async () => store.placeBox(id, { ...start, x: 914_400 }))
    expect(placement()).toEqual(["30px", "30px", "360px", "120px"])
    await pointer(document, "pointerup", 100, 100)
    expect(placement()).toEqual(["60px", "30px", "360px", "120px"])
    await pointer(frame(), "pointerdown", 100, 100)
    await pointer(document, "pointermove", 160, 160)
    await act(async () => store.placeBox(id, start))
    await pointer(document, "pointercancel", 160, 160)
    expect(placement()).toEqual(["30px", "30px", "360px", "120px"])
    expect(boxes).toEqual([])
  })

  it("keeps a nudge that a repaint lands under before the key is released, then reports it", async () => {
    const { store, boxes, frame } = await mounted()
    await act(async () => frame().focus())
    await key(frame(), "keydown", "ArrowRight")
    await act(async () => store.placeBox(id, null))
    expect(store.getBox(id)).toEqual({ ...start, x: start.x + nudgeStep })
    await key(frame(), "keydown", "ArrowRight")
    await key(frame(), "keyup", "ArrowRight")
    expect(boxes).toEqual([[id, { ...start, x: start.x + 2 * nudgeStep }]])
  })

  it("lets a repaint land again once the canvas is gone in the middle of a nudge", async () => {
    const { root, store, frame } = await mounted()
    await act(async () => frame().focus())
    await key(frame(), "keydown", "ArrowRight")
    await act(async () => root.unmount())
    store.placeBox(id, null)
    expect(store.getBox(id)).toBeNull()
  })
})
