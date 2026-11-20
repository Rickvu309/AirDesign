import { describe, expect, it } from "vitest"
import { pastedOffset, pastedOver } from "./paste-place.js"

const slide = { width: 12_000, height: 6_000 }
const square = (x: number, y: number, side = 1000) => ({ x, y, cx: side, cy: side })

describe("paste place", () => {
  it("keeps the layers' place on the slide", () => {
    expect(pastedOffset([square(100, 200), square(1500, 300)], slide, null)).toEqual({ dx: 0, dy: 0 })
  })

  it("keeps a place partly off the slide", () => {
    expect(pastedOffset([square(11_500, -400)], slide, null)).toEqual({ dx: 0, dy: 0 })
  })

  it("centers on each side the slide cannot hold the place", () => {
    expect(pastedOffset([square(13_000, 200)], slide, null)).toEqual({ dx: 5500 - 13_000, dy: 0 })
    expect(pastedOffset([square(100, -2000)], slide, null)).toEqual({ dx: 0, dy: 2500 + 2000 })
  })

  it("centers several layers as one by their bounds", () => {
    expect(pastedOffset([square(13_000, 0), square(14_000, 0)], slide, null)).toEqual({ dx: 5000 - 13_000, dy: 0 })
  })

  it("moves the layers to the center of the view when their place is out of it", () => {
    const view = { x: 6000, y: 3000, cx: 2000, cy: 2000 }
    expect(pastedOffset([square(100, 200)], slide, view)).toEqual({ dx: 6500 - 100, dy: 3500 - 200 })
    expect(pastedOffset([square(6500, 3500)], slide, view)).toEqual({ dx: 0, dy: 0 })
    expect(pastedOffset([square(5500, 2500)], slide, view)).toEqual({ dx: 0, dy: 0 })
  })

  it("puts the layers' top left on the selection's top left", () => {
    expect(pastedOver([square(100, 200), square(1500, 300)], [square(4000, 5000), square(3000, 5500)])).toEqual({
      dx: 2900,
      dy: 4800,
    })
  })
})
