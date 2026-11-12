import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, unshownFill, type CanvasElement, type CanvasSlide } from "./index.js"

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

const id = elementId("256.2")
const layer = 'url("blob:picture") 100% 0% / 200% 100% no-repeat'

function picture(fill: string | null): CanvasElement {
  return {
    key: id,
    id,
    kind: "picture",
    box: { x: 0, y: 0, width: 1_000_000, height: 1_000_000, rotation: 0, flipH: false, flipV: false },
    editable: false,
    placeholder: false,
    filled: false,
    fill,
    line: null,
    outline: "box",
    text: null,
  }
}

async function painted(slide: CanvasSlide): Promise<HTMLElement> {
  const store = paintStore()
  store.publish({ id, kind: "picture", text: "", picture: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide, width: 800 }))
  })
  return host
}

function styleOf(host: HTMLElement, selector: string): CSSStyleDeclaration {
  const found = host.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(`no ${selector}`)
  return found.style
}

const slide = { width: 9_144_000, height: 6_858_000, background: null }

it("paints a picture with the fill it is given", async () => {
  const host = await painted({ ...slide, elements: [picture(layer)] })
  expect(styleOf(host, `[data-canvas-element="${id}"]`).backgroundImage).toBe('url("blob:picture")')
})

it("marks a picture with no fill as the box it cannot show", async () => {
  const host = await painted({ ...slide, elements: [picture(null)] })
  expect(styleOf(host, `[data-canvas-element="${id}"]`).background).toBe(unshownFill)
})

it("paints the slide's picture background", async () => {
  const host = await painted({ ...slide, background: layer, elements: [] })
  expect(styleOf(host, "[data-slide-paint]").backgroundImage).toBe('url("blob:picture")')
})

it("says in the box what it cannot show, on the canvas and not in a thumbnail", async () => {
  const words = "EMF picture can't be shown here"
  const large = { x: 0, y: 0, width: 4_000_000, height: 2_000_000, rotation: 0, flipH: false, flipV: false }
  const unshown = { ...picture(unshownFill), box: large, unshownText: words }
  const store = paintStore()
  store.publish({ id, kind: "picture", text: "", picture: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide: { ...slide, elements: [unshown] }, width: 800 }))
  })
  expect(host.querySelector(`[data-canvas-element="${id}"]`)?.textContent).toContain(words)
  await act(async () => {
    root.render(
      createElement(SlideCanvas, { quiet: true, store, slide: { ...slide, elements: [unshown] }, width: 200 }),
    )
  })
  expect(host.querySelector(`[data-canvas-element="${id}"]`)?.textContent ?? "").not.toContain(words)
})

it("keeps the words out of a box too small to hold them", async () => {
  const small = { ...picture(unshownFill), unshownText: "WMF picture can't be shown here" }
  const box = { x: 0, y: 0, width: 400_000, height: 400_000, rotation: 0, flipH: false, flipV: false }
  const host = await painted({ ...slide, elements: [{ ...small, box }] })
  expect(host.querySelector(`[data-canvas-element="${id}"]`)?.textContent ?? "").toBe("")
})
