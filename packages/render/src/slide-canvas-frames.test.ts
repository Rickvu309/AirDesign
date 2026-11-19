import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type PaintBox } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

const frames = new Map<number, FrameRequestCallback>()
let handles = 0

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
    handles += 1
    frames.set(handles, run)
    return handles
  })
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    frames.delete(handle)
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  frames.clear()
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const place: PaintBox = {
  x: 457_200,
  y: 457_200,
  width: 5_486_400,
  height: 1_828_800,
  rotation: 0,
  flipH: false,
  flipV: false,
}
const id = elementId("256.2")
const emuPerPixel = 15_240

const shape: CanvasElement = {
  key: `ppt/slides/slide1.xml#${id}`,
  id,
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
}

async function mounted() {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "" })
  const moved: [ElementId, Box][] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { width: 12_192_000, height: 6_858_000, background: null, elements: [shape] },
        width: 800,
        onBoxes: (boxes: readonly { id: ElementId; box: Box }[]) => {
          moved.push(...boxes.map(({ id: each, box }): [ElementId, Box] => [each, box]))
        },
      }),
    )
  })
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${shape.key}"]`)
  if (frame === null) throw new Error("no element")
  const heard: Box[] = []
  store.boxSubscribe(id)(() => {
    const box = store.getBox(id)
    if (box !== null) heard.push(box)
  })
  return { frame, moved, heard }
}

async function pointer(target: EventTarget, type: string, x: number, y: number): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 }),
    )
  })
}

async function nextFrame(): Promise<void> {
  await act(async () => {
    const due = [...frames.values()]
    frames.clear()
    for (const run of due) run(0)
  })
}

const shifted = (pixels: number) => ({
  x: place.x + pixels * emuPerPixel,
  y: place.y,
  cx: place.width,
  cy: place.height,
})

describe("SlideCanvas drag frames", () => {
  it("paints a drag once per frame, at the latest pointer place", async () => {
    const { frame, heard } = await mounted()
    await pointer(frame, "pointerdown", 100, 100)
    await pointer(document, "pointermove", 120, 100)
    await pointer(document, "pointermove", 130, 100)
    await pointer(document, "pointermove", 150, 100)
    expect(heard).toEqual([])
    expect(frame.style.left).toBe("30px")
    await nextFrame()
    expect(heard).toEqual([shifted(50)])
    expect(frame.style.left).toBe("80px")
    await pointer(document, "pointerup", 150, 100)
  })

  it("lands the last move on release before its frame comes", async () => {
    const { frame, moved } = await mounted()
    await pointer(frame, "pointerdown", 100, 100)
    await pointer(document, "pointermove", 140, 100)
    await pointer(document, "pointermove", 160, 100)
    await pointer(document, "pointerup", 160, 100)
    expect(moved).toEqual([[id, shifted(60)]])
    expect(frame.style.left).toBe("90px")
    await nextFrame()
    expect(frame.style.left).toBe("90px")
  })

  it("drops a waiting move when the pointer is lost", async () => {
    const { frame, moved, heard } = await mounted()
    await pointer(frame, "pointerdown", 100, 100)
    await pointer(document, "pointermove", 160, 100)
    await pointer(document, "pointercancel", 160, 100)
    expect(frames.size).toBe(0)
    await nextFrame()
    expect(heard).toEqual([])
    expect(moved).toEqual([])
    expect(frame.style.left).toBe("30px")
  })
})
