import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { leadOf, paintStore, SlideCanvas, type CanvasElement, type Selection } from "./index.js"

const hosts: { host: HTMLElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => mounted.root.unmount())
    mounted.host.remove()
  }
})

const id = elementId("256.2")
const element: CanvasElement = {
  key: `ppt/slides/slide1.xml#${id}`,
  id,
  kind: "shape",
  box: { x: 457_200, y: 457_200, width: 5_486_400, height: 1_828_800, rotation: 0, flipH: false, flipV: false },
  editable: false,
  movable: true,
  placeholder: false,
  filled: true,
  fill: null,
  line: null,
  outline: "box",
  text: null,
}

async function mounted(onSelection: (selection: Selection) => void): Promise<HTMLElement> {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: "", picture: null })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  const slide = { width: 12_192_000, height: 6_858_000, background: null, elements: [element] }
  await act(async () => {
    root.render(createElement(SlideCanvas, { store, slide, width: 800, onBoxes: () => undefined, onSelection }))
  })
  return host
}

function query(host: HTMLElement, selector: string): HTMLElement {
  const found = host.querySelector<HTMLElement>(selector)
  if (found === null) throw new Error(selector)
  return found
}

it("keeps the selection while focus is in a part that keeps it, and tells every change of selection", async () => {
  const told: (ElementId | null)[] = []
  const host = await mounted((selection) => told.push(leadOf(selection)))
  const panel = document.createElement("div")
  panel.dataset.keepsSelection = ""
  const inside = document.createElement("button")
  panel.append(inside)
  document.body.append(panel)
  await act(async () => query(host, `[data-canvas-element="${element.key}"]`).focus())
  await act(async () => inside.focus())
  expect(host.querySelector<HTMLElement>("[data-selection]")?.dataset.selection).toBe(id)
  await act(async () => {
    query(host, "[data-slide-paint]").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 700, clientY: 400, button: 0 }),
    )
  })
  expect(host.querySelector("[data-selection]")).toBeNull()
  expect(told).toEqual([id, null])
  panel.remove()
})
