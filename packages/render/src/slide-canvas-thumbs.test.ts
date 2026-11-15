import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import {
  paintStore,
  SlideCanvas,
  type CanvasElement,
  type CanvasSlide,
  type CanvasText,
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
const style = { font: "Serifa", size: 508_000, bold: false, italic: false, color: null }
const sheet: CanvasText = {
  paragraphs: [{ from: 0, align: "left", runs: [{ from: 0, text: "Hello", ...style }], endStyle: style }],
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
}
const hello = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Hello" }] }])

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

function counted(store: PaintStore, painted: ElementId[]): PaintStore {
  return {
    ...store,
    elementSubscribe: (id) => {
      painted.push(id)
      return store.elementSubscribe(id)
    },
  }
}

function strip(store: PaintStore, slides: readonly CanvasSlide[]) {
  return createElement(
    "div",
    null,
    slides.map((slide, index) => createElement(SlideCanvas, { key: index, store, slide, width: 180, quiet: true })),
  )
}

it("paints only the thumbnail whose slide changed when the strip paints again", async () => {
  const ids = [elementId("256.2"), elementId("257.2"), elementId("258.2")]
  const inner = paintStore()
  for (const id of ids) inner.publish({ id, kind: "shape", text: hello, picture: null })
  const painted: ElementId[] = []
  const store = counted(inner, painted)
  const slides = ids.map((id): CanvasSlide => ({ ...wide, elements: [shape(id)] }))
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(strip(store, slides))
  })
  expect(painted).toEqual(ids)
  painted.length = 0
  const changed = [slides[0], { ...wide, elements: [shape(elementId("257.2"))] }, slides[2]].flatMap((slide) =>
    slide === undefined ? [] : [slide],
  )
  await act(async () => {
    root.render(strip(store, changed))
  })
  expect(painted).toEqual([elementId("257.2")])
})
