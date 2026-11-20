import { elementId } from "@airdesign/document"
import type { PaintBox, PaintElement, PaintReader } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases, type CanvasSource } from "./canvas-slide"

const part = "ppt/slides/slide1.xml"
const box: PaintBox = { x: 1, y: 2, width: 3, height: 4, rotation: 0, flipH: false, flipV: false }

function row(shape: string, more: Partial<PaintElement> = {}): PaintElement {
  return {
    part,
    shape,
    from: "slide",
    kind: "p:sp",
    box,
    group: null,
    placeholder: null,
    text: null,
    fill: null,
    line: null,
    geometry: null,
    image: null,
    ...more,
  }
}

function canvasOf(rows: readonly PaintElement[]) {
  const reader: PaintReader = {
    slide: () => ({ width: 12_192_000, height: 6_858_000, elements: rows, background: null }),
  }
  const shapes = new Map(
    rows.map((each) => [
      each.shape,
      {
        id: elementId(`256.${each.shape}`),
        kind: each.kind === "p:grpSp" ? ("group" as const) : ("shape" as const),
        editable: true,
        movable: true,
      },
    ]),
  )
  const source: CanvasSource = { part, shapes }
  return slideCanvases(reader, [source])(0)?.elements ?? []
}

it("marks a mask layer from the file and holds the layers above it in its group", () => {
  const painted = canvasOf([
    row("9", { kind: "p:grpSp" }),
    row("10", { group: "9", mask: true }),
    row("11", { group: "9", kind: "p:pic" }),
    row("12"),
  ])
  expect(painted.map((each) => [each.id, each.mask === true, each.held ?? 0])).toEqual([
    [elementId("256.9"), false, 2],
    [elementId("256.10"), true, 0],
    [elementId("256.11"), false, 0],
    [elementId("256.12"), false, 0],
  ])
})

it("reads no mask from a layout's layer", () => {
  const [layout] = canvasOf([row("2", { from: "layout", mask: true })])
  expect(layout?.mask).toBeUndefined()
})
