import { describe, expect, it } from "vitest"
import {
  boundedFactor,
  centredAt,
  placedScroll,
  selectionFactor,
  stagePadding,
  unionRect,
  viewCentre,
  wheelZoomFactor,
  zoomedAbout,
} from "@/editor/canvas-viewport"

const slide = { left: 100, top: 50, width: 800, height: 450 }
const wheel = { deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, ctrlKey: true, metaKey: false }

function under(rect: typeof slide, point: { x: number; y: number }) {
  return { x: (point.x - rect.left) / rect.width, y: (point.y - rect.top) / rect.height }
}

describe("canvas viewport", () => {
  it("keeps the slide point under the cursor still while zooming about it", () => {
    const cursor = { x: 412, y: 300 }
    const zoomed = zoomedAbout(slide, 1.75, cursor)
    expect(zoomed.width).toBe(1400)
    expect(zoomed.height).toBeCloseTo(787.5)
    expect(under(zoomed, cursor).x).toBeCloseTo(under(slide, cursor).x)
    expect(under(zoomed, cursor).y).toBeCloseTo(under(slide, cursor).y)
    const back = zoomedAbout(zoomed, 1 / 1.75, cursor)
    expect(back.left).toBeCloseTo(slide.left)
    expect(back.top).toBeCloseTo(slide.top)
  })

  it("zooms in on a wheel turned up or a pinch stretched apart, and out the other way", () => {
    expect(wheelZoomFactor({ ...wheel, deltaY: -4 })).toBeCloseTo(Math.exp(0.04))
    expect(wheelZoomFactor({ ...wheel, deltaY: 4 })).toBeCloseTo(Math.exp(-0.04))
    expect(wheelZoomFactor({ ...wheel, deltaY: -100 })).toBeCloseTo(Math.exp(0.1))
    expect(wheelZoomFactor({ ...wheel, deltaY: 3, deltaMode: 1 })).toBeCloseTo(Math.exp(-0.1))
  })

  it("stops a zoom at the least and most slide width", () => {
    const limits = { least: 128, most: 5120 }
    expect(boundedFactor(800, 10, limits)).toBeCloseTo(6.4)
    expect(boundedFactor(800, 0.1, limits)).toBeCloseTo(0.16)
    expect(boundedFactor(800, 1.5, limits)).toBe(1.5)
    expect(boundedFactor(5120, 1.2, limits)).toBe(1)
  })

  it("fits the selection inside the view with a 48 px margin", () => {
    const view = { left: 0, top: 0, width: 1000, height: 700 }
    expect(selectionFactor({ left: 0, top: 0, width: 100, height: 50 }, view)).toBeCloseTo(9.04)
    expect(selectionFactor({ left: 0, top: 0, width: 100, height: 300 }, view)).toBeCloseTo(604 / 300)
  })

  it("centres the selection in the view after zooming to it", () => {
    const view = { left: 0, top: 0, width: 1000, height: 700 }
    const layer = { left: 300, top: 200, width: 100, height: 50 }
    const placed = centredAt(slide, layer, 4, viewCentre(view))
    const left = placed.left + ((layer.left - slide.left) / slide.width) * placed.width
    const top = placed.top + ((layer.top - slide.top) / slide.height) * placed.height
    expect(placed.width).toBe(3200)
    expect(left + 200).toBeCloseTo(500)
    expect(top + 100).toBeCloseTo(350)
  })

  it("joins the frames of a selection into one box", () => {
    expect(
      unionRect([
        { left: 10, top: 20, width: 30, height: 40 },
        { left: 50, top: 5, width: 10, height: 10 },
      ]),
    ).toEqual({ left: 10, top: 5, width: 50, height: 55 })
    expect(unionRect([])).toBeNull()
  })

  it("scrolls by how far the laid out slide sits from where the zoom wants it", () => {
    expect(placedScroll({ left: 200, top: 80 }, { left: 140, top: 60 }, { left: 100, top: 70 })).toEqual({
      left: 240,
      top: 70,
    })
  })

  it("leaves room past a zoomed slide for any of its points to reach the cursor, and the designed inset at fit", () => {
    expect(stagePadding({ width: 1200, height: 800 }, false)).toEqual({ inline: 1136, block: 736 })
    expect(stagePadding({ width: 40, height: 30 }, false)).toEqual({ inline: 31, block: 40 })
    expect(stagePadding({ width: 1200, height: 800 }, true)).toBeNull()
  })

  it("puts the centre of the view above the toolbar overlay", () => {
    expect(viewCentre({ left: 300, top: 60, width: 900, height: 700 })).toEqual({ x: 750, y: 410 })
  })
})
