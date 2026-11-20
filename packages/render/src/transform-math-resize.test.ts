import { describe, expect, it } from "vitest"
import { nudgeStep, type Corner } from "./box-gesture.js"
import { resizeBox, resizedByKey } from "./transform-math.js"

const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const free = { keepRatio: false, fromCenter: false } as const
const proportional = { keepRatio: true, fromCenter: false } as const

describe("resizeBox by a corner", () => {
  it.each([
    ["bottom-right", 100, 200, { x: start.x, y: start.y, cx: start.cx + 100, cy: start.cy + 200 }],
    ["top-left", 100, 200, { x: start.x + 100, y: start.y + 200, cx: start.cx - 100, cy: start.cy - 200 }],
    ["top-right", 100, 200, { x: start.x, y: start.y + 200, cx: start.cx + 100, cy: start.cy - 200 }],
    ["bottom-left", 100, 200, { x: start.x + 100, y: start.y, cx: start.cx - 100, cy: start.cy + 200 }],
  ] as const)("moves only the %s corner and keeps the opposite one", (corner, dx, dy, box) => {
    expect(resizeBox(start, corner, dx, dy, free)).toEqual(box)
  })

  it("keeps a picture's ratio from the side that moved most and keeps the opposite corner", () => {
    const grown = resizeBox(start, "bottom-right", 548_640, 0, proportional)
    expect(grown).toEqual({ x: start.x, y: start.y, cx: start.cx + 548_640, cy: start.cy + 182_880 })
    const shrunk = resizeBox(start, "top-left", 0, 914_400, proportional)
    expect(shrunk).toEqual({
      x: start.x + 2_743_200,
      y: start.y + 914_400,
      cx: start.cx - 2_743_200,
      cy: start.cy - 914_400,
    })
    expect(resizeBox(start, "top-left", 20_000_000, 20_000_000, proportional).cy).toBe(0)
  })

  it("stops at zero on each side and keeps the opposite corner", () => {
    const shrunk = resizeBox(start, "top-left", 20_000_000, 20_000_000, free)
    expect(shrunk).toEqual({ x: start.x + start.cx, y: start.y + start.cy, cx: 0, cy: 0 })
  })

  it("never turns a box inside out", () => {
    expect(resizeBox(start, "bottom-right", -20_000_000, -20_000_000, free)).toEqual({
      ...start,
      cx: 0,
      cy: 0,
    })
  })

  it("lets a line with no height grow one but never go below zero", () => {
    const line = { x: 0, y: 0, cx: 3_000_000, cy: 0 }
    expect(resizeBox(line, "bottom-right", 0, -5_000, free)).toEqual(line)
    expect(resizeBox(line, "bottom-right", 0, 5_000, free)).toEqual({ ...line, cy: 5_000 })
  })
})

describe("resizeBox on a turned box", () => {
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
    expect(resizeBox(start, "bottom-right", -100_000, 200_000, free, 90)).toEqual({
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
    expect(resizeBox(start, corner, 300_000, 100_000, free, 30)).toEqual(box)
  })

  it.each(["top-left", "top-right", "bottom-left", "bottom-right"] as const)(
    "keeps the corner opposite %s where it was on screen and moves the pressed one with the pointer",
    (corner) => {
      const box = resizeBox(start, corner, 300_000, -150_000, free, 30)
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

  it("keeps the opposite corner on screen when a turned box stops at zero", () => {
    const box = resizeBox(start, "top-left", 20_000_000, 20_000_000, free, 30)
    expect([box.cx, box.cy]).toEqual([0, 0])
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
})
