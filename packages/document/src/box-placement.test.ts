import { describe, expect, it } from "vitest"
import { fitNewBox, fittedInside, pictureSize, placeNewBox } from "./box-placement.js"
import type { Box } from "./box.js"

const slide = { width: 12_192_000, height: 6_858_000 }

function overlaps(left: Box, right: Box): boolean {
  return (
    left.x < right.x + right.cx &&
    right.x < left.x + left.cx &&
    left.y < right.y + right.cy &&
    right.y < left.y + left.cy
  )
}

describe("placing a new text box", () => {
  it("centres the default box on an empty slide", () => {
    const placed = placeNewBox(slide, [])
    expect(placed.cx).toBe(Math.round(slide.width * 0.4))
    expect(placed.cy).toBe(Math.round(slide.height * 0.12))
    expect(placed.x).toBe(Math.round((slide.width - placed.cx) / 2))
    expect(placed.y).toBe(Math.round((slide.height - placed.cy) / 2))
  })

  it("lands below a title and a subtitle that sit in the middle of a blank title slide", () => {
    const title = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }
    const subtitle = { x: 1_524_000, y: 3_602_038, cx: 9_144_000, cy: 1_655_762 }
    const placed = placeNewBox(slide, [title, subtitle])
    expect(overlaps(placed, title)).toBe(false)
    expect(overlaps(placed, subtitle)).toBe(false)
    expect(placed.y).toBeGreaterThanOrEqual(subtitle.y + subtitle.cy)
    expect(placed.y + placed.cy).toBeLessThanOrEqual(slide.height)
  })

  it("lands in the free column beside a left half that holds text", () => {
    const left = { x: 0, y: 0, cx: 6_000_000, cy: 6_858_000 }
    const placed = placeNewBox(slide, [left])
    expect(overlaps(placed, left)).toBe(false)
    expect(placed.x + placed.cx).toBeLessThanOrEqual(slide.width)
  })

  it("puts two boxes added in a row in different places", () => {
    const first = placeNewBox(slide, [])
    const second = placeNewBox(slide, [first])
    expect(overlaps(first, second)).toBe(false)
  })

  it("falls back to the centre, away from a box exactly there, when nothing is free", () => {
    const full = { x: 0, y: 0, cx: slide.width, cy: slide.height }
    const centred = placeNewBox(slide, [full])
    const again = placeNewBox(slide, [full, centred])
    expect(centred).toEqual(placeNewBox(slide, []))
    expect(again.x === centred.x && again.y === centred.y).toBe(false)
    expect(again.x + again.cx).toBeLessThanOrEqual(slide.width)
    expect(again.y + again.cy).toBeLessThanOrEqual(slide.height)
  })

  it("keeps the box on the slide when it is offset from the centre again and again", () => {
    const full = { x: 0, y: 0, cx: slide.width, cy: slide.height }
    const taken: Box[] = [full]
    for (let count = 0; count < 40; count += 1) {
      const placed = placeNewBox(slide, taken)
      expect(placed.x).toBeGreaterThanOrEqual(0)
      expect(placed.y).toBeGreaterThanOrEqual(0)
      expect(placed.x + placed.cx).toBeLessThanOrEqual(slide.width)
      expect(placed.y + placed.cy).toBeLessThanOrEqual(slide.height)
      taken.push(placed)
    }
  })

  it("ignores boxes with no area", () => {
    expect(placeNewBox(slide, [{ x: 100, y: 100, cx: 0, cy: 0 }])).toEqual(placeNewBox(slide, []))
  })

  it("chooses the same place every time", () => {
    const taken = [{ x: 0, y: 0, cx: 4_000_000, cy: 2_000_000 }]
    expect(placeNewBox(slide, taken)).toEqual(placeNewBox(slide, taken))
  })

  it("places a picture of its own size in the same clear space as a text box", () => {
    const title = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }
    const subtitle = { x: 1_524_000, y: 3_602_038, cx: 9_144_000, cy: 1_655_762 }
    const picture = { cx: Math.round(slide.width * 0.6), cy: 3 * 370_840 }
    const placed = placeNewBox(slide, [title, subtitle], picture)
    expect(placed).toMatchObject(picture)
    expect(overlaps(placed, title)).toBe(false)
    expect(overlaps(placed, subtitle)).toBe(false)
  })

  it("centres a size no free area fits, such as a picture as large as the slide", () => {
    const picture = { cx: Math.round(slide.width * 0.9), cy: Math.round(slide.height * 0.9) }
    const title = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }
    expect(placeNewBox(slide, [title], picture)).toEqual({
      x: Math.round((slide.width - picture.cx) / 2),
      y: Math.round((slide.height - picture.cy) / 2),
      ...picture,
    })
  })

  it("counts a line, which has no height, as taken", () => {
    const line = { x: 3_000_000, y: 3_429_000, cx: 6_000_000, cy: 0 }
    const upright = { x: 6_096_000, y: 500_000, cx: 0, cy: 5_800_000 }
    for (const stroke of [line, upright]) {
      const placed = placeNewBox(slide, [stroke], { cx: 1_371_600, cy: 1_371_600 })
      expect(overlaps(placed, { ...stroke, cx: Math.max(stroke.cx, 1), cy: Math.max(stroke.cy, 1) })).toBe(false)
    }
  })
})

