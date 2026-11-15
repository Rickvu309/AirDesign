import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { largeNudgeStep, nudgeStep } from "./box-gesture.js"
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
        ...(moving ? { onBox: (target: ElementId, box: Box) => boxes.push([target, box]) } : {}),
      }),
    )
  })
  return { host, store, boxes }
}

function frameOf(host: HTMLElement, named: ElementId = id): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${named}"]`)
  if (found === null) throw new Error(`no element ${named}`)
  return found
}

function surface(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>("[data-slide-paint]")
  if (found === null) throw new Error("no canvas")
  return found
}

function selection(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>("[data-selection]")
}

function grip(host: HTMLElement, name: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-grip="${name}"]`)
  if (found === null) throw new Error(`no grip ${name}`)
  return found
}

function placement(target: HTMLElement): readonly string[] {
  return [target.style.left, target.style.top, target.style.width, target.style.height]
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

async function focus(target: HTMLElement): Promise<void> {
  await act(async () => {
    target.focus()
  })
}

describe("SlideCanvas boxes", () => {
  it("paints an element at its placed box and back at the file's box once the box is forgotten", async () => {
    const { host, store } = await mounted([element(id)], "", false, false)
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
    await act(async () => {
      store.placeBox(id, { x: 914_400, y: 1_371_600, cx: 3_657_600, cy: 2_743_200 })
    })
    expect(placement(frameOf(host))).toEqual(["60px", "90px", "240px", "180px"])
    await act(async () => {
      store.placeBox(id, null)
    })
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
  })

  it("selects an element on a press and shows a frame at its box with four corner handles", async () => {
    const { host } = await mounted([element(id), element(other, { box: { ...place, y: 3_000_000 } })])
    expect(selection(host)).toBeNull()
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointerup", 100, 100)
    const frame = selection(host)
    expect(frame?.dataset.selection).toBe(id)
    expect(frame === null ? [] : placement(frame)).toEqual(["30px", "30px", "360px", "120px"])
    expect(
      [...host.querySelectorAll<HTMLElement>("[data-grip]:not([data-grip=move])")].map((each) => each.dataset.grip),
    ).toEqual(["top-left", "top-right", "bottom-left", "bottom-right"])
    expect(host.ownerDocument.activeElement).toBe(frameOf(host))
    await pointer(frameOf(host, other), "pointerdown", 100, 220)
    await pointer(host.ownerDocument, "pointerup", 100, 220)
    expect(selection(host)?.dataset.selection).toBe(other)
  })

  it("clears the selection on a press on the empty slide", async () => {
    const { host } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointerup", 100, 100)
    await pointer(surface(host), "pointerdown", 700, 400)
    expect(selection(host)).toBeNull()
  })

  it("clears the selection when focus leaves the slide", async () => {
    const { host } = await mounted([element(id)])
    const outside = host.ownerDocument.createElement("button")
    host.ownerDocument.body.append(outside)
    await focus(frameOf(host))
    expect(selection(host)?.dataset.selection).toBe(id)
    await focus(outside)
    expect(selection(host)).toBeNull()
    outside.remove()
  })

  it("leaves the text on Escape with the element still selected, and clears it on a second Escape", async () => {
    const { host } = await mounted([element(id, { editable: true })], "Hello", true)
    const text = frameOf(host).querySelector<HTMLElement>('[contenteditable="true"]')
    if (text === null) throw new Error("no text")
    await focus(text)
    expect(selection(host)?.dataset.selection).toBe(id)
    await key(text, "keydown", "Escape")
    expect(host.ownerDocument.activeElement).toBe(frameOf(host))
    expect(selection(host)?.dataset.selection).toBe(id)
    await key(frameOf(host), "keydown", "Escape")
    expect(selection(host)).toBeNull()
    expect(host.ownerDocument.activeElement).toBe(surface(host))
  })

  it("marks the text being typed in with the selection frame alone, and keeps the browser's ring when no frame shows", async () => {
    const framed = await mounted([element(id, { editable: true })], "Hello", true)
    const text = frameOf(framed.host).querySelector<HTMLElement>('[contenteditable="true"]')
    if (text === null) throw new Error("no text")
    await focus(text)
    expect(selection(framed.host)?.dataset.selection).toBe(id)
    expect(text.style.outlineColor).toBe("transparent")
    expect(frameOf(framed.host).style.outlineColor).toBe("transparent")
    const plain = await mounted([element(other, { editable: true })], "Hello", true, false)
    expect(frameOf(plain.host, other).querySelector<HTMLElement>('[contenteditable="true"]')?.style.outlineColor).toBe(
      "",
    )
  })

  it("goes back into the text on Enter", async () => {
    const { host } = await mounted([element(id, { editable: true })], "Hello", true)
    await focus(frameOf(host))
    await key(frameOf(host), "keydown", "Enter")
    expect(host.ownerDocument.activeElement).toBe(frameOf(host).querySelector('[contenteditable="true"]'))
  })

  it("starts no drag from a press in the text, so the caret and text selection keep working", async () => {
    const { host, boxes } = await mounted([element(id, { editable: true })], "Hello", true)
    const text = frameOf(host).querySelector<HTMLElement>('[contenteditable="true"]')
    if (text === null) throw new Error("no text")
    const press = new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 40,
      pointerId: 1,
      button: 0,
    })
    await act(async () => {
      text.dispatchEvent(press)
    })
    expect(press.defaultPrevented).toBe(false)
    await pointer(host.ownerDocument, "pointermove", 140, 140)
    await pointer(host.ownerDocument, "pointerup", 140, 140)
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
    expect(boxes).toEqual([])
  })

  it("paints a drag at every move and reports one box when the pointer is released", async () => {
    const { host, boxes } = await mounted([element(id)])
    const target = frameOf(host)
    await pointer(target, "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointermove", 115, 130)
    expect(placement(frameOf(host))).toEqual(["45px", "60px", "360px", "120px"])
    expect(placement(selection(host) ?? target)).toEqual(["45px", "60px", "360px", "120px"])
    expect(boxes).toEqual([])
    await pointer(host.ownerDocument, "pointermove", 130, 160)
    expect(placement(frameOf(host))).toEqual(["60px", "90px", "360px", "120px"])
    expect(boxes).toEqual([])
    await pointer(host.ownerDocument, "pointerup", 130, 160)
    expect(boxes).toEqual([[id, { ...start, x: 914_400, y: 1_371_600 }]])
    await pointer(host.ownerDocument, "pointermove", 200, 200)
    expect(placement(frameOf(host))).toEqual(["60px", "90px", "360px", "120px"])
  })

  it("reports nothing for a press that does not travel past the drag threshold", async () => {
    const { host, boxes } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointermove", 101, 101)
    await pointer(host.ownerDocument, "pointerup", 101, 101)
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
    expect(boxes).toEqual([])
  })

  it("puts the box back and reports nothing when a drag is cancelled", async () => {
    const { host, boxes } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointermove", 160, 160)
    await key(frameOf(host), "keydown", "Escape")
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
    expect(selection(host)?.dataset.selection).toBe(id)
    await pointer(host.ownerDocument, "pointerup", 160, 160)
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointermove", 160, 160)
    await pointer(host.ownerDocument, "pointercancel", 160, 160)
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
    expect(boxes).toEqual([])
  })

  it("resizes from the dragged corner and keeps the opposite corner", async () => {
    const { host, boxes } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 100, 100)
    await pointer(host.ownerDocument, "pointerup", 100, 100)
    await drag(grip(host, "bottom-right"), [390, 150], [270, 210])
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "240px", "180px"])
    await drag(grip(host, "top-left"), [30, 30], [60, 40])
    expect(placement(frameOf(host))).toEqual(["60px", "40px", "210px", "170px"])
    expect(boxes.map(([, box]) => box)).toEqual([
      { ...start, cx: 3_657_600, cy: 2_743_200 },
      { x: 914_400, y: 609_600, cx: 3_200_400, cy: 2_590_800 },
    ])
  })

  it("moves the selected element by its frame's edge band", async () => {
    const { host, boxes } = await mounted([element(id, { editable: true })], "Hello", true)
    await focus(frameOf(host))
    const band = host.querySelector<HTMLElement>("[data-grip=move]")
    if (band === null) throw new Error("no band")
    await drag(band, [100, 30], [130, 60])
    expect(boxes).toEqual([[id, { ...start, x: 914_400, y: 914_400 }]])
  })

  it("nudges with the arrows, further with Shift, and reports one box when the key is released", async () => {
    const { host, boxes, store } = await mounted([element(id)])
    await focus(frameOf(host))
    await key(frameOf(host), "keydown", "ArrowRight")
    await key(frameOf(host), "keydown", "ArrowRight")
    expect(store.getBox(id)).toEqual({ ...start, x: start.x + 2 * nudgeStep })
    expect(boxes).toEqual([])
    await key(frameOf(host), "keyup", "ArrowRight")
    expect(boxes).toEqual([[id, { ...start, x: start.x + 2 * nudgeStep }]])
    await key(frameOf(host), "keydown", "ArrowUp", true)
    await key(frameOf(host), "keyup", "ArrowUp", true)
    expect(boxes.at(-1)).toEqual([id, { ...start, x: start.x + 2 * nudgeStep, y: start.y - largeNudgeStep }])
  })

  it("leaves an arrow held with Control, Alt or Meta to the browser", async () => {
    const { host, store } = await mounted([element(id)])
    await focus(frameOf(host))
    for (const held of ["ctrlKey", "altKey", "metaKey"]) {
      const pressed = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "ArrowLeft", [held]: true })
      await act(async () => {
        frameOf(host).dispatchEvent(pressed)
      })
      expect(pressed.defaultPrevented).toBe(false)
    }
    expect(store.getBox(id)).toBeNull()
  })

  it("leaves the arrows to the caret while the text has focus", async () => {
    const { host, boxes, store } = await mounted([element(id, { editable: true })], "Hello", true)
    const text = frameOf(host).querySelector<HTMLElement>('[contenteditable="true"]')
    if (text === null) throw new Error("no text")
    await focus(text)
    await key(text, "keydown", "ArrowRight")
    await key(text, "keyup", "ArrowRight")
    expect(store.getBox(id)).toBeNull()
    expect(boxes).toEqual([])
  })

  it("sends a nudge that is still held when focus moves on", async () => {
    const { host, boxes } = await mounted([element(id), element(other, { box: { ...place, y: 3_000_000 } })])
    await focus(frameOf(host))
    await key(frameOf(host), "keydown", "ArrowDown")
    await focus(frameOf(host, other))
    expect(boxes).toEqual([[id, { ...start, y: start.y + nudgeStep }]])
  })

  it("shows a frame with no handles and does not move an element that cannot keep a box", async () => {
    const { host, boxes, store } = await mounted([element(id, { editable: true, movable: false })], "Hello", true)
    await focus(frameOf(host))
    expect(selection(host)?.dataset.selection).toBe(id)
    expect(host.querySelectorAll("[data-grip]")).toHaveLength(0)
    await drag(frameOf(host), [100, 100], [160, 160])
    await key(frameOf(host), "keydown", "ArrowRight")
    await key(frameOf(host), "keyup", "ArrowRight")
    expect(store.getBox(id)).toBeNull()
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
    expect(boxes).toEqual([])
  })

  it("moves a turned element but offers no corner to resize it", async () => {
    const { host, boxes } = await mounted([element(id, { box: { ...place, rotation: 30 } })])
    await focus(frameOf(host))
    expect(selection(host)?.style.transform).toBe("rotate(30deg)")
    expect(host.querySelectorAll("[data-grip]:not([data-grip=move])")).toHaveLength(0)
    await key(frameOf(host), "keydown", "ArrowLeft")
    await key(frameOf(host), "keyup", "ArrowLeft")
    expect(boxes).toEqual([[id, { ...start, x: start.x - nudgeStep }]])
  })

  it("names each element and puts a movable element with no text to edit in the tab order", async () => {
    const { host } = await mounted(
      [
        element(id, { editable: true }),
        element(other, { kind: "picture" }),
        element(elementId("256.4"), { kind: "connector", movable: false, filled: false }),
      ],
      "",
      true,
    )
    expect(frameOf(host).getAttribute("role")).toBe("group")
    expect(frameOf(host).getAttribute("aria-label")).toBe("Text box")
    expect(frameOf(host).tabIndex).toBe(-1)
    expect(frameOf(host, other).getAttribute("aria-label")).toBe("Image")
    expect(frameOf(host, other).tabIndex).toBe(0)
    expect([frameOf(host).style.cursor, frameOf(host, other).style.cursor]).toEqual(["", "move"])
    expect(frameOf(host, elementId("256.4")).getAttribute("aria-label")).toBe("Line")
    expect(frameOf(host, elementId("256.4")).tabIndex).toBe(-1)
    expect(frameOf(host, elementId("256.4")).style.pointerEvents).toBe("none")
  })

  it("lets the pointer through an empty unfilled outline but moves it by its stroke", async () => {
    const line = { color: "var(--line)", width: 76_200, dash: null }
    const { host, boxes } = await mounted([element(id, { editable: true, filled: false, line })], "", true)
    expect(frameOf(host).style.pointerEvents).toBe("none")
    const stroke = frameOf(host).querySelector<SVGElement>("[data-canvas-line] rect")
    if (stroke === null) throw new Error("no stroke")
    expect(stroke.style.pointerEvents.toLowerCase()).toBe("visiblestroke")
    await pointer(stroke, "pointerdown", 30, 30)
    await pointer(host.ownerDocument, "pointermove", 60, 60)
    await pointer(host.ownerDocument, "pointerup", 60, 60)
    expect(boxes).toEqual([[id, { ...start, x: 914_400, y: 914_400 }]])
  })

  it("names an element with text by its first line", async () => {
    const { host } = await mounted([element(id, { editable: true })], "  \nTitle words\nmore", true)
    expect(frameOf(host).getAttribute("aria-label")).toBe("Title words")
  })

  it("animates nothing, so reduced motion shows the same frame", async () => {
    const { host } = await mounted([element(id)])
    await focus(frameOf(host))
    const styled = [surface(host), ...surface(host).querySelectorAll<HTMLElement>("*")]
    expect(styled.filter((each) => each.style.transition !== "" || each.style.animation !== "")).toEqual([])
  })

  it("selects nothing and takes no pointer for an element it cannot edit when it reports no boxes", async () => {
    const { host } = await mounted([element(id)], "", false, false)
    expect(frameOf(host).style.pointerEvents).toBe("none")
    expect(frameOf(host).hasAttribute("tabindex")).toBe(false)
    expect(surface(host).hasAttribute("tabindex")).toBe(false)
  })
})
