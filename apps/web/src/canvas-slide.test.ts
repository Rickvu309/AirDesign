import { elementId } from "@airdesign/document"
import type { PaintBox, PaintElement, PaintFill, PaintReader, SlidePaint } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { paintKind, slideCanvases, type CanvasSource } from "./canvas-slide"

const part = "ppt/slides/slide1.xml"
const box: PaintBox = { x: 1, y: 2, width: 3, height: 4, rotation: 0, flipH: false, flipV: false }
const size = { width: 12_192_000, height: 6_858_000 }
const id = elementId("256.2")

function row(overrides: Partial<PaintElement> = {}): PaintElement {
  return {
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
    ...overrides,
  }
}

function reader(paint: Omit<SlidePaint, "background">, reads: string[] = []): PaintReader {
  return {
    slide(slidePart) {
      reads.push(slidePart)
      return { ...paint, background: null }
    },
  }
}

const source: CanvasSource = { part, shapes: new Map([["2", { id, kind: "shape", editable: true }]]) }

it("carries the deck's size and each row's own box", () => {
  const canvas = slideCanvases(reader({ ...size, elements: [row()] }), [source])(0)
  expect(canvas).toEqual({
    ...size,
    elements: [{ key: `${part}#2`, id, kind: "shape", box, editable: true, placeholder: false, filled: false }],
  })
})

const seen = { hex: "112233", alpha: 1 }
const clear = { hex: "112233", alpha: 0 }

it.each<[string, PaintFill | null, boolean]>([
  ["no fill read", null, false],
  ["no fill", { type: "none" }, false],
  ["a clear solid", { type: "solid", color: clear }, false],
  ["a solid", { type: "solid", color: seen }, true],
  ["a clear gradient", { type: "gradient", stops: [{ position: 0, color: clear }], angle: 0 }, false],
  [
    "a gradient",
    {
      type: "gradient",
      stops: [
        { position: 0, color: clear },
        { position: 1, color: seen },
      ],
      angle: 0,
    },
    true,
  ],
  ["a clear pattern", { type: "pattern", preset: "pct5", foreground: clear, background: clear }, false],
  ["a pattern", { type: "pattern", preset: "pct5", foreground: clear, background: seen }, true],
  [
    "a picture",
    {
      type: "picture",
      part: "ppt/media/image1.png",
      contentType: "image/png",
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
      tile: false,
    },
    true,
  ],
])("reads whether %s is a visible fill", (_name, fill, filled) => {
  const canvas = slideCanvases(reader({ ...size, elements: [row({ fill })] }), [source])(0)
  expect(canvas?.elements[0]?.filled).toBe(filled)
})

it("says which row is a placeholder", () => {
  const title = row({ shape: "3", placeholder: { type: "title", index: null } })
  const canvas = slideCanvases(reader({ ...size, elements: [row(), title] }), [source])(0)
  expect(canvas?.elements.map((each) => [each.key, each.placeholder])).toEqual([
    [`${part}#2`, false],
    [`${part}#3`, true],
  ])
})

it("paints a layout row under the slide with no document id even when its shape number matches a slide shape", () => {
  const layout = "ppt/slideLayouts/slideLayout1.xml"
  const canvas = slideCanvases(reader({ ...size, elements: [row({ part: layout, from: "layout" }), row()] }), [source])(
    0,
  )
  expect(canvas?.elements.map((each) => [each.key, each.id, each.editable])).toEqual([
    [`${layout}#2`, null, false],
    [`${part}#2`, id, true],
  ])
})

it("leaves a group out, since its children carry their own boxes", () => {
  const canvas = slideCanvases(
    reader({ ...size, elements: [row({ shape: "9", kind: "p:grpSp" }), row({ group: "9" })] }),
    [source],
  )(0)
  expect(canvas?.elements.map((each) => each.key)).toEqual([`${part}#2`])
})

it("gives two rows that share a shape number different keys", () => {
  const canvas = slideCanvases(reader({ ...size, elements: [row(), row()] }), [source])(0)
  expect(canvas?.elements.map((each) => each.key)).toEqual([`${part}#2`, `${part}#2#1`])
})

it("reads only the slide that is asked for, and once", () => {
  const reads: string[] = []
  const other: CanvasSource = { part: "ppt/slides/slide2.xml", shapes: new Map() }
  const canvases = slideCanvases(reader({ ...size, elements: [] }, reads), [source, other])
  expect(reads).toEqual([])
  const first = canvases(1)
  expect(canvases(1)).toBe(first)
  expect(reads).toEqual(["ppt/slides/slide2.xml"])
})

it("answers no slide past the end of the deck", () => {
  expect(slideCanvases(reader({ ...size, elements: [] }), [])(0)).toBeNull()
})

it("uses the standard slide when the deck names no size", () => {
  const canvas = slideCanvases(reader({ width: 0, height: 0, elements: [] }), [source])(0)
  expect(canvas).toMatchObject({ width: 9_144_000, height: 6_858_000 })
})

it("keeps every shape's words on the slide when the reader cannot read it", () => {
  const broken: PaintReader = {
    slide() {
      throw new Error("markup")
    },
  }
  const canvas = slideCanvases(broken, [source])(0)
  expect(canvas?.elements).toEqual([
    { key: `${part}#2`, id, kind: "shape", box: null, editable: true, placeholder: false, filled: false },
  ])
})

it("keeps every shape's words on the slide when the reader lists none of the slide's own shapes", () => {
  const layout = "ppt/slideLayouts/slideLayout1.xml"
  const canvas = slideCanvases(reader({ ...size, elements: [row({ part: layout, from: "layout" })] }), [source])(0)
  expect(canvas?.elements.map((each) => [each.key, each.box])).toEqual([
    [`${layout}#2`, box],
    [`${part}#2`, null],
  ])
})

it("names each kind the way the record does", () => {
  expect(["p:sp", "p:pic", "p:cxnSp", "p:grpSp", "p:graphicFrame"].map((kind) => paintKind(kind as never))).toEqual([
    "shape",
    "picture",
    "connector",
    "group",
    "chart",
  ])
})
