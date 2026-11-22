import { elementId } from "@airdesign/document"
import type { PaintBox, PaintElement, PaintReader, PaintText } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases, type CanvasSource } from "./canvas-slide"
import { cssColor } from "./paint-css"

const part = "ppt/slides/slide5.xml"
const drawing = "ppt/diagrams/drawing1.xml"
const flat = { rotation: 0, flipH: false, flipV: false }
const frameBox: PaintBox = { x: 410_967, y: 731_521, width: 8_128_000, height: 5_380_744, ...flat }
const id = elementId("256.6")

const style = {
  font: "Aptos",
  size: 56,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  baseline: 0,
  color: { hex: "FFFFFF", alpha: 1 },
  highlight: null,
}

const text: PaintText = {
  paragraphs: [
    {
      from: 0,
      align: "center",
      level: 0,
      marginLeft: 0,
      indent: 0,
      lineHeight: null,
      spaceBefore: null,
      spaceAfter: null,
      bullet: null,
      runs: [{ ...style, from: 0, kind: "text", text: "2023" }],
      endStyle: style,
    },
  ],
  anchor: "middle",
  insets: { left: 0, top: 0, right: 0, bottom: 0 },
  wrap: true,
  fit: "none",
  vertical: false,
  flow: "horz",
  columns: 1,
  columnGap: 0,
  fontScale: 1,
  spacingReduction: 0,
}

const inside = (shape: string, overrides: Partial<PaintElement>): PaintElement => ({
  part: drawing,
  shape,
  from: "slide",
  kind: "p:sp",
  box: { x: 2381, y: 2_110_140, width: 2_901_156, height: 1_160_462, ...flat },
  group: null,
  placeholder: null,
  text: null,
  fill: null,
  line: null,
  geometry: null,
  image: null,
  ...overrides,
})

const frame = (diagram?: readonly PaintElement[]): PaintElement => ({
  part,
  shape: "6",
  from: "slide",
  kind: "p:graphicFrame",
  box: frameBox,
  group: null,
  placeholder: null,
  text: null,
  fill: null,
  line: null,
  geometry: null,
  image: null,
  ...(diagram === undefined ? {} : { diagram }),
})

const reader = (elements: readonly PaintElement[]): PaintReader => ({
  slide: () => ({ width: 9_144_000, height: 6_858_000, background: null, elements }),
})

const source: CanvasSource = {
  part,
  shapes: new Map([
    ["6", { id, kind: "kept", editable: false, movable: false }],
    ["0", { id: elementId("256.0"), kind: "shape", editable: true, movable: true }],
  ]),
}

it("carries a diagram's shapes on its frame, painted but never editable or movable", () => {
  const accent = { hex: "156082", alpha: 1 }
  const chevron = inside("0", { geometry: "chevron", fill: { type: "solid", color: accent } })
  const words = inside("0.text", { text })
  const canvas = slideCanvases(reader([frame([chevron, words])]), [source])(0)
  expect(canvas?.elements).toHaveLength(1)
  const painted = canvas?.elements[0]
  expect(painted?.id).toBe(id)
  expect(painted?.diagram?.map((shape) => [shape.key, shape.id, shape.editable, shape.movable])).toEqual([
    [`${part}#6/0`, null, false, false],
    [`${part}#6/0.text`, null, false, false],
  ])
  expect(painted?.diagram?.[0]?.geometry?.preset).toBe("chevron")
  expect(painted?.diagram?.[0]?.fill).toBe(cssColor(accent))
  expect(painted?.diagram?.[1]?.text?.paragraphs[0]?.runs[0]?.text).toBe("2023")
})

it("leaves a frame with no diagram as it was", () => {
  const canvas = slideCanvases(reader([frame()]), [source])(0)
  expect(canvas?.elements[0]?.diagram).toBeUndefined()
})
