import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import {
  paintStore,
  SlideCanvas,
  type CanvasElement,
  type FlippedLayer,
  type PaintBox,
  type PaintStore,
  type Turned,
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
  x: 1_524_000,
  y: 1_524_000,
  width: 3_048_000,
  height: 1_524_000,
  rotation: 0,
  flipH: false,
  flipV: false,
}
const start: Box = { x: 1_524_000, y: 1_524_000, cx: 3_048_000, cy: 1_524_000 }
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
  readonly boxes: (readonly [ElementId, Box][])[]
  readonly turns: (readonly Turned[])[]
  readonly flips: (readonly FlippedLayer[])[]
  readonly repaint: (elements: readonly CanvasElement[]) => Promise<void>
}

async function mounted(
  elements: readonly CanvasElement[],
  editing = false,
  onRelayout?: (boxes: ReadonlyMap<ElementId, Box>) => ReadonlyMap<ElementId, Box> | null,
): Promise<Mounted> {
  const store = paintStore()
  for (const each of elements) {
    if (each.id !== null)
      store.publish({ id: each.id, kind: each.kind === "picture" ? "shape" : each.kind, text: "Hi" })
  }
  const boxes: (readonly [ElementId, Box][])[] = []
  const turns: (readonly Turned[])[] = []
  const flips: (readonly FlippedLayer[])[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const paint = (shown: readonly CanvasElement[]) =>
    act(async () => {
      root.render(
        createElement(SlideCanvas, {
          store,
          slide: { ...wide, elements: shown },
          width: 800,
          ...(editing ? { onEdit: () => undefined } : {}),
          onBoxes: (moved) => boxes.push(moved.map((each) => [each.id, each.box])),
          onRotate: (turned) => turns.push(turned),
          onFlip: (flipped) => flips.push(flipped),
          ...(onRelayout === undefined ? {} : { onRelayout }),
        }),
      )
    })
  await paint(elements)
  return { host, store, boxes, turns, flips, repaint: paint }
}

function frameOf(host: HTMLElement, named: ElementId = id): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${named}"]`)
  if (found === null) throw new Error(`no element ${named}`)
  return found
}

