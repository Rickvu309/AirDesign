import { expect, it } from "vitest"
import { scaleFindings } from "./finding-scale.js"
import type { ResolvedElement, ResolvedSlide } from "./resolved-slide.js"

const scale = [
  { name: "Title", size: 28 },
  { name: "Heading", size: 20 },
  { name: "Body", size: 16 },
  { name: "Caption", size: 11 },
]

function words(node: string, sizes: readonly number[], more: Partial<ResolvedElement> = {}): ResolvedElement {
  const runs = sizes.map((size) => ({ text: "Revenue", size }))
  return {
    node,
    kind: "shape",
    from: "slide",
    box: null,
    rotation: 0,
    grouped: false,
    placeholder: null,
    fill: "none",
    text: { paragraphs: [{ runs }] } as unknown as ResolvedElement["text"],
    cells: null,
    ...more,
  }
}

function slide(elements: readonly ResolvedElement[], named: ResolvedSlide["scale"] = scale): ResolvedSlide {
  return { slide: "256", size: { width: 12_192_000, height: 6_858_000 }, background: "none", scale: named, elements }
}

it("names text at a size the template does not name, and the nearest named size", () => {
  expect(scaleFindings(slide([words("256.2", [24]), words("256.3", [16, 13])]))).toEqual([
    { slide: "256", node: "256.2", code: "off-scale", level: "note", size: 24, style: "Heading", fix: { size: 20 } },
    { slide: "256", node: "256.3", code: "off-scale", level: "note", size: 13, style: "Caption", fix: { size: 11 } },
  ])
})

it("leaves named sizes, a pattern's fitted steps, the layout's text and decks with no named scale alone", () => {
  expect(scaleFindings(slide([words("256.2", [28, 20, 16, 11])]))).toEqual([])
  expect(scaleFindings(slide([words("256.2", [18, 14.4, 12.8, 8, 16.8])]))).toEqual([])
  expect(scaleFindings(slide([words("256.2", [24], { from: "layout" })]))).toEqual([])
  expect(scaleFindings(slide([words("256.2", [24])], [{ name: "Title", size: 28 }]))).toEqual([])
  expect(scaleFindings(slide([words("256.2", [24])], []))).toEqual([])
})
