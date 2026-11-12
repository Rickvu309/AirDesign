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
const style = { font: "Serifa", size: 508_000, bold: false, italic: false, color: null }

const sheet: CanvasText = {
  paragraphs: [
    {
      from: 0,
      align: "left",
      runs: [{ from: 0, text: "Hello", ...style }],
      endStyle: style,
    },
  ],
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
}

function stored(text: string): string {
  return JSON.stringify([{ from: 0, runs: [{ from: 0, text }] }])
}

function shape(id: ElementId): CanvasElement {
  return {
    key: id,
    id,
    kind: "shape",
    box: { x: 0, y: 0, width: 6_096_000, height: 1_714_500, rotation: 0, flipH: false, flipV: false },
    editable: true,
    placeholder: false,
    filled: false,
    fill: null,
    line: null,
    outline: "box",
    text: sheet,
  }
}

async function paint(slide: CanvasSlide, store = paintStore()) {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide, width: 180, quiet: true }))
  })
  return host
}

describe("quiet SlideCanvas", () => {
  const id = elementId("256.2")

  it("shows the store text, follows an edit, and is not a text box", async () => {
    const store = paintStore()
    store.publish({ id, kind: "shape", text: stored("Hello"), picture: null })
    const host = await paint({ ...wide, elements: [shape(id)] }, store)
    const thumb = host.querySelector("[data-thumb-paint]")
    expect(thumb?.textContent).toContain("Hello")
    expect(host.querySelector("[data-slide-paint]")).toBeNull()
    expect(host.querySelector("[data-canvas-element]")).toBeNull()
    expect(host.querySelector("[contenteditable]")).toBeNull()
    expect(thumb?.querySelector("[tabindex]")).toBeNull()
    await act(async () => {
      store.publish({ id, kind: "shape", text: stored("Hello!"), picture: null })
    })
    expect(host.querySelector("[data-thumb-paint]")?.textContent).toContain("Hello!")
  })
})
