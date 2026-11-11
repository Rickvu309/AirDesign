import { elementId, type ElementId } from "@airdesign/document"
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

const wide = { width: 12_192_000, height: 6_858_000 }
const place: PaintBox = {
  x: 1_219_200,
  y: 685_800,
  width: 6_096_000,
  height: 1_714_500,
  rotation: 0,
  flipH: false,
  flipV: false,
}

function written(id: ElementId, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return { key: id, id, kind: "shape", box: place, editable: false, ...overrides }
}

async function canvas(
  slide: CanvasSlide,
  width = 800,
  text = "words",
  onEdit?: (id: ElementId, value: string) => void,
) {
  const store = paintStore()
  for (const element of slide.elements) {
    if (element.id !== null)
      store.publish({ id: element.id, kind: element.kind, text, picture: element.kind === "picture" ? "" : null })
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide, width, ...(onEdit === undefined ? {} : { onEdit }) }))
  })
  return host
}

function placed(host: HTMLElement, key: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(`[data-canvas-element="${key}"]`)
  if (found === null) throw new Error(`no element ${key}`)
  return found
}

function surface(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>("[data-slide-paint]")
  if (found === null) throw new Error("no canvas")
  return found
}

describe("SlideCanvas", () => {
  const id = elementId("256.2")

  it("sizes the canvas to the given width at the deck's aspect ratio", async () => {
    const host = await canvas({ width: 9_144_000, height: 6_858_000, elements: [] })
    expect(surface(host).style.width).toBe("800px")
    expect(surface(host).style.height).toBe("600px")
  })

  it("places an element by its box scaled on both axes by width over slide width", async () => {
    const host = await canvas({ ...wide, elements: [written(id)] }, 640)
    const element = placed(host, id)
    expect(element.style.position).toBe("absolute")
    expect(element.style.left).toBe("64px")
    expect(element.style.top).toBe("36px")
    expect(element.style.width).toBe("320px")
    expect(element.style.height).toBe("90px")
  })

  it("keeps a tall slide's vertical positions on the width scale", async () => {
    const host = await canvas({ width: 6_858_000, height: 12_192_000, elements: [written(id)] }, 343)
    expect(Number.parseFloat(surface(host).style.height)).toBeCloseTo(609.778, 2)
    expect(Number.parseFloat(placed(host, id).style.top)).toBeCloseTo(34.3, 2)
    expect(Number.parseFloat(placed(host, id).style.left)).toBeCloseTo(60.978, 2)
  })

  it("scales the default text size with the canvas", async () => {
    const full = await canvas({ ...wide, elements: [] }, 800)
    const half = await canvas({ ...wide, elements: [] }, 400)
    expect(Number.parseFloat(full.querySelector<HTMLElement>("[data-slide-paint]")?.style.fontSize ?? "")).toBeCloseTo(
      13.333,
      2,
    )
    expect(Number.parseFloat(half.querySelector<HTMLElement>("[data-slide-paint]")?.style.fontSize ?? "")).toBeCloseTo(
      6.667,
      2,
    )
  })

  it("turns an element by its rotation and flips", async () => {
    const box = { ...place, rotation: 90, flipH: true }
    const host = await canvas({ ...wide, elements: [written(id, { box })] })
    expect(placed(host, id).style.transform).toBe("rotate(90deg) scale(-1, 1)")
  })

  it("leaves an unturned element without a transform", async () => {
    const host = await canvas({ ...wide, elements: [written(id)] })
    expect(placed(host, id).style.transform).toBe("")
  })

  it.each([
    [true, false, "scaleX(-1)"],
    [false, true, "scaleX(-1)"],
    [true, true, ""],
    [false, false, ""],
  ])("keeps text readable when flipH is %s and flipV is %s", async (flipH, flipV, undo) => {
    const host = await canvas({ ...wide, elements: [written(id, { box: { ...place, flipH, flipV } })] })
    const text = placed(host, id).firstElementChild
    if (!(text instanceof HTMLElement)) throw new Error("no text layer")
    expect(text.style.transform).toBe(undo)
  })

  it("paints elements in the order given", async () => {
    const first = elementId("256.3")
    const host = await canvas({ ...wide, elements: [written(id), written(first)] })
    const painted = [...surface(host).querySelectorAll<HTMLElement>("[data-canvas-element]")]
    expect(painted.map((each) => each.dataset.canvasElement)).toEqual([id, first])
  })

  it("makes only an editable element take the pointer and the caret", async () => {
    const other = elementId("256.3")
    const host = await canvas(
      { ...wide, elements: [written(id, { editable: true }), written(other)] },
      800,
      "words",
      () => undefined,
    )
    expect(placed(host, id).style.pointerEvents).toBe("auto")
    expect(placed(host, id).querySelector('[contenteditable="true"]')).not.toBeNull()
    expect(placed(host, other).style.pointerEvents).toBe("none")
    expect(placed(host, other).querySelector('[contenteditable="true"]')).toBeNull()
  })

  it("reports an edit against the element that was typed in", async () => {
    const edits: string[] = []
    const host = await canvas(
      { ...wide, elements: [written(id, { editable: true })] },
      800,
      "words",
      (target, value) => {
        edits.push(`${target} ${value}`)
      },
    )
    const box = placed(host, id).querySelector<HTMLElement>('[contenteditable="true"]')
    if (box === null) throw new Error("no box")
    box.querySelector("[data-run]")?.append("!")
    await act(async () => {
      box.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(edits).toHaveLength(1)
    expect(edits[0]).toContain(id)
    expect(edits[0]).toContain("words!")
  })

  it("paints a sheet element with no document id as an empty box", async () => {
    const host = await canvas({
      ...wide,
      elements: [{ key: "ppt/slideLayouts/slideLayout1.xml#7", id: null, kind: "shape", box: place, editable: false }],
    })
    const element = placed(host, "ppt/slideLayouts/slideLayout1.xml#7")
    expect(element.style.width).toBe("400px")
    expect(element.childElementCount).toBe(0)
  })

  it("marks a picture and a chart it cannot show yet as an empty box", async () => {
    const chart = elementId("256.3")
    const shape = elementId("256.4")
    const host = await canvas({
      ...wide,
      elements: [written(id, { kind: "picture" }), written(chart, { kind: "chart" }), written(shape)],
    })
    expect(placed(host, id).style.background).not.toBe("")
    expect(placed(host, chart).style.background).not.toBe("")
    expect(placed(host, shape).style.background).toBe("")
  })

  it("keeps an element with no box on the canvas in the flow of the slide", async () => {
    const host = await canvas({ ...wide, elements: [written(id, { box: null })] })
    expect(placed(host, id).style.position).toBe("")
    expect(placed(host, id).textContent).toBe("words")
  })

  it("carries the class it is given onto the slide", async () => {
    const store = paintStore()
    const host = document.createElement("div")
    document.body.append(host)
    const root = createRoot(host)
    hosts.push({ host, root })
    await act(async () => {
      root.render(
        createElement(SlideCanvas, { store, slide: { ...wide, elements: [] }, width: 800, className: "framed" }),
      )
    })
    expect(surface(host).className).toBe("framed")
  })
})
