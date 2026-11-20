import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

const hosts: { host: HTMLElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.2")
const box = { x: 457_200, y: 457_200, width: 5_486_400, height: 1_828_800, rotation: 0, flipH: false, flipV: false }

const text: CanvasElement = {
  key: `ppt/slides/slide1.xml#${id}`,
  id,
  kind: "shape",
  box,
  editable: true,
  movable: true,
  placeholder: false,
  filled: false,
  fill: null,
  line: null,
  outline: "box",
  text: null,
}

function slideWith(elements: readonly CanvasElement[]) {
  return { width: 12_192_000, height: 6_858_000, background: null, elements }
}

async function mounted(left: ElementId[]): Promise<HTMLElement> {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "" })
  const host = document.createElement("div")
  const panel = document.createElement("input")
  panel.dataset.keepsSelection = ""
  document.body.append(host, panel)
  const root = createRoot(host)
  hosts.push({ host, root }, { host: panel, root: createRoot(document.createElement("div")) })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: slideWith([text]),
        width: 800,
        onEdit: () => undefined,
        onBoxes: () => undefined,
        onLeaveText: (each: ElementId) => left.push(each),
      }),
    )
  })
  return host
}

it("reports a text left when focus goes from its words to the slide, not to a panel that keeps the selection", async () => {
  const left: ElementId[] = []
  const host = await mounted(left)
  const body = host.querySelector<HTMLElement>("[data-text-body]")
  const slide = host.querySelector<HTMLElement>("[data-slide-paint]")
  const panel = document.querySelector<HTMLInputElement>("input[data-keeps-selection]")
  if (body === null || slide === null || panel === null) throw new Error("not painted")
  await act(async () => body.focus())
  await act(async () => panel.focus())
  expect(left).toEqual([])
  await act(async () => body.focus())
  await act(async () => slide.focus())
  expect(left).toEqual([id])
})

it("keeps focus on the slide when the layer that held it is taken away, so one-key tools still work", async () => {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const props = { store, width: 800, onEdit: () => undefined, onBoxes: () => undefined }
  await act(async () => root.render(createElement(SlideCanvas, { ...props, slide: slideWith([text]) })))
  const frame = host.querySelector<HTMLElement>("[data-canvas-element]")
  if (frame === null) throw new Error("not painted")
  await act(async () => frame.focus())
  await act(async () => {
    frame.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }))
    root.render(createElement(SlideCanvas, { ...props, slide: slideWith([]) }))
  })
  expect(document.activeElement).toBe(host.querySelector("[data-slide-paint]"))
})

it("enters text asked for again under the id of a text that was taken away", async () => {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const props = { store, width: 800, onEdit: () => undefined, onBoxes: () => undefined }
  const shown = (elements: readonly CanvasElement[], entering: { readonly id: ElementId } | null) =>
    act(async () => root.render(createElement(SlideCanvas, { ...props, slide: slideWith(elements), entering })))
  await shown([text], { id })
  expect(document.activeElement?.closest("[data-text-body]")).not.toBeNull()
  await shown([], null)
  expect(document.activeElement?.closest("[data-text-body]") ?? null).toBeNull()
  await shown([{ ...text }], { id })
  expect(document.activeElement?.closest("[data-text-body]")).not.toBeNull()
})

it("leaves focus and the selection alone when a focused layer goes and another stays selected", async () => {
  const other = elementId("256.3")
  const second: CanvasElement = { ...text, key: `ppt/slides/slide1.xml#${other}`, id: other }
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "" })
  store.publish({ id: other, kind: "shape", text: "" })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const chosen: ElementId[][] = []
  const props = {
    store,
    width: 800,
    onEdit: () => undefined,
    onBoxes: () => undefined,
    onSelection: (next: { readonly ids: readonly ElementId[] }) => chosen.push([...next.ids]),
  }
  const both = { ids: [id, other], inside: null }
  await act(async () =>
    root.render(createElement(SlideCanvas, { ...props, slide: slideWith([text, second]), selection: both })),
  )
  const frame = host.querySelector<HTMLElement>(`[data-canvas-element="${second.key}"]`)
  if (frame === null) throw new Error("not painted")
  await act(async () => frame.focus())
  chosen.length = 0
  await act(async () => {
    root.render(
      createElement(SlideCanvas, { ...props, slide: slideWith([text]), selection: { ids: [id], inside: null } }),
    )
  })
  expect(chosen.every((ids) => ids.length > 0)).toBe(true)
  expect(document.activeElement).not.toBe(host.querySelector("[data-slide-paint]"))
})
