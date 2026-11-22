import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, unshownFill, type CanvasElement, type CanvasSlide } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.6")
const flat = { rotation: 0, flipH: false, flipV: false }

const chevron: CanvasElement = {
  key: `${id}/0`,
  id: null,
  kind: "shape",
  box: { x: 2381, y: 2_110_140, width: 2_901_156, height: 1_160_462, ...flat },
  editable: false,
  placeholder: false,
  filled: true,
  fill: "rgb(21, 96, 130)",
  line: { color: "rgb(255, 255, 255)", width: 12_700, dash: null },
  outline: "box",
  geometry: { preset: "chevron", adjusts: {} },
  text: null,
}

const style = { font: "Aptos", size: 56, bold: false, italic: false, color: "rgb(255, 255, 255)" }

const words: CanvasElement = {
  ...chevron,
  key: `${id}/0.text`,
  box: { x: 582_612, y: 2_110_140, width: 1_740_694, height: 1_160_462, ...flat },
  filled: false,
  fill: null,
  line: null,
  geometry: { preset: "rect", adjusts: {} },
  text: {
    paragraphs: [{ from: 0, align: "center", runs: [{ ...style, from: 0, text: "2023" }], endStyle: style }],
    anchor: "middle",
    insets: { left: 224_028, top: 74_676, right: 74_676, bottom: 74_676 },
    wrap: true,
  },
}

function frame(diagram: readonly CanvasElement[] | undefined): CanvasElement {
  return {
    key: id,
    id,
    kind: "kept",
    box: { x: 410_967, y: 731_521, width: 8_128_000, height: 5_380_744, ...flat },
    editable: false,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...(diagram === undefined ? {} : { diagram }),
  }
}

const slide = { width: 9_144_000, height: 6_858_000, background: null }

async function painted(elements: readonly CanvasElement[], quiet = false): Promise<HTMLElement> {
  const store = paintStore()
  store.publish({ id, kind: "kept", text: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const canvas: CanvasSlide = { ...slide, elements }
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide: canvas, width: 800, quiet }))
  })
  return host
}

it("paints a diagram's shapes and words inside its frame instead of the box it cannot show", async () => {
  const host = await painted([frame([chevron, words])])
  const held = host.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)
  expect(held?.style.background).not.toBe(unshownFill)
  expect(held?.querySelectorAll("[data-diagram-shape]")).toHaveLength(2)
  expect(held?.querySelector("[data-canvas-path] path")).not.toBeNull()
  expect(held?.textContent).toContain("2023")
  const placed = held?.querySelector<HTMLElement>(`[data-diagram-shape="${id}/0.text"]`)
  expect(Number.parseFloat(placed?.style.left ?? "")).toBeCloseTo((582_612 / 9_144_000) * 800, 3)
})

it("offers nothing to edit or pick inside a diagram", async () => {
  const host = await painted([frame([chevron, words])])
  const held = host.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)
  expect(held?.querySelector('[contenteditable="true"]')).toBeNull()
  expect(host.querySelectorAll("[data-canvas-element]")).toHaveLength(1)
  for (const shape of held?.querySelectorAll<HTMLElement>("[data-diagram-shape]") ?? []) {
    expect(shape.style.pointerEvents).toBe("none")
  }
})

it("paints the diagram in a thumbnail", async () => {
  const host = await painted([frame([chevron, words])], true)
  expect(host.querySelectorAll("[data-thumb-paint] [data-diagram-shape]")).toHaveLength(2)
  expect(host.querySelector("[data-thumb-paint]")?.textContent).toContain("2023")
})

it("draws no empty placeholder outline around a diagram that fills its placeholder", async () => {
  const host = await painted([{ ...frame([chevron, words]), placeholder: true }])
  expect(host.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)?.style.outline).toBe("")
})

it("draws no bullet on an empty diagram paragraph, as PowerPoint does", async () => {
  const text = words.text
  if (text === null) throw new Error("text")
  const empty = { ...text.paragraphs[0]!, runs: [], bullet: { char: "•", font: null, color: null, size: null } }
  const host = await painted([frame([{ ...words, text: { ...text, paragraphs: [empty] } }])])
  const paragraph = host.querySelector<HTMLElement>("[data-diagram-shape] [data-paragraph]")
  expect(paragraph?.style.getPropertyValue("--bullet")).toBe("none")
})