function grip(host: HTMLElement, name: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-grip="${name}"]`)
  if (found === null) throw new Error(`no grip ${name}`)
  return found
}

async function pointer(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  options: { readonly shiftKey?: boolean; readonly altKey?: boolean; readonly metaKey?: boolean } = {},
): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        ...options,
      }),
    )
    if (type === "pointermove") await new Promise((painted) => requestAnimationFrame(painted))
  })
}

async function keyEvent(
  target: EventTarget,
  type: "keydown" | "keyup",
  init: { readonly key: string; readonly code?: string; readonly shiftKey?: boolean; readonly altKey?: boolean },
): Promise<void> {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }))
    await new Promise((painted) => requestAnimationFrame(painted))
  })
}

describe("SlideCanvas transform gestures", () => {
  it("resizes from an edge handle, shows the W × H HUD pill, and commits one box edit", async () => {
    const { host, boxes } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointerup", 150, 150)
    await pointer(grip(host, "right"), "pointerdown", 300, 150)
    await pointer(host.ownerDocument, "pointermove", 350, 220)
    expect(host.querySelector("[data-transform-hud='resize']")?.textContent).toBe("300 × 120")
    await pointer(host.ownerDocument, "pointerup", 350, 220)
    expect(host.querySelector("[data-transform-hud]")).toBeNull()
    expect(boxes).toEqual([[[id, { ...start, cx: start.cx + 762_000 }]]])
  })

  it("lays the frame's live layout while a side handle resizes, and asks for none while a layer moves", async () => {
    const sibling = elementId("256.9")
    const asked: ReadonlyMap<ElementId, Box>[] = []
    const relayout = (boxes: ReadonlyMap<ElementId, Box>) => {
      asked.push(boxes)
      return new Map([[sibling, { x: 1, y: 2, cx: 3, cy: 4 }]])
    }
    const { host, store } = await mounted([element(id)], false, relayout)
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointermove", 180, 150)
    await pointer(host.ownerDocument, "pointerup", 180, 150)
    expect(asked).toEqual([])
    await pointer(grip(host, "right"), "pointerdown", 330, 150)
    await pointer(host.ownerDocument, "pointermove", 380, 150)
    expect(asked.length).toBeGreaterThan(0)
    expect(store.getLaid(sibling)).toEqual({ x: 1, y: 2, cx: 3, cy: 4 })
    await keyEvent(frameOf(host), "keydown", { key: "Escape" })
    expect(store.laidNow()).toBeNull()
  })

  it("lays the frame out again when the slide repaints mid-drag, so a text layer's new height moves the next layer", async () => {
    const asked: number[] = []
    let height = 4
    const relayout = () => {
      asked.push(height)
      return new Map([[elementId("256.9"), { x: 1, y: 2, cx: 3, cy: height }]])
    }
    const { host, store, repaint } = await mounted([element(id)], false, relayout)
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointerup", 150, 150)
    await pointer(grip(host, "right"), "pointerdown", 300, 150)
    await pointer(host.ownerDocument, "pointermove", 350, 150)
    height = 9
    await repaint([element(id)])
    expect(asked.at(-1)).toBe(9)
    expect(store.getLaid(elementId("256.9"))).toMatchObject({ cy: 9 })
    await pointer(host.ownerDocument, "pointerup", 350, 150)
  })

  it("shows the size the live layout gives the dragged frame in the resize pill", async () => {
    const relayout = (boxes: ReadonlyMap<ElementId, Box>) => {
      const dragged = boxes.get(id)
      return dragged === undefined ? null : new Map([[id, { ...dragged, cy: dragged.cy + 381_000 }]])
    }
    const { host } = await mounted([element(id)], false, relayout)
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointerup", 150, 150)
    await pointer(grip(host, "right"), "pointerdown", 300, 150)
    await pointer(host.ownerDocument, "pointermove", 350, 150)
    expect(host.querySelector("[data-transform-hud='resize']")?.textContent).toBe("300 × 150")
    await pointer(host.ownerDocument, "pointerup", 350, 150)
  })

  it("updates Shift and Alt modifiers dynamically mid-drag during resize", async () => {
    const { host, boxes } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointerup", 150, 150)
    await pointer(grip(host, "bottom-right"), "pointerdown", 300, 200)
    await pointer(host.ownerDocument, "pointermove", 350, 200)
    expect(host.querySelector("[data-transform-hud='resize']")?.textContent).toBe("300 × 120")
    await keyEvent(host.ownerDocument, "keydown", { key: "Shift", shiftKey: true })
    expect(host.querySelector("[data-transform-hud='resize']")?.textContent).toBe("300 × 150")
    await keyEvent(host.ownerDocument, "keydown", { key: "Alt", shiftKey: true, altKey: true })
    expect(host.querySelector("[data-transform-hud='resize']")?.textContent).toBe("360 × 180")
    await pointer(host.ownerDocument, "pointerup", 350, 200, { shiftKey: true, altKey: true })
    expect(boxes).toEqual([
      [
        [
          id,
          {
            x: start.x - 762_000,
            y: start.y - 381_000,
            cx: start.cx + 1_524_000,
            cy: start.cy + 762_000,
          },
        ],
      ],
    ])
  })

  it("locks move drag to the dominant axis when Shift is held, even when pressed before pointerdown, while Shift+click still toggles off", async () => {
    const { host, boxes } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointerup", 150, 150)
    await pointer(frameOf(host), "pointerdown", 150, 150, { shiftKey: true })
    await pointer(host.ownerDocument, "pointermove", 210, 170, { shiftKey: true })
    await pointer(host.ownerDocument, "pointerup", 210, 170, { shiftKey: true })
    expect(boxes).toEqual([[[id, { ...start, x: start.x + 914_400, y: start.y }]]])
    expect(host.querySelector("[data-selection]")).not.toBeNull()

    await pointer(frameOf(host), "pointerdown", 210, 150, { shiftKey: true })
    await pointer(host.ownerDocument, "pointerup", 210, 150, { shiftKey: true })
    expect(host.querySelector("[data-selection]")).toBeNull()
  })

  it("rotates from a corner rotate handle with live angle HUD, Shift 15-degree snap, and Escape cancel", async () => {
    const { host, turns } = await mounted([element(id)])
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointerup", 150, 150)
    const handle = grip(host, "rotate-top-right")
    await pointer(handle, "pointerdown", 300, 150)
    await pointer(host.ownerDocument, "pointermove", 200, 250)
    expect(host.querySelector("[data-transform-hud='rotate']")?.textContent).toBe("90°")
    expect(frameOf(host).style.transform).toBe("rotate(90deg)")
    await keyEvent(frameOf(host), "keydown", { key: "Escape" })
    expect(frameOf(host).style.transform).toBe("")
    expect(host.querySelector("[data-transform-hud]")).toBeNull()
    expect(turns).toEqual([])
    await pointer(host.ownerDocument, "pointerup", 200, 250)

    await pointer(handle, "pointerdown", 300, 150)
    await pointer(host.ownerDocument, "pointermove", 294, 170, { shiftKey: true })
    expect(host.querySelector("[data-transform-hud='rotate']")?.textContent).toBe("15°")
    await pointer(host.ownerDocument, "pointerup", 294, 170, { shiftKey: true })
    expect(turns).toEqual([[{ id, rotation: 15 }]])
  })

  it("resizes and rotates a two-layer multi-selection together", async () => {
    const secondBox: PaintBox = { ...place, x: 4_572_000, y: 3_048_000 }
    const { host, boxes, turns } = await mounted([element(id), element(other, { box: secondBox })])
    await pointer(frameOf(host), "pointerdown", 150, 150)
    await pointer(host.ownerDocument, "pointerup", 150, 150)
    await pointer(frameOf(host, other), "pointerdown", 350, 250, { shiftKey: true })

    await pointer(grip(host, "bottom-right"), "pointerdown", 500, 300)
    await pointer(host.ownerDocument, "pointermove", 700, 400)
    expect(host.querySelector("[data-transform-hud='resize']")?.textContent).toBe("720 × 360")
    await pointer(host.ownerDocument, "pointerup", 700, 400)
    expect(boxes).toHaveLength(1)
    expect(new Map(boxes[0])).toEqual(
      new Map([
        [id, { x: 1_524_000, y: 1_524_000, cx: 4_572_000, cy: 2_286_000 }],
        [other, { x: 6_096_000, y: 3_810_000, cx: 4_572_000, cy: 2_286_000 }],
      ]),
    )

    const around = host.querySelector("[data-selection-around]")
    expect(around?.getAttribute("data-selection-around")).toBe("2")
    const rotHandle = grip(host, "rotate-top-right")
    await pointer(rotHandle, "pointerdown", 600, 250)
    await pointer(host.ownerDocument, "pointermove", 400, 450, { shiftKey: true })
    await pointer(host.ownerDocument, "pointerup", 400, 450, { shiftKey: true })
    expect(turns).toHaveLength(1)
    expect(new Set(turns[0]?.map((each) => each.id))).toEqual(new Set([id, other]))
    expect(turns[0]?.every((each) => each.rotation === 90 && each.box !== undefined)).toBe(true)
  })

  it("flips single and multi-selections with Shift+H and Shift+V and ignores them in text", async () => {
    const { host, flips } = await mounted([element(id, { editable: true })], true)
    await act(async () => {
      frameOf(host).focus()
    })
    await keyEvent(frameOf(host), "keydown", { key: "H", code: "KeyH", shiftKey: true })
    await keyEvent(frameOf(host), "keydown", { key: "V", code: "KeyV", shiftKey: true })
    expect(flips).toEqual([[{ id, flipH: true }], [{ id, flipV: true }]])

    const text = frameOf(host).querySelector<HTMLElement>('[contenteditable="true"]')
    if (text === null) throw new Error("no text")
    await keyEvent(text, "keydown", { key: "H", code: "KeyH", shiftKey: true })
    expect(flips).toHaveLength(2)
  })
})
