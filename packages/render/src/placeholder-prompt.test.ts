import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide, type CanvasText } from "./index.js"

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

const wide = { width: 12_192_000, height: 6_858_000, background: null }
const style = { font: "Arial", size: 508_000, bold: false, italic: false, color: null }

const emptySheet: CanvasText = {
  paragraphs: [
    {
      from: 0,
      align: "center",
      runs: [],
      endStyle: style,
    },
  ],
  anchor: "middle",
  insets: { left: 91440, top: 45720, right: 91440, bottom: 45720 },
  wrap: true,
}

function stored(text: string): string {
  return JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }])
}

function placeholderShape(id: ElementId, prompt: string): CanvasElement {
  return {
    key: id,
    id,
    kind: "shape",
    box: { x: 0, y: 0, width: 6_096_000, height: 1_714_500, rotation: 0, flipH: false, flipV: false },
    editable: true,
    placeholder: true,
    prompt,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: emptySheet,
  }
}

async function mount(slide: CanvasSlide, store = paintStore(), quiet = false) {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide, width: 800, quiet, onEdit: () => {} }))
  })
  return host
}

describe("placeholder prompt in SlideCanvas", () => {
  const id = elementId("256.2")

  it("empty placeholder paints prompt and quiet outline", async () => {
    const store = paintStore()
    const host = await mount({ ...wide, elements: [placeholderShape(id, "Add a subtitle")] }, store, false)
    const prompt = host.querySelector<HTMLElement>("[data-placeholder-prompt]")
    expect(prompt).not.toBeNull()
    expect(prompt?.textContent).toBe("Add a subtitle")
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)
    expect(frame?.style.outline).toContain("dashed")
    const input = host.querySelector<HTMLElement>('[contenteditable="true"]')
    expect(input?.getAttribute("aria-placeholder")).toBe("Add a subtitle")
  })

  it("placeholder with text does not paint prompt or quiet outline", async () => {
    const store = paintStore()
    store.publish({ id, kind: "shape", text: stored("My subtitle"), picture: null })
    const host = await mount({ ...wide, elements: [placeholderShape(id, "Add a subtitle")] }, store, false)
    expect(host.querySelector("[data-placeholder-prompt]")).toBeNull()
    const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)
    expect(frame?.style.outline).not.toContain("dashed")
  })

  it("quiet mode does not paint prompt or quiet outline", async () => {
    const store = paintStore()
    const host = await mount({ ...wide, elements: [placeholderShape(id, "Add a subtitle")] }, store, true)
    expect(host.querySelector("[data-placeholder-prompt]")).toBeNull()
    const frame = host.querySelector<HTMLElement>("[data-canvas-element]")
    expect(frame).toBeNull()
  })
})
