import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import {
  draggedBox,
  emuOf,
  largeNudgeStep,
  minimumSide,
  frameOf,
  movedBox,
  movedBoxes,
  nudgedBox,
  nudgedBoxes,
  nudgeStep,
  paintedAt,
  resizedBox,
  resizedByKey,
  type Corner,
  type Pull,
} from "./box-gesture.js"
import type { PaintBox } from "./record.js"

const wide = { width: 12_192_000, height: 6_858_000 }
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const id = elementId("256.2")
const other = elementId("256.3")
const beside = { ...start, x: 6_400_800, y: 3_200_400 }

function pressed(grip: Pull["grip"], from = { x: 100, y: 100 }): Pull {
  return { grip, from, start }
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

  it("keeps a picture's ratio from the side that moved most and keeps the opposite corner", () => {
    const grown = resizedBox(start, "bottom-right", 548_640, 0, true)
    expect(grown).toEqual({ x: start.x, y: start.y, cx: start.cx + 548_640, cy: start.cy + 182_880 })
    const shrunk = resizedBox(start, "top-left", 0, 914_400, true)
    expect(shrunk).toEqual({
      x: start.x + 2_743_200,
      y: start.y + 914_400,
      cx: start.cx - 2_743_200,
      cy: start.cy - 914_400,
    })
    expect(resizedBox(start, "top-left", 20_000_000, 20_000_000, true).cy).toBe(minimumSide)
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

describe("resizedBox on a turned box", () => {
  function onScreen(box: typeof start, corner: Corner, degrees: number) {
    const turn = (degrees * Math.PI) / 180
    const across = (corner.endsWith("left") ? -1 : 1) * (box.cx / 2)
    const down = (corner.startsWith("top") ? -1 : 1) * (box.cy / 2)
    return {
      x: box.x + box.cx / 2 + across * Math.cos(turn) - down * Math.sin(turn),
      y: box.y + box.cy / 2 + across * Math.sin(turn) + down * Math.cos(turn),
    }
  }

  const opposite: Readonly<Record<Corner, Corner>> = {
    "top-left": "bottom-right",
    "top-right": "bottom-left",
    "bottom-left": "top-right",
    "bottom-right": "top-left",
  }

  it("grows a box turned 90 degrees along its own sides and keeps the opposite corner on screen", () => {
    expect(resizedBox(start, "bottom-right", -100_000, 200_000, false, 90)).toEqual({
      x: 307_200,
      y: 507_200,
      cx: 5_686_400,
      cy: 1_928_800,
    })
  })

  it.each([
    ["bottom-right", { x: 452_296, y: 538_899, cx: 5_796_208, cy: 1_765_403 }],
    ["top-left", { x: 762_104, y: 475_502, cx: 5_176_592, cy: 1_892_197 }],
  ] as const)("resizes a box turned 30 degrees from its %s corner", (corner, box) => {
    expect(resizedBox(start, corner, 300_000, 100_000, false, 30)).toEqual(box)
  })

  it.each(["top-left", "top-right", "bottom-left", "bottom-right"] as const)(
    "keeps the corner opposite %s where it was on screen and moves the pressed one with the pointer",
    (corner) => {
      const box = resizedBox(start, corner, 300_000, -150_000, false, 30)
      const kept = onScreen(start, opposite[corner], 30)
      const now = onScreen(box, opposite[corner], 30)
      expect(Math.abs(now.x - kept.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(now.y - kept.y)).toBeLessThanOrEqual(1)
      const pressed = onScreen(start, corner, 30)
      const followed = onScreen(box, corner, 30)
      expect(Math.abs(followed.x - pressed.x - 300_000)).toBeLessThanOrEqual(2)
      expect(Math.abs(followed.y - pressed.y + 150_000)).toBeLessThanOrEqual(2)
    },
  )

  it("keeps the opposite corner on screen when a turned box stops at a quarter inch", () => {
    const box = resizedBox(start, "top-left", 20_000_000, 20_000_000, false, 30)
    expect([box.cx, box.cy]).toEqual([minimumSide, minimumSide])
    const kept = onScreen(start, "bottom-right", 30)
    const now = onScreen(box, "bottom-right", 30)
    expect(Math.abs(now.x - kept.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(now.y - kept.y)).toBeLessThanOrEqual(1)
  })

  it("grows a turned box by a key along its own width and keeps its top-left corner on screen", () => {
    const box = resizedByKey(start, "ArrowRight", 30)
    expect(box).toEqual({ x: 456_349, y: 460_375, cx: start.cx + nudgeStep, cy: start.cy })
    const kept = onScreen(start, "top-left", 30)
    const now = box === null ? kept : onScreen(box, "top-left", 30)
    expect(Math.abs(now.x - kept.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(now.y - kept.y)).toBeLessThanOrEqual(1)
  })

  it("resizes a turned box from a drag by the pointer's travel on screen", () => {
    const turned = { ...pressed("bottom-right"), rotation: 90 }
    expect(draggedBox(turned, { x: 95, y: 110 }, 800, wide)).toEqual({
      x: 342_900,
      y: 495_300,
      cx: 5_638_800,
      cy: 1_905_000,
    })
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
