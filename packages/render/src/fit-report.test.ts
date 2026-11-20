import { elementId } from "@airdesign/document"
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { paintStore, SlideCanvas, type CanvasElement } from "./index.js"

const node = elementId("256.4")

const child = (measure: boolean): CanvasElement => ({
  key: "child",
  id: node,
  kind: "shape",
  box: { x: 0, y: 0, width: 914_400, height: 457_200, rotation: 0, flipH: false, flipV: false },
  editable: false,
  placeholder: false,
  filled: true,
  fill: "steelblue",
  line: null,
  outline: "box",
  text: null,
  inFrame: "auto",
  ...(measure ? { measure: "owed" as const } : {}),
})

const roots: ReturnType<typeof createRoot>[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) await act(async () => root.unmount())
})

describe("the device's answer to a measure an agent's edit owes", () => {
  it("writes the child's height once while it is owed, and again only when it is owed again", async () => {
    const fits: number[] = []
    const root = createRoot(document.createElement("div"))
    roots.push(root)
    const store = paintStore()
    const paint = (measure: boolean) =>
      act(async () =>
        root.render(
          createElement(SlideCanvas, {
            store,
            slide: { width: 9_144_000, height: 5_143_500, background: null, elements: [child(measure)] },
            width: 960,
            onFit: (_: unknown, size: { readonly height: number }) => fits.push(size.height),
          }),
        ),
      )
    await paint(false)
    expect(fits).toEqual([])
    await paint(true)
    await paint(true)
    expect(fits).toEqual([457_200])
    await paint(false)
    await paint(true)
    expect(fits).toEqual([457_200, 457_200])
  })
})
