import { describe, expect, it } from "vitest"
import {
  canvasRoom,
  fitWidth,
  slideRoom,
  steppedZoom,
  zoomKey,
  zoomPercent,
  zoomSteps,
  zoomWidth,
} from "@/editor/canvas-zoom"

const wide = { width: 12_192_000, height: 6_858_000 }
const standard = { width: 9_144_000, height: 6_858_000 }
const square = { width: 6_858_000, height: 6_858_000 }
const portrait = { width: 6_858_000, height: 9_144_000 }
const room = slideRoom(800)

describe("canvas zoom", () => {
  it("fits a wide or a standard slide to the designed 800 px width", () => {
    expect(fitWidth(room, wide)).toBe(800)
    expect(fitWidth(room, standard)).toBe(800)
  })

  it("fits a square or a portrait slide by the room's height", () => {
    expect(fitWidth(room, square)).toBe(600)
    expect(fitWidth(room, portrait)).toBe(450)
  })

  it("fits to the room's width when the slide has no size", () => {
    expect(fitWidth(room, { width: 0, height: 0 })).toBe(800)
  })

  it("reads a width as a percent of the slide's size at 96 pixels an inch", () => {
    expect(zoomPercent(1280, wide)).toBe(100)
    expect(zoomPercent(800, wide)).toBe(63)
    expect(zoomPercent(800, standard)).toBe(83)
  })

  it("turns each step into the width that shows that percent", () => {
    expect(zoomWidth("fit", room, wide)).toBe(800)
    expect(zoomSteps.map((step) => zoomWidth(step, room, wide))).toEqual([640, 1280, 2560])
    for (const step of zoomSteps) expect(zoomPercent(zoomWidth(step, room, standard), standard)).toBe(step)
  })

  it("fits a wide slide to the designed 800 px in the canvas column of a 1470x923 window", () => {
    expect(fitWidth(canvasRoom({ width: 862, height: 923 }), wide)).toBe(800)
    expect(fitWidth(canvasRoom({ width: 862, height: 923 }), standard)).toBe(800)
  })

  it("grows and shrinks the fitted slide with the canvas column, by width or by height", () => {
    expect(fitWidth(canvasRoom({ width: 672, height: 720 }), wide)).toBe(610)
    expect(fitWidth(canvasRoom({ width: 1312, height: 1080 }), wide)).toBe(1250)
    expect(fitWidth(canvasRoom({ width: 1312, height: 600 }), wide)).toBe(645)
    expect(fitWidth(canvasRoom({ width: 0, height: 0 }), wide)).toBe(0)
  })
})

const plain = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, field: false }

describe("zoom keys", () => {
  it("zooms in with Ctrl or Cmd and = or +, out with -, and fits with 0", () => {
    expect(zoomKey({ ...plain, key: "=", ctrlKey: true })).toBe("in")
    expect(zoomKey({ ...plain, key: "+", metaKey: true, shiftKey: true })).toBe("in")
    expect(zoomKey({ ...plain, key: "-", ctrlKey: true })).toBe("out")
    expect(zoomKey({ ...plain, key: "_", metaKey: true, shiftKey: true })).toBe("out")
    expect(zoomKey({ ...plain, key: "0", metaKey: true })).toBe("fit")
  })

  it("leaves the keys to the browser inside a text field, without a modifier, or with Alt", () => {
    expect(zoomKey({ ...plain, key: "=", ctrlKey: true, field: true })).toBeNull()
    expect(zoomKey({ ...plain, key: "=" })).toBeNull()
    expect(zoomKey({ ...plain, key: "0" })).toBeNull()
    expect(zoomKey({ ...plain, key: "=", ctrlKey: true, altKey: true })).toBeNull()
    expect(zoomKey({ ...plain, key: "z", ctrlKey: true })).toBeNull()
  })

  it("steps to the next zoom above or below the percent on show, and stops at the ends", () => {
    expect(steppedZoom("in", 83)).toBe(100)
    expect(steppedZoom("in", 100)).toBe(200)
    expect(steppedZoom("in", 200)).toBe(200)
    expect(steppedZoom("out", 83)).toBe(50)
    expect(steppedZoom("out", 200)).toBe(100)
    expect(steppedZoom("out", 50)).toBe(50)
    expect(steppedZoom("in", 250)).toBe(200)
    expect(steppedZoom("out", 30)).toBe(50)
  })
})
