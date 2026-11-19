import { elementId } from "@airdesign/document"
import type { PaintBox, PaintElement, PaintReader } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases, type CanvasSource } from "./canvas-slide"

const part = "ppt/slides/slide1.xml"
const box: PaintBox = { x: 1, y: 2, width: 3, height: 4, rotation: 0, flipH: false, flipV: false }
const shown = elementId("256.2")
const hidden = elementId("256.3")

const row: PaintElement = {
  part,
  shape: "2",
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
}

const reader: PaintReader = {
  slide: () => ({ width: 12_192_000, height: 6_858_000, elements: [row], background: null }),
}

it("names the layers the slide holds but does not paint, such as a hidden one", () => {
  const source: CanvasSource = {
    part,
    shapes: new Map([
      ["2", { id: shown, kind: "shape", editable: true, movable: false }],
      ["3", { id: hidden, kind: "shape", editable: true, movable: false }],
    ]),
  }
  const canvas = slideCanvases(reader, [source])(0)
  expect(canvas?.elements.map((each) => each.id)).toEqual([shown])
  expect(canvas?.unpainted).toEqual([hidden])
})
