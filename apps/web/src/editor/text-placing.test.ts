import { expect, it } from "vitest"
import { placeOf } from "./text-placing"

const slide = { width: 12_192_000, height: 6_858_000 }

it("places a click as a point and a drag past three pixels as the box it framed, in slide units", () => {
  const click = { pointer: 1, from: { x: 120, y: 60 }, to: { x: 121, y: 61 } }
  expect(placeOf(click, slide, 960)).toEqual({ x: 1_524_000, y: 762_000 })
  const drag = { pointer: 1, from: { x: 480, y: 270 }, to: { x: 120, y: 60 } }
  expect(placeOf(drag, slide, 960)).toEqual({ x: 1_524_000, y: 762_000, cx: 4_572_000, cy: 2_667_000 })
})
