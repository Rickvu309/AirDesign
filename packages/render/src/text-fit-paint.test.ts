import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasText } from "./index.js"

const style = { font: "Arial", size: 10, points: 1_000, bold: false, italic: false, color: null }

const lines = (fit: CanvasText["fit"], anchor: CanvasText["anchor"] = "top", count = 10, columns = 1): CanvasText => ({
  paragraphs: Array.from({ length: count }, (_, at) => ({
    from: at,
    align: "left" as const,
    runs: [{ from: 0, text: `line ${String(at)}`, ...style }],
    endStyle: style,
  })),
  anchor,
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
  ...(columns === 1 ? {} : { columns }),
  ...(fit === undefined ? {} : { fit }),
})

const box = (text: CanvasText, height: number): CanvasElement => ({
  key: "box",
  id: null,
  kind: "shape",
  box: { x: 100, y: 200, width: 300, height, rotation: 0, flipH: false, flipV: false },
  editable: false,
  placeholder: false,
  filled: true,
  fill: "white",
  line: null,
  outline: "box",
  text,
})

let fontWidth = 1

const columnWidth = 100

const stacked = (node: HTMLElement): number =>
  fontWidth *
  [...node.querySelectorAll<HTMLElement>("[data-paragraph] > span")].reduce(
    (sum, span) => sum + Number.parseFloat(span.style.fontSize) * Number.parseFloat(span.style.lineHeight),
    0,
  )

const columnsOf = (node: HTMLElement): number => Number(node.style.columnCount) || 1

const room = (node: HTMLElement): number =>
  node.querySelector(":scope > [data-text-body]") === null
    ? 0
    : Number.parseFloat(node.parentElement?.style.height ?? "0")

const held = (node: HTMLElement): number =>
  node.style.maxBlockSize === "100%" && node.parentElement !== null ? room(node.parentElement) : Infinity

const laidOut = (node: HTMLElement): number => {
  if (node.dataset.textBody === undefined) return 0
  const columns = columnsOf(node)
  if (columns === 1) return stacked(node)
  if (node.style.columnFill === "balance") return stacked(node) / columns
  return Math.min(stacked(node), held(node))
}

const across = (node: HTMLElement): number => {
  if (node.dataset.textBody === undefined) return 0
  const columns = columnsOf(node)
  const filled = Number.isFinite(held(node)) ? Math.ceil(stacked(node) / held(node)) : columns
  return Math.max(columns, filled) * columnWidth
}

let wholePixels = false

const padding = (layer: HTMLElement): number =>
  Number.parseFloat(layer.style.paddingTop || "0") + Number.parseFloat(layer.style.paddingBottom || "0")

const used = (node: HTMLElement): number => {
  const layer = node.parentElement
  if (layer === null || columnsOf(node) > 1) return laidOut(node)
  return Math.max(laidOut(node), room(layer) - padding(layer))
}

const browserStyle = globalThis.getComputedStyle.bind(globalThis)

const computedStyle = (element: Element): CSSStyleDeclaration => {
  if (!(element instanceof HTMLElement)) return browserStyle(element)
  if (element.dataset.textBody !== undefined) return { height: `${String(used(element))}px` } as CSSStyleDeclaration
  if (element.querySelector(":scope > [data-text-body]") === null) return browserStyle(element)
  const { paddingTop, paddingBottom } = element.style
  return {
    height: `${String(room(element))}px`,
    boxSizing: "border-box",
    paddingTop,
    paddingBottom,
  } as CSSStyleDeclaration
}

beforeAll(() => {
  vi.spyOn(globalThis, "getComputedStyle").mockImplementation(computedStyle)
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return wholePixels ? Math.round(used(this)) : laidOut(this)
    },
  })
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return wholePixels ? Math.round(room(this)) : room(this)
    },
  })
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return across(this)
    },
  })
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.textBody === undefined ? 0 : columnsOf(this) * columnWidth
    },
  })
})

afterAll(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight")
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight")
  Reflect.deleteProperty(HTMLElement.prototype, "scrollWidth")
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth")
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
  fontWidth = 1
  wholePixels = false
  Reflect.deleteProperty(document, "fonts")
})

async function painted(text: CanvasText, height = 100) {
  const host = document.createElement("div")
  const root = createRoot(host)
  roots.push(root)
  await act(async () =>
    root.render(
      createElement(SlideCanvas, {
        store: paintStore(),
        slide: { width: 1000, height: 1000, background: null, elements: [box(text, height)] },
        width: 1000,
        quiet: true,
      }),
    ),
  )
  return host
}