describe("fitting a new picture", () => {
  const title = { x: 914_400, y: 1_828_800, cx: 10_363_200, cy: 1_371_600 }
  const subtitle = { x: 914_400, y: 3_429_000, cx: 10_363_200, cy: 1_371_600 }

  it("places a picture that fits clear space at its own size, as a new box", () => {
    const icon = { cx: 914_400, cy: 914_400 }
    expect(fitNewBox(slide, [title, subtitle], icon)).toEqual(placeNewBox(slide, [title, subtitle], icon))
  })

  it("shrinks a picture at its ratio into the largest clear area of a new title slide", () => {
    const picture = { cx: 4_572_000, cy: 3_048_000 }
    const placed = fitNewBox(slide, [title, subtitle], picture)
    expect(overlaps(placed, title)).toBe(false)
    expect(overlaps(placed, subtitle)).toBe(false)
    expect(placed.cx / placed.cy).toBeCloseTo(1.5, 2)
    expect(placed.y - (subtitle.y + subtitle.cy)).toBeGreaterThanOrEqual(Math.round(slide.height * 0.02))
    expect(placed.y + placed.cy).toBeLessThanOrEqual(slide.height - Math.round(slide.height * 0.04))
    expect(placed.x).toBe(Math.round((slide.width - placed.cx) / 2))
  })

  it("covers the slide's middle when the clear space would leave the picture smaller than a fifth of the slide's height", () => {
    const content = { x: 838_200, y: 1_825_625, cx: 10_515_600, cy: 4_351_338 }
    const heading = { x: 838_200, y: 365_125, cx: 10_515_600, cy: 1_325_563 }
    const picture = { cx: 4_572_000, cy: 3_048_000 }
    expect(fitNewBox(slide, [heading, content], picture)).toEqual(placeNewBox(slide, [heading, content], picture))
  })
})

describe("an image's frame from its pixel size", () => {
  it("sizes an image at 96 pixels an inch, shrunk to nine tenths of the slide", () => {
    const area = { width: 12_192_000, height: 6_858_000 }
    expect(pictureSize({ width: 480, height: 320 }, area)).toEqual({ cx: 4_572_000, cy: 3_048_000 })
    const wide = pictureSize({ width: 4000, height: 1000 }, area)
    expect(wide.cx).toBe(Math.round(12_192_000 * 0.9))
    expect(wide.cx / wide.cy).toBeCloseTo(4, 3)
  })

  it("places an image whole inside a box at its own proportions, centred", () => {
    const box = { x: 1_000_000, y: 1_000_000, cx: 4_000_000, cy: 1_000_000 }
    expect(fittedInside(box, { width: 200, height: 100 })).toEqual({
      x: 2_000_000,
      y: 1_000_000,
      cx: 2_000_000,
      cy: 1_000_000,
    })
    expect(fittedInside(box, { width: 800, height: 100 })).toEqual({
      x: 1_000_000,
      y: 1_250_000,
      cx: 4_000_000,
      cy: 500_000,
    })
  })
})
