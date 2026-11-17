import { describe, expect, it } from "vitest"
import {
  canvasRoom,
  zoomRanges,
  slideTop,
  fitWidth,
  slideRoom,
  steppedZoom,
  typedZoom,
  zoomKey,
  zoomPercent,
  zoomPresets,
  zoomWidth,
} from "@/editor/canvas-zoom"

const wide = { width: 12_192_000, height: 6_858_000 }
const standard = { width: 9_144_000, height: 6_858_000 }
const square = { width: 6_858_000, height: 6_858_000 }
const portrait = { width: 6_858_000, height: 9_144_000 }
const room = slideRoom(800)

describe("canvas zoom", () => {
  it("reserves the measured overlay and a 40 px gap at both ends", () => {
    expect(canvasRoom({ width: 862, height: 923 }, 152)).toEqual({ width: 800, height: 691 })
    expect(canvasRoom({ width: 862, height: 923 }, 352)).toEqual({ width: 800, height: 491 })
    expect(canvasRoom({ width: 20, height: 50 }, 152)).toEqual({ width: 0, height: 0 })
  })

  it("centres the slide itself above the overlay, with a minimum gap when zoomed", () => {
    expect(slideTop({ height: 923, overlay: 152, slide: 450 })).toBe(160.5)
    expect(slideTop({ height: 923, overlay: 352, slide: 450 })).toBe(60.5)
    expect(slideTop({ height: 923, overlay: 352, slide: 1440 })).toBe(40)
  })

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
    expect(zoomPresets.map((step) => zoomWidth(step, room, wide))).toEqual([640, 1280, 2560])
    expect(zoomWidth(37, room, wide)).toBe(474)
    for (const step of [...zoomPresets, 10, 37, 400])
      expect(zoomPercent(zoomWidth(step, room, standard), standard)).toBe(step)
  })

  it("fits a wide slide to the designed 800 px in the canvas column of a 1470x923 window", () => {
    expect(fitWidth(canvasRoom({ width: 862, height: 923 }, 152), wide)).toBe(800)
    expect(fitWidth(canvasRoom({ width: 862, height: 923 }, 152), standard)).toBe(800)
  })

  it("grows and shrinks the fitted slide with the canvas column, by width or by height", () => {
    expect(fitWidth(canvasRoom({ width: 672, height: 720 }, 152), wide)).toBe(610)
    expect(fitWidth(canvasRoom({ width: 1312, height: 1080 }, 152), wide)).toBe(1250)
    expect(fitWidth(canvasRoom({ width: 1312, height: 600 }, 152), wide)).toBe(654)
    expect(fitWidth(canvasRoom({ width: 0, height: 0 }, 152), wide)).toBe(0)
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

  it("fits with Shift+1 and zooms to the selection with Shift+2, but not while typing", () => {
    expect(zoomKey({ ...plain, key: "!", code: "Digit1", shiftKey: true })).toBe("fit")
    expect(zoomKey({ ...plain, key: "@", code: "Digit2", shiftKey: true })).toBe("selection")
    expect(zoomKey({ ...plain, key: "@", code: "Digit2", shiftKey: true, field: true })).toBeNull()
  })

  it("leaves the keys to the browser inside a text field, without a modifier, or with Alt", () => {
    expect(zoomKey({ ...plain, key: "=", ctrlKey: true, field: true })).toBeNull()
    expect(zoomKey({ ...plain, key: "=" })).toBeNull()
    expect(zoomKey({ ...plain, key: "0" })).toBeNull()
    expect(zoomKey({ ...plain, key: "=", ctrlKey: true, altKey: true })).toBeNull()
    expect(zoomKey({ ...plain, key: "z", ctrlKey: true })).toBeNull()
  })

  it("steps to the next stop above or below the percent on show, and stops at 10 and 400", () => {
    expect(steppedZoom("in", 63)).toBe(75)
    expect(steppedZoom("in", 100)).toBe(150)
    expect(steppedZoom("in", 23)).toBe(25)
    expect(steppedZoom("out", 63)).toBe(50)
    expect(steppedZoom("out", 23)).toBe(10)
    expect(steppedZoom("in", 400)).toBe(400)
    expect(steppedZoom("out", 10)).toBe(10)
    expect(steppedZoom("in", 900)).toBe(400)
    expect(steppedZoom("out", 4)).toBe(10)
  })
})

describe("typed zoom", () => {
  it("reads a whole percent with or without the sign and rounds a fraction", () => {
    expect(typedZoom("64")).toBe(64)
    expect(typedZoom(" 120 % ")).toBe(120)
    expect(typedZoom("33.6%")).toBe(34)
  })

  it("holds a typed percent between 10 and 400", () => {
    expect(typedZoom("3")).toBe(10)
    expect(typedZoom("0")).toBe(10)
    expect(typedZoom("1200")).toBe(400)
  })

  it("refuses text that is not a percent", () => {
    expect(typedZoom("")).toBeNull()
    expect(typedZoom("fit")).toBeNull()
    expect(typedZoom("-20")).toBeNull()
    expect(typedZoom("5%%")).toBeNull()
  })
})

it("accepts every Grid percent and steps to its own floor", () => {
  for (const percent of [1, 4, 5, 7, 9, 400]) expect(typedZoom(String(percent), zoomRanges.grid)).toBe(percent)
  expect(steppedZoom("out", 10, zoomRanges.grid)).toBe(5)
  expect(steppedZoom("out", 5, zoomRanges.grid)).toBe(1)
  expect(steppedZoom("in", 1, zoomRanges.grid)).toBe(5)
})
