import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import {
  emuOf,
  largeNudgeStep,
  keptOnSlide,
  frameOf,
  movedBox,
  movedBoxes,
  nudgedBox,
  nudgedBoxes,
  nudgeStep,
  paintedAt,
} from "./box-gesture.js"
import type { PaintBox } from "./record.js"

const wide = { width: 12_192_000, height: 6_858_000 }
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const id = elementId("256.2")
const other = elementId("256.3")
const beside = { ...start, x: 6_400_800, y: 3_200_400 }

describe("emuOf", () => {
  it.each([
    [800, 30, 457_200],
    [400, 30, 914_400],
    [1600, 30, 228_600],
    [800, -12, -182_880],
    [800, 0.4, 6096],
  ])("turns %d px of canvas width and a %d px move into EMU on the slide's scale", (width, pixels, emu) => {
    expect(emuOf(pixels, width, wide)).toBe(emu)
  })

  it("rounds to a whole EMU", () => {
    expect(Number.isInteger(emuOf(1 / 3, 777, wide))).toBe(true)
  })
})

describe("movedBox", () => {
  it("moves the box by the delta and keeps its size", () => {
    expect(movedBox(start, 457_200, 914_400, wide)).toEqual({ ...start, x: 914_400, y: 1_371_600 })
  })

  it("stops while a quarter inch of the box is still on the slide past the left and top edges", () => {
    expect(movedBox(start, -20_000_000, -20_000_000, wide)).toEqual({
      ...start,
      x: keptOnSlide - start.cx,
      y: keptOnSlide - start.cy,
    })
  })

  it("stops while a quarter inch of the box is still on the slide past the right and bottom edges", () => {
    expect(movedBox(start, 20_000_000, 20_000_000, wide)).toEqual({
      ...start,
      x: wide.width - keptOnSlide,
      y: wide.height - keptOnSlide,
    })
  })

  it("keeps all of a box narrower than a quarter inch on the slide", () => {
    const thin = { x: 100_000, y: 100_000, cx: 12_700, cy: 0 }
    expect(movedBox(thin, -1_000_000, 20_000_000, wide)).toEqual({ ...thin, x: 0, y: wide.height })
  })

  it("lets a box that already sat further out move back in but not further out", () => {
    const out = { ...start, x: -6_000_000 }
    expect(movedBox(out, -1_000, 0, wide).x).toBe(-6_000_000)
    expect(movedBox(out, 1_000, 0, wide).x).toBe(-5_999_000)
  })
})

describe("nudgedBox", () => {
  it.each([
    ["ArrowLeft", false, -nudgeStep, 0],
    ["ArrowRight", false, nudgeStep, 0],
    ["ArrowUp", false, 0, -nudgeStep],
    ["ArrowDown", false, 0, nudgeStep],
    ["ArrowRight", true, largeNudgeStep, 0],
    ["ArrowUp", true, 0, -largeNudgeStep],
  ] as const)("moves the box one step for %s with Shift %s", (key, large, dx, dy) => {
    expect(nudgedBox(start, key, large, wide)).toEqual({ ...start, x: start.x + dx, y: start.y + dy })
  })

  it("answers null for a key that is not an arrow", () => {
    expect(nudgedBox(start, "a", false, wide)).toBeNull()
  })

  it("stops at the same slide edge as a drag", () => {
    const edge = { ...start, x: wide.width - keptOnSlide }
    expect(nudgedBox(edge, "ArrowRight", true, wide)).toEqual(edge)
  })
})

describe("paintedAt", () => {
  const file: PaintBox = { x: 1, y: 2, width: 3, height: 4, rotation: 30, flipH: true, flipV: false }

  it("paints the file's box when nothing has moved it", () => {
    expect(paintedAt(file, null)).toBe(file)
  })

  it("paints a moved box with the file's turn and flips", () => {
    expect(paintedAt(file, { x: 10, y: 20, cx: 30, cy: 40 })).toEqual({ ...file, x: 10, y: 20, width: 30, height: 40 })
  })

  it("paints a moved box upright when the file gave it no place", () => {
    expect(paintedAt(null, { x: 10, y: 20, cx: 30, cy: 40 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
      rotation: 0,
      flipH: false,
      flipV: false,
    })
  })
})

describe("movedBoxes", () => {
  it("moves every box by one distance and stops them all where their frame meets the slide's edge", () => {
    const starts = new Map([
      [id, start],
      [other, beside],
    ])
    const frame = frameOf([start, beside])
    expect(frame).toEqual({ x: 457_200, y: 457_200, cx: 11_430_000, cy: 4_572_000 })
    const moved = movedBoxes(starts, 50_000_000, 127_000, wide)
    const across = (moved.get(id)?.x ?? 0) - start.x
    expect(moved.get(other)).toEqual({ ...beside, x: beside.x + across, y: beside.y + 127_000 })
    expect(moved.get(id)).toEqual({ ...start, x: start.x + across, y: start.y + 127_000 })
    expect(movedBox(frame ?? start, 50_000_000, 127_000, wide).x).toBe(start.x + across)
  })

  it("nudges every box with the arrows, ten times as far with Shift", () => {
    const starts = new Map([
      [id, start],
      [other, beside],
    ])
    expect(nudgedBoxes(starts, "ArrowLeft", true, wide)?.get(other)).toEqual({
      ...beside,
      x: beside.x - largeNudgeStep,
    })
    expect(nudgedBoxes(starts, "ArrowDown", false, wide)?.get(id)).toEqual({ ...start, y: start.y + nudgeStep })
    expect(nudgedBoxes(starts, "Enter", false, wide)).toBeNull()
  })
})
