import { describe, expect, it } from "vitest"
import { reachOf, type Bounds, type SnapTargets } from "./snapping.js"
import { snappedTextDraw } from "./text-draw-snap.js"

const slide: Bounds = { left: 0, top: 0, right: 12_192_000, bottom: 6_858_000 }
const perPixel = 15_240
const reach = reachOf(800, slide.right)
const card: Bounds = { left: 3_000_000, top: 1_000_000, right: 5_000_000, bottom: 2_000_000 }
const targets: SnapTargets = { layers: [card], slide, guides: { x: [7_000_000], y: [] } }

describe("snappedTextDraw", () => {
  it("snaps the pressed corner and the dragged corner to a layer's edges at 4.4 px, not at 4.6 px", () => {
    const from = { x: card.left + Math.round(4.4 * perPixel), y: 2_500_000 }
    const to = { x: 6_000_000, y: card.top - Math.round(4.4 * perPixel) }
    const snapped = snappedTextDraw(from, to, targets, reach, false)
    expect(snapped.from).toEqual({ x: card.left, y: 2_500_000 })
    expect(snapped.to).toEqual({ x: 6_000_000, y: card.top })
    const far = snappedTextDraw(
      { x: card.left + Math.round(4.6 * perPixel), y: 2_500_000 },
      { x: 6_000_000, y: card.top - Math.round(4.6 * perPixel) },
      targets,
      reach,
      false,
    )
    expect(far.from.x).toBe(card.left + Math.round(4.6 * perPixel))
    expect(far.to.y).toBe(card.top - Math.round(4.6 * perPixel))
  })

  it("snaps to a shown guide, and draws a red guide along the box edge that lines up with a layer", () => {
    const onGuide = snappedTextDraw(
      { x: 6_000_000, y: 3_000_000 },
      { x: 7_000_000 - 2 * perPixel, y: 4_000_000 },
      targets,
      reach,
      false,
    )
    expect(onGuide.to.x).toBe(7_000_000)
    const underCard = snappedTextDraw(
      { x: 3_500_000, y: 3_000_000 },
      { x: card.right + 3 * perPixel, y: 4_000_000 },
      targets,
      reach,
      false,
    )
    expect(underCard.to.x).toBe(card.right)
    expect(underCard.guides).toContainEqual(
      expect.objectContaining({ kind: "snap", axis: "x", at: card.right, from: card.top, to: 4_000_000 }),
    )
  })

  it("leaves both corners under the pointer and draws no guide while Control is held", () => {
    const from = { x: card.left + 2 * perPixel, y: 2_500_000 }
    const to = { x: 7_000_000 - 2 * perPixel, y: 4_000_000 }
    expect(snappedTextDraw(from, to, targets, reach, true)).toEqual({ from, to, guides: [] })
  })
})
