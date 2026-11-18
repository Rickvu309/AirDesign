import { elementId } from "@airdesign/document"
import type { PaintElement } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases, type CanvasSource } from "./canvas-slide"

const part = "ppt/slides/slide1.xml"
const id = elementId("256.2")
const photo: PaintElement = {
  part,
  shape: "2",
  from: "slide",
  kind: "p:pic",
  box: { x: 1, y: 2, width: 3, height: 4, rotation: 0, flipH: false, flipV: false },
  group: null,
  placeholder: null,
  text: null,
  fill: null,
  line: null,
  geometry: null,
  image: null,
}
const source: CanvasSource = { part, shapes: new Map([["2", { id, kind: "shape", editable: true, movable: false }]]) }

it("paints a p:pic as a picture though the document calls it a shape whose fills hold an image", () => {
  const reader = { slide: () => ({ width: 12_192_000, height: 6_858_000, elements: [photo], background: null }) }
  const canvas = slideCanvases(reader, [source])(0)
  expect(canvas?.elements.map((each) => [each.id, each.kind])).toEqual([[id, "picture"]])
})
