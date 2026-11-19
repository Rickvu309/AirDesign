import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement, type CanvasText } from "./index.js"

const hosts: { host: HTMLDivElement; root: Root }[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  for (const mounted of hosts.splice(0)) {
    await act(async () => {
      mounted.root.unmount()
    })
    mounted.host.remove()
  }
})

const id = elementId("256.2")
const style = { font: "Arial", size: 254_000, bold: false, italic: false, color: null }
const fitted: CanvasText = {
  paragraphs: [{ from: 0, align: "left", runs: [{ from: 0, text: "Revenue grew", ...style }], endStyle: style }],
  anchor: "top",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
  fit: { kind: "shrink", scale: 1, reduction: 0 },
}
const card: CanvasElement = {
  key: "card",
  id,
  kind: "shape",
  box: { x: 457_200, y: 457_200, width: 3_048_000, height: 914_400, rotation: 0, flipH: false, flipV: false },
  editable: true,
  movable: true,
  placeholder: false,
  filled: true,
  fill: "white",
  line: null,
  outline: "box",
  text: fitted,
}
const stored = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Revenue grew" }] }])

async function painted() {
  const store = paintStore()
  store.publish({ id, kind: "shape", text: stored })
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  hosts.push({ host, root })
  await act(async () => {
    root.render(
      createElement(SlideCanvas, {
        store,
        slide: { width: 12_192_000, height: 6_858_000, background: null, elements: [card] },
        width: 800,
        onBoxes: () => undefined,
      }),
    )
  })
  return store
}

describe("text fit during a move", () => {
  it("reads no layout when a fitted text layer moves without changing size, and measures again when it is resized", async () => {
    const store = await painted()
    const reads = vi.spyOn(globalThis, "getComputedStyle")
    const grip = store.gripBox(id)
    for (const step of [1, 2, 3])
      await act(async () => {
        grip.place({ x: 457_200 + step * 152_400, y: 457_200, cx: 3_048_000, cy: 914_400 })
      })
    expect(reads).not.toHaveBeenCalled()
    await act(async () => {
      grip.place({ x: 914_400, y: 457_200, cx: 1_524_000, cy: 914_400 })
    })
    expect(reads).toHaveBeenCalled()
    grip.keep()
  })
})
