import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import {
  draggedBox,
  emuOf,
  largeNudgeStep,
  minimumSide,
  movedBox,
  nudgedBox,
  nudgeStep,
  paintedAt,
  resizedBox,
  type Drag,
} from "./box-gesture.js"
import type { PaintBox } from "./record.js"

const wide = { width: 12_192_000, height: 6_858_000 }
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const id = elementId("256.2")

function pressed(grip: Drag["grip"], from = { x: 100, y: 100 }): Drag {
  return { by: "pointer", id, grip, pointer: 1, from, start, moved: true }
}

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
      x: minimumSide - start.cx,
      y: minimumSide - start.cy,
    })
  })

  it("stops while a quarter inch of the box is still on the slide past the right and bottom edges", () => {
    expect(movedBox(start, 20_000_000, 20_000_000, wide)).toEqual({
      ...start,
      x: wide.width - minimumSide,
      y: wide.height - minimumSide,
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

describe("resizedBox", () => {
  it.each([
    ["bottom-right", 100, 200, { x: start.x, y: start.y, cx: start.cx + 100, cy: start.cy + 200 }],
    ["top-left", 100, 200, { x: start.x + 100, y: start.y + 200, cx: start.cx - 100, cy: start.cy - 200 }],
    ["top-right", 100, 200, { x: start.x, y: start.y + 200, cx: start.cx + 100, cy: start.cy - 200 }],
    ["bottom-left", 100, 200, { x: start.x + 100, y: start.y, cx: start.cx - 100, cy: start.cy + 200 }],
  ] as const)("moves only the %s corner and keeps the opposite one", (corner, dx, dy, box) => {
    expect(resizedBox(start, corner, dx, dy)).toEqual(box)
  })

  it("stops at a quarter inch on each side and keeps the opposite corner", () => {
    const shrunk = resizedBox(start, "top-left", 20_000_000, 20_000_000)
    expect(shrunk).toEqual({
      x: start.x + start.cx - minimumSide,
      y: start.y + start.cy - minimumSide,
      cx: minimumSide,
      cy: minimumSide,
    })
  })

  it("never turns a box inside out", () => {
    expect(resizedBox(start, "bottom-right", -20_000_000, -20_000_000)).toEqual({
      ...start,
      cx: minimumSide,
      cy: minimumSide,
    })
  })

  it("lets a side already under a quarter inch grow but not shrink", () => {
    const line = { x: 0, y: 0, cx: 3_000_000, cy: 0 }
    expect(resizedBox(line, "bottom-right", 0, -5_000)).toEqual(line)
    expect(resizedBox(line, "bottom-right", 0, 5_000)).toEqual({ ...line, cy: 5_000 })
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
    const edge = { ...start, x: wide.width - minimumSide }
    expect(nudgedBox(edge, "ArrowRight", true, wide)).toEqual(edge)
  })
})

describe("draggedBox", () => {
  it("moves by the pointer's travel at the canvas zoom", () => {
    expect(draggedBox(pressed("move"), { x: 130, y: 160 }, 800, wide)).toEqual({ ...start, x: 914_400, y: 1_371_600 })
  })

  it("resizes from the pressed corner by the pointer's travel at the canvas zoom", () => {
    expect(draggedBox(pressed("bottom-right"), { x: -20, y: 160 }, 800, wide)).toEqual({
      ...start,
      cx: 3_657_600,
      cy: 2_743_200,
    })
  })

  it("lands on the same box at half the zoom with half the travel", () => {
    expect(draggedBox(pressed("move"), { x: 115, y: 130 }, 400, wide)).toEqual({ ...start, x: 914_400, y: 1_371_600 })
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
