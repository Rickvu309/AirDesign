import { describe, expect, it } from "vitest"
import type { Corner } from "./transform-math"
import { resizeBox } from "./transform-math"

const start = { x: 457_200, y: 457_200, w: 5_486_400, h: 1_828_800 }
const free = { keepRatio: false, fromCenter: false } as const
const proportional = { keepRatio: true, fromCenter: false } as const

describe("resizeBox by a corner", () => {
  it.each([
    ["bottom-right", 100, 200, { x: start.x, y: start.y, w: start.w + 100, h: start.h + 200 }],
    ["top-left", 100, 200, { x: start.x + 100, y: start.y + 200, w: start.w - 100, h: start.h - 200 }],
    ["top-right", 100, 200, { x: start.x, y: start.y + 200, w: start.w + 100, h: start.h - 200 }],
    ["bottom-left", 100, 200, { x: start.x + 100, y: start.y, w: start.w - 100, h: start.h + 200 }],
  ] as const)("moves only the %s corner and keeps the opposite one", (corner, dx, dy, box) => {
    expect(resizeBox(start, corner, dx, dy, free)).toEqual(box)
  })

  it("keeps a picture's ratio from the side that moved most and keeps the opposite corner", () => {
    const grown = resizeBox(start, "bottom-right", 548_640, 0, proportional)
    expect(grown).toEqual({ x: start.x, y: start.y, w: start.w + 548_640, h: start.h + 182_880 })
    const shrunk = resizeBox(start, "top-left", 0, 914_400, proportional)
    expect(shrunk).toEqual({
      x: start.x + 2_743_200,
      y: start.y + 914_400,
      w: start.w - 2_743_200,
      h: start.h - 914_400,
    })
    expect(resizeBox(start, "top-left", 20_000_000, 20_000_000, proportional).h).toBe(0)
  })

  it("stops at zero on each side and keeps the opposite corner", () => {
    const shrunk = resizeBox(start, "top-left", 20_000_000, 20_000_000, free)
    expect(shrunk).toEqual({ x: start.x + start.w, y: start.y + start.h, w: 0, h: 0 })
  })

  it("never turns a box inside out", () => {
    expect(resizeBox(start, "bottom-right", -20_000_000, -20_000_000, free)).toEqual({
      ...start,
      w: 0,
      h: 0,
    })
  })

  it("lets a line with no height grow one but never go below zero", () => {
    const line = { x: 0, y: 0, w: 3_000_000, h: 0 }
    expect(resizeBox(line, "bottom-right", 0, -5_000, free)).toEqual(line)
    expect(resizeBox(line, "bottom-right", 0, 5_000, free)).toEqual({ ...line, h: 5_000 })
  })
})

describe("resizeBox on a turned box", () => {
  function onScreen(box: typeof start, corner: Corner, degrees: number) {
    const turn = (degrees * Math.PI) / 180
    const across = (corner.endsWith("left") ? -1 : 1) * (box.w / 2)
    const down = (corner.startsWith("top") ? -1 : 1) * (box.h / 2)
    return {
      x: box.x + box.w / 2 + across * Math.cos(turn) - down * Math.sin(turn),
      y: box.y + box.h / 2 + across * Math.sin(turn) + down * Math.cos(turn),
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
      w: 5_686_400,
      h: 1_928_800,
    })
  })

  it.each([
    ["bottom-right", { x: 452_296, y: 538_899, w: 5_796_208, h: 1_765_403 }],
    ["top-left", { x: 762_104, y: 475_502, w: 5_176_592, h: 1_892_197 }],
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
    expect([box.w, box.h]).toEqual([0, 0])
    const kept = onScreen(start, "bottom-right", 30)
    const now = onScreen(box, "bottom-right", 30)
    expect(Math.abs(now.x - kept.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(now.y - kept.y)).toBeLessThanOrEqual(1)
  })
})
