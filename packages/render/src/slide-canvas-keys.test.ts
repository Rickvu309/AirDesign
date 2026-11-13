import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { nudgeStep } from "./box-gesture.js"
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
const key = `ppt/slides/slide1.xml#${id}`

const shape: CanvasElement = {
  key,
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

const added = elementId("256.9")
const box: CanvasElement = { ...shape, key: `ppt/slides/slide1.xml#${added}`, id: added }
const otherSlide: CanvasElement = { ...shape, key: `ppt/slides/slide2.xml#${added}`, id: added }

async function mounted(removed: ElementId[] = [], removes = true) {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "Quarterly results", picture: null })
  store.publish({ id: added, kind: "shape", text: "Next steps", picture: null })
  const boxes: Box[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const paint = async (elements: readonly CanvasElement[]) => {
    const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements }
    await act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide,
          width: 800,
          onBox: (_target: ElementId, box: Box) => boxes.push(box),
          onRemove: (target: ElementId) => {
            removed.push(target)
            if (removes) void paint([])
          },
        }),
      )
    })
  }
  await paint([shape])
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${key}"]`)
  if (frame === null) throw new Error("no frame")
  await act(async () => {
    frame.focus()
  })
  return { host, store, boxes, frame, paint }
}

async function press(target: HTMLElement, type: "keydown" | "keyup", name: string, modifiers: KeyboardEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: name, ...modifiers }))
  })
}

function announced(host: HTMLElement): string {
  return host.querySelector('[role="status"]')?.textContent ?? ""
}

describe("canvas keyboard", () => {
  it("tells a screen reader how to move, resize and delete a focused element that has no text to edit", async () => {
    const { frame } = await mounted()
    expect(frame.getAttribute("aria-description")).toBe(
      "Arrow keys move. Alt and Shift with the arrow keys resize. Delete removes it.",
    )
  })

  it("says Enter edits the text only on an element with text to edit, and names a shape with none a shape", async () => {
    const { host, paint } = await mounted()
    const blank = elementId("256.7")
    const empty: CanvasElement = { ...shape, key: `ppt/slides/slide1.xml#${blank}`, id: blank, fill: "var(--line)" }
    await paint([{ ...shape, editable: true }, empty])
    const frameOf = (named: string) => host.querySelector<HTMLElement>(`[data-canvas-element="${named}"]`)
    expect(frameOf(key)?.getAttribute("aria-description")).toBe(
      "Arrow keys move. Alt and Shift with the arrow keys resize. Enter edits the text. Delete removes it.",
    )
    expect(frameOf(empty.key)?.getAttribute("aria-label")).toBe("Shape")
  })

  it("gives a thin straight line a grab band wider than its stroke that paints nothing, and a filled shape none", async () => {
    const { host, paint } = await mounted()
    const line = { color: "var(--line)", width: 9_525, dash: null }
    const flat = { ...place, height: 0 }
    const connector: CanvasElement = { ...box, kind: "connector", box: flat, filled: false, line, outline: "line" }
    await paint([{ ...shape, line, fill: "var(--line)" }, connector])
    const band = host.querySelector<SVGElement>(`[data-canvas-element="${connector.key}"] [data-canvas-grab]`)
    if (band === null) throw new Error("no grab band")
    expect(band.getAttribute("stroke")).toBe("transparent")
    expect(Number(band.getAttribute("stroke-width"))).toBeGreaterThanOrEqual(8)
    expect(band.style.pointerEvents.toLowerCase()).toBe("stroke")
    expect(host.querySelector(`[data-canvas-element="${key}"] [data-canvas-grab]`)).toBeNull()
  })

  it("resizes from the keyboard with Alt and Shift and the arrows, then reports one box on release", async () => {
    const { frame, boxes, store } = await mounted()
    const keys = { altKey: true, shiftKey: true }
    await press(frame, "keydown", "ArrowRight", keys)
    await press(frame, "keydown", "ArrowDown", keys)
    expect(store.getBox(id)).toEqual({ ...start, cx: start.cx + nudgeStep, cy: start.cy + nudgeStep })
    expect(boxes).toEqual([])
    await press(frame, "keyup", "ArrowDown", keys)
    expect(boxes).toEqual([{ ...start, cx: start.cx + nudgeStep, cy: start.cy + nudgeStep }])
    await press(frame, "keydown", "ArrowLeft", keys)
    expect(store.getBox(id)?.cx).toBe(start.cx)
  })

  it("announces what a key did to the element, named by its text", async () => {
    const removed: ElementId[] = []
    const { host, frame } = await mounted(removed)
    await press(frame, "keydown", "ArrowRight")
    await press(frame, "keyup", "ArrowRight")
    expect(announced(host)).toBe("Moved Quarterly results")
    await press(frame, "keydown", "ArrowDown", { altKey: true, shiftKey: true })
    await press(frame, "keyup", "ArrowDown", { altKey: true, shiftKey: true })
    expect(announced(host)).toBe("Resized Quarterly results")
    await press(frame, "keydown", "Delete")
    expect(removed).toEqual([id])
    expect(announced(host)).toBe("Quarterly results deleted")
  })

  it("says nothing was deleted when the delete is refused and the element stays", async () => {
    const removed: ElementId[] = []
    const { host, frame } = await mounted(removed, false)
    await press(frame, "keydown", "Delete")
    expect(removed).toEqual([id])
    expect(announced(host)).toBe("")
  })

  it("announces an element added to the slide and its removal by undo, named by its text", async () => {
    const { host, paint } = await mounted()
    await paint([shape, box])
    expect(announced(host)).toBe("Next steps added")
    await paint([shape])
    expect(announced(host)).toBe("Next steps deleted")
  })

  it("announces nothing when another slide is shown", async () => {
    const { host, paint } = await mounted()
    await paint([otherSlide])
    expect(announced(host)).toBe("")
  })
})
