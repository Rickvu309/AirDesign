import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { nudgeStep } from "./box-gesture.js"
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
  store.publish({ id, kind: "shape", text: "Quarterly results" })
  store.publish({ id: added, kind: "shape", text: "Next steps" })
  const boxes: Box[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const paint = async (elements: readonly CanvasElement[], told?: { part?: string; slideName?: string }) => {
    const slide: CanvasSlide = {
      width: 12_192_000,
      height: 6_858_000,
      background: null,
      elements,
      ...(told?.part === undefined ? {} : { part: told.part }),
    }
    await act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide,
          width: 800,
          onBoxes: (moved: readonly { id: ElementId; box: Box }[]) => boxes.push(...moved.map(({ box }) => box)),
          onRemove: (targets: readonly ElementId[]) => {
            removed.push(...targets)
            if (removes) void paint([])
          },
          ...(told?.slideName === undefined ? {} : { slideName: told.slideName }),
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

  it("says the slide when the canvas shows another slide, not that the elements left behind were deleted", async () => {
    const { host, paint } = await mounted()
    await paint([shape], { part: "ppt/slides/slide1.xml", slideName: "Slide 1 of 2" })
    await paint([], { part: "ppt/slides/slide2.xml", slideName: "Slide 2 of 2" })
    expect(announced(host)).toBe("Slide 2 of 2")
  })

  it("stacks the focused element with the PowerPoint chords and leaves a chord typed in its text alone", async () => {
    const ordered: string[] = []
    const store = paintStore()
    store.publish({ id, kind: "shape", text: "Quarterly results" })
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements: [shape] }
    const order = (_target: ElementId, move: string) => ordered.push(move)
    await act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide,
          width: 800,
          onBoxes: () => undefined,
          onOrder: order,
          notice: "Brought to front",
        }),
      )
    })
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${key}"]`)
    if (frame === null) throw new Error("no frame")
    await act(async () => {
      frame.focus()
    })
    await press(frame, "keydown", "}", { code: "BracketRight", ctrlKey: true, shiftKey: true })
    await press(frame, "keydown", "]", { code: "BracketRight", ctrlKey: true })
    await press(frame, "keydown", "[", { code: "BracketLeft", ctrlKey: true })
    await press(frame, "keydown", "{", { code: "BracketLeft", ctrlKey: true, shiftKey: true })
    await press(frame, "keydown", "]", { code: "BracketRight", metaKey: true, shiftKey: true })
    await press(frame, "keydown", "]", { code: "BracketRight", ctrlKey: true, altKey: true })
    await press(frame, "keydown", "]", { code: "BracketRight" })
    await press(frame, "keydown", "[", { code: "BracketLeft" })
    await press(frame, "keydown", "’", { code: "BracketRight", metaKey: true, altKey: true })
    await press(frame, "keydown", "“", { code: "BracketLeft", metaKey: true, altKey: true })
    expect(ordered).toEqual(["front", "forward", "backward", "back", "front", "front", "back", "front", "back"])
    expect(announced(host)).toBe("Brought to front")
    await act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: { ...slide, elements: [{ ...shape, editable: true }] },
          width: 800,
          onBoxes: () => undefined,
          onEdit: () => undefined,
          onOrder: order,
        }),
      )
    })
    const text = host.querySelector<HTMLElement>("[contenteditable='true']")
    if (text === null) throw new Error("no text")
    await press(text, "keydown", "}", { code: "BracketRight", ctrlKey: true, shiftKey: true })
    await press(text, "keydown", "]", { code: "BracketRight" })
    await press(text, "keydown", "[", { code: "BracketLeft" })
    expect(ordered).toEqual(["front", "forward", "backward", "back", "front", "front", "back", "front", "back"])
  })

  it("wraps the selection in a plain frame on Ctrl+Alt+G or Cmd+Option+G and leaves text editing alone", async () => {
    const framed: (readonly ElementId[])[] = []
    const store = paintStore()
    store.publish({ id, kind: "shape", text: "Quarterly results" })
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    const slide: CanvasSlide = { width: 12_192_000, height: 6_858_000, background: null, elements: [shape] }
    await act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide,
          width: 800,
          onBoxes: () => undefined,
          onPlainFrame: (ids: readonly ElementId[]) => framed.push(ids),
        }),
      )
    })
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${key}"]`)
    if (frame === null) throw new Error("no frame")
    await act(async () => {
      frame.focus()
    })
    await press(frame, "keydown", "g", { code: "KeyG", ctrlKey: true, altKey: true })
    await press(frame, "keydown", "©", { code: "KeyG", metaKey: true, altKey: true })
    expect(framed).toEqual([[id], [id]])
    await act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: { ...slide, elements: [{ ...shape, editable: true }] },
          width: 800,
          onBoxes: () => undefined,
          onEdit: () => undefined,
          onPlainFrame: (ids: readonly ElementId[]) => framed.push(ids),
        }),
      )
    })
    const text = host.querySelector<HTMLElement>("[contenteditable='true']")
    if (text === null) throw new Error("no text")
    await press(text, "keydown", "g", { code: "KeyG", ctrlKey: true, altKey: true })
    expect(framed).toEqual([[id], [id]])
  })
})
