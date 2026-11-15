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

function thumbAt(host: HTMLElement, id: ElementId): readonly string[] {
  const frame = host.querySelector<HTMLElement>(`[data-thumb-element="${id}"]`)
  if (frame === null) throw new Error("no thumbnail element")
  return [frame.style.left, frame.style.top, frame.style.width, frame.style.height]
}

async function thumbnail(elements: readonly CanvasElement[]) {
  const store = paintStore()
  for (const each of elements) {
    if (each.id !== null) store.publish({ id: each.id, kind: "shape", text: hello, picture: null })
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide: { ...wide, elements }, width: 1_200, quiet: true }))
  })
  return { host, store }
}

const upright = { rotation: 0, flipH: false, flipV: false }
const pixel = (emu: number) => `${String((emu * 1_200) / wide.width)}px`

it("moves a thumbnail's element when its box moves in the store", async () => {
  const id = elementId("256.2")
  const { host, store } = await thumbnail([shape(id)])
  expect(thumbAt(host, id)).toEqual([pixel(0), pixel(0), pixel(6_096_000), pixel(1_714_500)])
  await act(async () => {
    store.placeBox(id, { x: 1_016_000, y: 2_032_000, cx: 6_096_000, cy: 1_714_500 })
  })
  expect(thumbAt(host, id)).toEqual([pixel(1_016_000), pixel(2_032_000), pixel(6_096_000), pixel(1_714_500)])
  await act(async () => {
    store.placeBox(id, null)
  })
  expect(thumbAt(host, id)).toEqual([pixel(0), pixel(0), pixel(6_096_000), pixel(1_714_500)])
})

it("carries a grouped element in the thumbnail when its group moves", async () => {
  const group = elementId("256.9")
  const child = elementId("256.3")
  const groupBox = { x: 0, y: 0, width: 6_096_000, height: 1_714_500, ...upright }
  const { host, store } = await thumbnail([{ ...shape(child), group: { id: group, box: groupBox } }])
  await act(async () => {
    store.placeBox(group, { x: 1_016_000, y: 508_000, cx: 6_096_000, cy: 1_714_500 })
  })
  expect(thumbAt(host, child)).toEqual([pixel(1_016_000), pixel(508_000), pixel(6_096_000), pixel(1_714_500)])
})

it("bends a thumbnail's connector to follow a shape it is bound to", async () => {
  const left = elementId("256.4")
  const right = elementId("256.5")
  const line = elementId("256.6")
  const square = (id: ElementId, x: number): CanvasElement => ({
    ...shape(id),
    text: null,
    box: { x, y: 1_016_000, width: 1_016_000, height: 1_016_000, ...upright },
    geometry: { preset: "rect", adjusts: {} },
  })
  const connector: CanvasElement = {
    ...shape(line),
    kind: "connector",
    text: null,
    box: { x: 1_016_000, y: 1_524_000, width: 3_048_000, height: 0, ...upright },
    geometry: { preset: "line", adjusts: {} },
    connection: { start: { node: left, site: 3 }, end: { node: right, site: 1 } },
  }
  const { host, store } = await thumbnail([square(left, 0), square(right, 4_064_000), connector])
  expect(thumbAt(host, line)).toEqual([pixel(1_016_000), pixel(1_524_000), pixel(3_048_000), pixel(0)])
  await act(async () => {
    store.placeBox(right, { x: 5_080_000, y: 1_016_000, cx: 1_016_000, cy: 1_016_000 })
  })
  expect(thumbAt(host, line)).toEqual([pixel(1_016_000), pixel(1_524_000), pixel(4_064_000), pixel(0)])
})
