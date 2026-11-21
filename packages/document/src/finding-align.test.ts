import { expect, it } from "vitest"
import { alignFindings } from "./finding-align.js"
import type { ResolvedElement, ResolvedSlide } from "./resolved-slide.js"

const point = 12_700

function card(
  node: string,
  x: number,
  y: number,
  w = 200,
  h = 100,
  more: Partial<ResolvedElement> = {},
): ResolvedElement {
  return {
    node,
    kind: "shape",
    from: "slide",
    box: { x: x * point, y: y * point, cx: w * point, cy: h * point },
    rotation: 0,
    grouped: false,
    placeholder: null,
    fill: { rgb: "DDDDDD" },
    text: null,
    cells: null,
    ...more,
  }
}

function slide(elements: readonly ResolvedElement[]): ResolvedSlide {
  return { slide: "256", size: { width: 960 * point, height: 540 * point }, background: { rgb: "FFFFFF" }, elements }
}

it("names the layer a point or two out of its row or column, and where it lines up", () => {
  const column = [card("256.2", 72, 100), card("256.3", 72, 220), card("256.4", 73.5, 340)]
  expect(alignFindings(slide(column))).toEqual([
    {
      slide: "256",
      node: "256.4",
      code: "misaligned",
      level: "fault",
      other: "256.3",
      edge: "left",
      by: 1.5,
      fix: { x: 72 },
    },
  ])
  const row = [card("256.2", 72, 100), card("256.3", 300, 102), card("256.4", 528, 100)]
  expect(alignFindings(slide(row))).toEqual([
    {
      slide: "256",
      node: "256.3",
      code: "misaligned",
      level: "fault",
      other: "256.2",
      edge: "top",
      by: 2,
      fix: { y: 100 },
    },
  ])
})

it("leaves layers alone that line up, sit far apart or far off, share no row or column, have no edge to see, or are not the slide's own", () => {
  expect(alignFindings(slide([card("256.2", 72, 100), card("256.3", 72.5, 220)]))).toEqual([])
  expect(alignFindings(slide([card("256.2", 72, 100), card("256.3", 76, 220)]))).toEqual([])
  expect(alignFindings(slide([card("256.2", 72, 100), card("256.3", 400, 301.5)]))).toEqual([])
  expect(alignFindings(slide([card("256.2", 0, 0, 960, 540), card("256.3", 1.5, 1.5)]))).toEqual([])
  expect(alignFindings(slide([card("256.2", 72, 100), card("256.3", 73.5, 260)]))).toEqual([])
  const skipped = [
    card("256.7", 73.5, 220, 200, 100, { placeholder: "sldNum" }),
    card("256.8", 73.5, 220, 200, 100, { fill: "none" }),
    card("256.9", 73.5, 220, 12, 12),
    card("256.3", 73.5, 220, 200, 100, { grouped: true }),
    card("256.4", 73.5, 340, 200, 100, { rotation: 15 }),
    card("256.5", 73.5, 460, 200, 100, { kind: "connector" }),
    card("256.6", 73.5, 460, 200, 100, { from: "layout" }),
  ]
  for (const each of skipped) expect(alignFindings(slide([card("256.2", 72, 100), each]))).toEqual([])
})
