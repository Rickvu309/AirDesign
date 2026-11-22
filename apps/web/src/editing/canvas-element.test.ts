import { elementId } from "@airdesign/document"
import type { PaintElement } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases, type CanvasSource } from "./canvas-slide"
import { cssColor } from "./paint-css"

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

it("lays a colour above an image as a layer CSS takes, since only the bottom background layer may be a bare colour", () => {
  const image = {
    part: "ppt/media/image1.png",
    contentType: "image/png",
    crop: { left: 0, top: 0, right: 0, bottom: 0 },
    tile: false,
  }
  const shade = { hex: "000000", alpha: 0.5 }
  const stacked: PaintElement = {
    ...photo,
    kind: "p:sp",
    image,
    stack: [{ type: "image" }, { type: "solid", color: shade }],
  }
  const reader = { slide: () => ({ width: 12_192_000, height: 6_858_000, elements: [stacked], background: null }) }
  const fill = slideCanvases(reader, [source], () => "blob:photo")(0)?.elements[0]?.fill ?? ""
  const flat = `linear-gradient(${cssColor(shade)}, ${cssColor(shade)})`
  expect(fill.startsWith(`${flat}, url("blob:photo")`)).toBe(true)
})
