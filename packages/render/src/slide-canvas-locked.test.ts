import { elementId, type ElementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasSlide } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

function shape(id: ElementId, locked: boolean): CanvasElement {
  return {
    key: id,
    id,
    kind: "shape",
    box: { x: 0, y: 0, width: 6_096_000, height: 1_714_500, rotation: 0, flipH: false, flipV: false },
    editable: true,
    movable: !locked,
    ...(locked ? { locked: true as const } : {}),
    placeholder: false,
    filled: true,
    fill: "var(--primary)",
    line: null,
    outline: "box",
    text: null,
  }
}

it("lets a pointer pass through a locked layer to what lies under it, and takes it on a free one", async () => {
  const free = elementId("256.2")
  const locked = elementId("256.3")
  const slide: CanvasSlide = {
    width: 12_192_000,
    height: 6_858_000,
    background: null,
    elements: [shape(free, false), shape(locked, true)],
  }
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(createElement(SlideCanvas, { store: paintStore(), slide, width: 640, onBoxes: () => undefined }))
  })
  const frame = (id: ElementId) => host.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`)
  expect(frame(free)?.style.pointerEvents).toBe("auto")
  expect(frame(locked)?.style.pointerEvents).toBe("none")
})
