import { elementId, type Box, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import {
  paintStore,
  SlideCanvas,
  type CanvasElement,
  type CanvasSlide,
  type Copied,
  type Moved,
  type PaintBox,
  type Selection,
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
const copy = elementId("256.9")
const again = elementId("256.10")

function element(named: ElementId, box: PaintBox = place): CanvasElement {
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

function painted(box: Box): PaintBox {
  return { ...place, x: box.x, y: box.y, width: box.cx, height: box.cy }
}

type Canvas = {
  readonly host: HTMLDivElement
  readonly asked: Moved[][]
  readonly moved: Moved[][]
  readonly answer: (made: readonly Copied[], elements: readonly CanvasElement[]) => Promise<void>
}

async function canvas(): Promise<Canvas> {
  const store = paintStore()
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const asked: Moved[][] = []
  const moved: Moved[][] = []
  let answered: (made: readonly Copied[]) => void = () => undefined
  let chosen: Selection = { ids: [], inside: null }
  let shown: readonly CanvasElement[] = []
  function render(elements: readonly CanvasElement[]) {
    shown = elements
    for (const each of elements) if (each.id !== null) store.publish({ id: each.id, kind: "shape", text: "" })
    const slide: CanvasSlide = { ...wide, elements }
    root.render(
      createElement(SlideCanvas, {
        store,
        slide,
        width: 800,
        selection: chosen,
        onSelection: (next: Selection) => {
          chosen = next
          render(shown)
        },
        onBoxes: (boxes: readonly Moved[]) => {
          moved.push([...boxes])
        },
        onDuplicate: (copies: readonly Moved[]) => {
          asked.push([...copies])
          return new Promise<readonly Copied[]>((resolve) => {
            answered = resolve
          })
        },
      }),
    )
  }
  await act(async () => {
    render([element(id)])
  })
  async function answer(made: readonly Copied[], elements: readonly CanvasElement[]) {
    await act(async () => {
      answered(made)
      await Promise.resolve()
      render(elements)
    })
  }
  return { host, asked, moved, answer }
}

function frameOf(host: HTMLElement, named: ElementId = id): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="ppt/slides/slide1.xml#${named}"]`)
  if (found === null) throw new Error(`no element ${named}`)
  return found
}

function original(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>("[data-copied-layer] [data-thumb-element]")
}

function placement(target: HTMLElement | null): readonly string[] {
  return target === null ? [] : [target.style.left, target.style.top, target.style.width, target.style.height]
}

async function pointer(target: EventTarget, type: string, x: number, y: number, altKey = false): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
        button: 0,
        altKey,
      }),
    )
    if (type === "pointermove") await new Promise((painted) => requestAnimationFrame(painted))
  })
}

async function duplicateKey(target: HTMLElement): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "d", code: "KeyD", ctrlKey: true })
  await act(async () => {
    target.dispatchEvent(event)
  })
  return event
}

describe("SlideCanvas copies", () => {
  it("leaves the layer in place while Alt drags a copy, and selects the copy once it paints", async () => {
    const { host, asked, moved, answer } = await canvas()
    await pointer(frameOf(host), "pointerdown", 100, 100, true)
    await pointer(host.ownerDocument, "pointermove", 115, 130, true)
    await pointer(host.ownerDocument, "pointermove", 130, 160, true)
    expect(placement(frameOf(host))).toEqual(["60px", "90px", "360px", "120px"])
    expect(placement(original(host))).toEqual(["30px", "30px", "360px", "120px"])
    await pointer(host.ownerDocument, "pointerup", 130, 160, true)
    const box = { ...start, x: 914_400, y: 1_371_600 }
    expect(asked).toEqual([[{ id, box }]])
    expect(moved).toEqual([])
    expect(placement(original(host))).toEqual(["30px", "30px", "360px", "120px"])
    await answer([{ copy, source: id }], [element(id), element(copy, painted(box))])
    expect(original(host)).toBeNull()
    expect(placement(frameOf(host))).toEqual(["30px", "30px", "360px", "120px"])
    expect(placement(frameOf(host, copy))).toEqual(["60px", "90px", "360px", "120px"])
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(copy)
  })

  it("outlines no layer under a pointer that rests on the copy it just dropped", async () => {
    const { host, answer } = await canvas()
    const topmost = (named: ElementId) => host.querySelector(`[data-canvas-element="ppt/slides/slide1.xml#${named}"]`)
    Object.defineProperty(host.ownerDocument, "elementFromPoint", {
      value: () => topmost(copy) ?? topmost(id),
      configurable: true,
    })
    await pointer(frameOf(host), "pointermove", 100, 100)
    await pointer(frameOf(host), "pointerdown", 100, 100, true)
    await pointer(host.ownerDocument, "pointermove", 130, 160, true)
    await pointer(host.ownerDocument, "pointerup", 130, 160, true)
    const box = { ...start, x: 914_400, y: 1_371_600 }
    await answer([{ copy, source: id }], [element(id), element(copy, painted(box))])
    Reflect.deleteProperty(host.ownerDocument, "elementFromPoint")
    expect(host.querySelector<HTMLElement>("[data-hover-outline]")?.hidden).toBe(true)
  })

  it("moves the layer itself when Alt is let go before the drag ends", async () => {
    const { host, asked, moved } = await canvas()
    await pointer(frameOf(host), "pointerdown", 100, 100, true)
    await pointer(host.ownerDocument, "pointermove", 115, 130, true)
    expect(original(host)).not.toBeNull()
    await pointer(host.ownerDocument, "pointermove", 130, 160, false)
    expect(original(host)).toBeNull()
    await pointer(host.ownerDocument, "pointerup", 130, 160, false)
    expect(asked).toEqual([])
    expect(moved).toEqual([[{ id, box: { ...start, x: 914_400, y: 1_371_600 } }]])
  })

  it("waits with a Ctrl+D pressed while a dragged copy lands, then copies that copy the same distance on", async () => {
    const { host, asked, answer } = await canvas()
    await pointer(frameOf(host), "pointerdown", 100, 100, true)
    await pointer(host.ownerDocument, "pointermove", 130, 160, true)
    await pointer(host.ownerDocument, "pointerup", 130, 160, true)
    await duplicateKey(frameOf(host))
    const box = { ...start, x: 914_400, y: 1_371_600 }
    expect(asked).toEqual([[{ id, box }]])
    await answer([{ copy, source: id }], [element(id), element(copy, painted(box))])
    expect(asked[1]).toEqual([{ id: copy, box: { ...box, x: 1_371_600, y: 2_286_000 } }])
  })

  it("copies the selection in place on Ctrl+D, then repeats the distance a dragged copy went", async () => {
    const { host, asked, answer } = await canvas()
    const pressed = await duplicateKey(frameOf(host))
    expect(pressed.defaultPrevented).toBe(true)
    expect(asked).toEqual([[{ id, box: start }]])
    await answer([{ copy, source: id }], [element(id), element(copy)])
    expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(copy)
    await pointer(frameOf(host, copy), "pointerdown", 100, 100, true)
    await pointer(host.ownerDocument, "pointermove", 130, 160, true)
    await pointer(host.ownerDocument, "pointerup", 130, 160, true)
    const box = { ...start, x: 914_400, y: 1_371_600 }
    expect(asked[1]).toEqual([{ id: copy, box }])
    await answer([{ copy: again, source: copy }], [element(id), element(copy), element(again, painted(box))])
    await duplicateKey(frameOf(host, again))
    expect(asked[2]).toEqual([{ id: again, box: { ...box, x: 1_371_600, y: 2_286_000 } }])
  })
})
