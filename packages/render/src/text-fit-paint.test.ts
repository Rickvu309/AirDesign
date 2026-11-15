import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterAll, afterEach, beforeAll, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasText } from "./index.js"

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)

const style = { font: "Arial", size: 10, points: 1_000, bold: false, italic: false, color: null }

const lines = (fit: CanvasText["fit"], anchor: CanvasText["anchor"] = "top", count = 10): CanvasText => ({
  paragraphs: Array.from({ length: count }, (_, at) => ({
    from: at,
    align: "left" as const,
    runs: [{ from: 0, text: `line ${String(at)}`, ...style }],
    endStyle: style,
  })),
  anchor,
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
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

const laidOut = (node: HTMLElement): number => {
  if (node.dataset.textBody === undefined) return 0
  return [...node.querySelectorAll<HTMLElement>("[data-paragraph] > span")].reduce(
    (sum, span) => sum + Number.parseFloat(span.style.fontSize) * Number.parseFloat(span.style.lineHeight),
    0,
  )
}

const room = (node: HTMLElement): number =>
  node.querySelector(":scope > [data-text-body]") === null
    ? 0
    : Number.parseFloat(node.parentElement?.style.height ?? "0")

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return laidOut(this)
    },
  })
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return room(this)
    },
  })
})

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight")
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight")
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
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