const firstRun = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-paragraph] > span")
const frame = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-thumb-element]")
const body = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-text-body]")

it("narrows the lines before it makes text that overflows its box smaller, as PowerPoint does", async () => {
  const host = await painted(lines({ kind: "shrink", scale: 1, reduction: 0 }))
  expect(firstRun(host)?.style.fontSize).toBe("10px")
  expect(firstRun(host)?.style.lineHeight).toBe("0.96")
})

it("makes the text smaller in PowerPoint's steps once narrower lines are not enough", async () => {
  const host = await painted(lines({ kind: "shrink", scale: 1, reduction: 0 }), 61)
  expect(firstRun(host)?.style.fontSize).toBe("6.25px")
  expect(firstRun(host)?.style.lineHeight).toBe("0.96")
})

it("leaves text that fits at the scale its file stores", async () => {
  const host = await painted(lines({ kind: "shrink", scale: 0.5, reduction: 0 }, "top", 8))
  expect(firstRun(host)?.style.fontSize).toBe("10px")
  expect(firstRun(host)?.style.lineHeight).toBe("1.2")
})

it("leaves text that fits at its size though the browser reports the box and the text in whole pixels", async () => {
  wholePixels = true
  const insets = { left: 8.84, top: 4.42, right: 8.84, bottom: 4.42 }
  const host = await painted({ ...lines({ kind: "shrink", scale: 1, reduction: 0 }, "top", 5), insets }, 100.383)
  expect(firstRun(host)?.style.fontSize).toBe("10px")
  expect(firstRun(host)?.style.lineHeight).toBe("1.2")
})

it("leaves text with no autofit to overflow its box", async () => {
  const host = await painted(lines(undefined))
  expect(firstRun(host)?.style.fontSize).toBe("10px")
  expect(frame(host)?.style.height).toBe("100px")
})

it("grows a box to fit its text from the edge its text holds to", async () => {
  const top = await painted(lines({ kind: "grow" }, "top"))
  expect(frame(top)?.style.height).toBe("120px")
  expect(frame(top)?.style.top).toBe("200px")
  const middle = await painted(lines({ kind: "grow" }, "middle"))
  expect(frame(middle)?.style.top).toBe("190px")
  const bottom = await painted(lines({ kind: "grow" }, "bottom"))
  expect(frame(bottom)?.style.top).toBe("180px")
})

it("fits its text again once a font that was still loading arrives", async () => {
  const fonts = new EventTarget()
  Object.defineProperty(document, "fonts", { configurable: true, value: fonts })
  fontWidth = 1.3
  const host = await painted(lines({ kind: "shrink", scale: 1, reduction: 0 }))
  expect(firstRun(host)?.style.fontSize).not.toBe("10px")
  fontWidth = 1
  await act(async () => fonts.dispatchEvent(new Event("loadingdone")))
  expect(firstRun(host)?.style.fontSize).toBe("10px")
  expect(firstRun(host)?.style.lineHeight).toBe("0.96")
})

it("paints exactly its columns and runs text they cannot hold down below the box, as PowerPoint does", async () => {
  const host = await painted(lines(undefined, "middle", 30, 2))
  expect(body(host)?.style.columnCount).toBe("2")
  expect(body(host)?.scrollWidth).toBe(body(host)?.clientWidth)
  expect(body(host)?.offsetHeight).toBe(180)
  expect(frame(host)?.style.height).toBe("100px")
})

it("fills the first column to the box's height before the next while its columns hold the text", async () => {
  const host = await painted(lines(undefined, "middle", 15, 2))
  expect(body(host)?.style).toMatchObject({ maxBlockSize: "100%", columnFill: "auto" })
  expect(body(host)?.offsetHeight).toBe(100)
})

it("makes text in columns smaller until its columns hold it", async () => {
  const host = await painted(lines({ kind: "shrink", scale: 1, reduction: 0 }, "top", 30, 2))
  expect(firstRun(host)?.style.fontSize).toBe("6.25px")
  expect(firstRun(host)?.style.lineHeight).toBe("0.96")
  expect(body(host)?.scrollWidth).toBe(body(host)?.clientWidth)
})

it("grows a box with columns until its columns hold the text", async () => {
  const host = await painted(lines({ kind: "grow" }, "top", 30, 2))
  expect(frame(host)?.style.height).toBe("180px")
  expect(body(host)?.scrollWidth).toBe(body(host)?.clientWidth)
})
