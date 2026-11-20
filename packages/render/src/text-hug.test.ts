import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasText } from "./index.js"
import { huggedBox } from "./text-hug.js"

const node = elementId("256.4")
const style = { font: "Arial", size: 18, points: 1_800, bold: false, italic: false, color: null }
const natural = { width: 180, height: 24 }
let across = natural.width

const typed = (fit: CanvasText["fit"], wrap: boolean, words = "Takeaway"): CanvasText => ({
  paragraphs: [{ from: 0, align: "left", runs: [{ from: 0, text: words, ...style }], endStyle: style }],
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap,
  ...(fit === undefined ? {} : { fit }),
})

const layer = (text: CanvasText): CanvasElement => ({
  key: "text",
  id: node,
  kind: "shape",
  box: { x: 100, y: 200, width: 300, height: 100, rotation: 0, flipH: false, flipV: false },
  editable: false,
  placeholder: false,
  filled: false,
  fill: null,
  line: null,
  outline: "box",
  text,
})

const browserStyle = globalThis.getComputedStyle.bind(globalThis)

const computedStyle = (element: Element): CSSStyleDeclaration => {
  if (!(element instanceof HTMLElement)) return browserStyle(element)
  if (element.dataset.textBody !== undefined) {
    const width = element.style.width === "max-content" ? across : 300
    return { height: `${String(natural.height)}px`, width: `${String(width)}px` } as CSSStyleDeclaration
  }
  if (element.querySelector(":scope > [data-text-body]") === null) return browserStyle(element)
  const { paddingTop, paddingBottom, paddingLeft, paddingRight } = element.style
  const height = element.parentElement?.style.height ?? "0px"
  return {
    height,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    boxSizing: "border-box",
  } as CSSStyleDeclaration
}

beforeAll(() => {
  vi.spyOn(globalThis, "getComputedStyle").mockImplementation(computedStyle)
})

afterAll(() => {
  vi.restoreAllMocks()
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
  across = natural.width
})

async function painted(text: CanvasText) {
  const host = document.createElement("div")
  const root = createRoot(host)
  roots.push(root)
  const fits: { readonly width?: number; readonly height: number }[] = []
  const store = paintStore()
  await act(async () =>
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { width: 1000, height: 1000, background: null, elements: [layer(text)] },
        width: 1000,
        onFit: (_: unknown, size: { readonly width?: number; readonly height: number }) => fits.push(size),
      }),
    ),
  )
  const frame = host.querySelector<HTMLElement>("[data-canvas-element]")
  return { frame, fits, placed: store.getBox(node) }
}

describe("the box a text layer hugs", () => {
  it("keeps the top left corner and takes the text's size", () => {
    const box = { x: 100, y: 200, width: 300, height: 100, rotation: 0, flipH: false, flipV: false }
    expect(huggedBox(box, { width: 180, height: 24 })).toEqual({ ...box, width: 180, height: 24 })
    expect(huggedBox(box, { width: null, height: 24 })).toEqual({ ...box, height: 24 })
  })

  it("hugs auto width text both ways, shrinking as well as growing, and stores the size it painted", async () => {
    const { frame, fits, placed } = await painted(typed({ kind: "grow" }, false))
    expect(placed).toEqual({ x: 100, y: 200, cx: 180, cy: 24 })
    expect(frame?.style.width).toBe("180px")
    expect(frame?.style.height).toBe("24px")
    expect(frame?.style.left).toBe("100px")
    expect(frame?.style.top).toBe("200px")
    expect(fits).toEqual([{ width: 180, height: 24 }])
  })

  it("keeps the width of auto height text and hugs only its height", async () => {
    const { frame, fits } = await painted(typed({ kind: "grow" }, true))
    expect(frame?.style.width).toBe("300px")
    expect(frame?.style.height).toBe("24px")
    expect(fits).toEqual([{ height: 24 }])
  })

  it("keeps an empty auto width text one line high and as wide as it is high, so it can still be grabbed", async () => {
    across = 0
    const { frame } = await painted(typed({ kind: "grow" }, false, ""))
    expect(frame?.style.width).toBe("24px")
    expect(frame?.style.height).toBe("24px")
  })

  it("leaves an imported box that fits its text as its file stores it until someone edits it", async () => {
    const { frame, fits } = await painted(typed({ kind: "grow", held: true }, false))
    expect(frame?.style.width).toBe("300px")
    expect(frame?.style.height).toBe("100px")
    expect(fits).toEqual([])
  })

  it("leaves fixed size text in its box", async () => {
    const { frame, fits, placed } = await painted(typed(undefined, true))
    expect(placed).toBeNull()
    expect(frame?.style.width).toBe("300px")
    expect(frame?.style.height).toBe("100px")
    expect(fits).toEqual([])
  })
})
