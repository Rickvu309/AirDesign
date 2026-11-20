import { describe, expect, it } from "vitest"
import { constrainLineEnd, snapConnectorEnd } from "./connector-snap.js"
import { layoutSnapLines } from "./layout-guide-lines.js"
import { reachOf, type Bounds, type SnapTargets } from "./snapping.js"

const slide: Bounds = { left: 0, top: 0, right: 12_192_000, bottom: 6_858_000 }
const perPixel = 15_240
const reach = reachOf(800, slide.right)

const plain = { shiftKey: false, ctrlKey: false }
const shift = { shiftKey: true, ctrlKey: false }
const ctrl = { shiftKey: false, ctrlKey: true }
const shiftCtrl = { shiftKey: true, ctrlKey: true }

function box(left: number, top: number, width: number, height: number): Bounds {
  return { left, top, right: left + width, bottom: top + height }
}

function targets(
  layers: readonly Bounds[],
  guides?: { readonly x: readonly number[]; readonly y: readonly number[] },
): SnapTargets {
  return guides === undefined ? { layers, slide } : { layers, slide, guides }
}

describe("constrainLineEnd", () => {
  const from = { x: 1_000_000, y: 2_000_000 }

  it("holds every octant to exact 45-degree steps around the anchor end", () => {
    expect(constrainLineEnd(from, { x: 2_000_000, y: 2_150_000 })).toEqual({ x: 2_000_000, y: 2_000_000 })
    expect(constrainLineEnd(from, { x: 200_000, y: 1_900_000 })).toEqual({ x: 200_000, y: 2_000_000 })
    expect(constrainLineEnd(from, { x: 1_120_000, y: 3_500_000 })).toEqual({ x: 1_000_000, y: 3_500_000 })
    expect(constrainLineEnd(from, { x: 900_000, y: 500_000 })).toEqual({ x: 1_000_000, y: 500_000 })

    const downRight = constrainLineEnd(from, { x: 1_800_000, y: 3_000_000 })
    expect(downRight).toEqual({ x: 1_900_000, y: 2_900_000 })
    expect(Math.abs(downRight.x - from.x)).toBe(Math.abs(downRight.y - from.y))

    const downLeft = constrainLineEnd(from, { x: 200_000, y: 2_600_000 })
    expect(downLeft).toEqual({ x: 300_000, y: 2_700_000 })
    expect(Math.abs(downLeft.x - from.x)).toBe(Math.abs(downLeft.y - from.y))

    const upLeft = constrainLineEnd(from, { x: 400_000, y: 1_200_000 })
    expect(upLeft).toEqual({ x: 300_000, y: 1_300_000 })
    expect(Math.abs(upLeft.x - from.x)).toBe(Math.abs(upLeft.y - from.y))

    const upRight = constrainLineEnd(from, { x: 1_600_000, y: 1_200_000 })
    expect(upRight).toEqual({ x: 1_700_000, y: 1_300_000 })
    expect(Math.abs(upRight.x - from.x)).toBe(Math.abs(upRight.y - from.y))
  })
})

describe("snapConnectorEnd", () => {
  const from = { x: 508_000, y: 6_070_600 }
  const card = box(3_000_000, 1_000_000, 2_000_000, 1_000_000)

  it("snaps a free end to a layer edge and center at 4.4 px, not at 4.6 px, and shows red guides", () => {
    const within = { x: Math.round(card.left + 4.4 * perPixel), y: 2_500_000 }
    const snapped = snapConnectorEnd(from, within, targets([card]), reach, plain)
    expect(snapped.at).toEqual({ x: card.left, y: 2_500_000 })
    expect(snapped.guides).toEqual([
      {
        kind: "snap",
        axis: "x",
        at: card.left,
        from: card.top,
        to: 2_500_000,
        marks: [card.top, card.bottom, 2_500_000],
      },
    ])

    const beyond = { x: Math.round(card.left + 4.6 * perPixel), y: 2_500_000 }
    expect(snapConnectorEnd(from, beyond, targets([card]), reach, plain)).toEqual({ at: beyond, guides: [] })

    const zoomedOut = reachOf(1600, slide.right)
    expect(
      snapConnectorEnd(from, { x: card.left + 3 * perPixel, y: 2_500_000 }, targets([card]), zoomedOut, plain).at.x,
    ).toBe(card.left + 3 * perPixel)

    const nearCenter = { x: 4_000_000 + 30_000, y: 1_500_000 - 30_000 }
    const centered = snapConnectorEnd(from, nearCenter, targets([card]), reach, plain)
    expect(centered.at).toEqual({ x: 4_000_000, y: 1_500_000 })
    expect(centered.guides.map((guide) => guide.axis)).toEqual(["x", "y"])
  })

  it("snaps a free end to the opposite end so horizontal and vertical lines stay level, with a red guide", () => {
    const nearLevel = { x: 11_684_000, y: from.y + 30_000 }
    const snapped = snapConnectorEnd(from, nearLevel, targets([]), reach, plain)
    expect(snapped.at).toEqual({ x: 11_684_000, y: from.y })
    expect(snapped.guides).toEqual([
      { kind: "snap", axis: "y", at: from.y, from: from.x, to: 11_684_000, marks: [from.x, 11_684_000] },
    ])
  })

  it("snaps to slide edges, slide center, ruler guides, layout columns and grid lines", () => {
    const tone = { color: "FF0000", opacity: 10, shown: true }
    const columns = layoutSnapLines(
      [{ pattern: "columns", count: 12, align: "stretch", size: 0, offset: 508_000, gutter: 127_000, ...tone }],
      slide.right,
      slide.bottom,
    )
    const grid = layoutSnapLines(
      [{ pattern: "grid", size: 508_000, count: 0, align: "stretch", offset: 0, gutter: 0, ...tone }],
      slide.right,
      slide.bottom,
    )

    const onMargin = snapConnectorEnd(
      from,
      { x: 11_684_000 - 30_000, y: from.y + 20_000 },
      targets([], columns),
      reach,
      plain,
    )
    expect(onMargin.at).toEqual({ x: 11_684_000, y: from.y })

    const onRuler = snapConnectorEnd(
      from,
      { x: 2_250_000 + 40_000, y: 3_250_000 - 30_000 },
      targets([], { x: [2_250_000], y: [3_250_000] }),
      reach,
      plain,
    )
    expect(onRuler.at).toEqual({ x: 2_250_000, y: 3_250_000 })
    expect(onRuler.guides).toEqual([])

    const onGrid = snapConnectorEnd(
      from,
      { x: 1_016_000 + 25_000, y: 1_524_000 - 25_000 },
      targets([], grid),
      reach,
      plain,
    )
    expect(onGrid.at).toEqual({ x: 1_016_000, y: 1_524_000 })

    const onCenter = snapConnectorEnd(
      from,
      { x: slide.right / 2 + 20_000, y: slide.bottom / 2 - 20_000 },
      targets([]),
      reach,
      plain,
    )
    expect(onCenter.at).toEqual({ x: slide.right / 2, y: slide.bottom / 2 })
    expect(onCenter.guides).toEqual([
      { kind: "snap", axis: "x", at: slide.right / 2, from: 0, to: slide.bottom, marks: [slide.bottom / 2] },
      { kind: "snap", axis: "y", at: slide.bottom / 2, from: 0, to: slide.right, marks: [slide.right / 2] },
    ])
  })

  it("turns snapping off and hides guides when Control is held", () => {
    const near = { x: card.left + 20_000, y: from.y + 20_000 }
    expect(snapConnectorEnd(from, near, targets([card]), reach, ctrl)).toEqual({ at: near, guides: [] })
  })

  it("holds horizontal with Shift and snaps X along the ray without letting a nearby Y target slant the line", () => {
    const nearbyShelf = box(3_000_000, from.y + 30_000, 1_000_000, 500_000)
    const snapped = snapConnectorEnd(
      from,
      { x: 3_000_000 + 25_000, y: from.y + 250_000 },
      targets([nearbyShelf]),
      reach,
      shift,
    )
    expect(snapped.at).toEqual({ x: 3_000_000, y: from.y })
    expect(snapped.guides).toHaveLength(1)
    expect(snapped.guides[0]).toMatchObject({ kind: "snap", axis: "x", at: 3_000_000 })
  })

  it("holds vertical with Shift and snaps Y along the ray without letting a nearby X target slant the line", () => {
    const nearbyWall = box(from.x + 30_000, 3_000_000, 1_000_000, 500_000)
    const snapped = snapConnectorEnd(
      from,
      { x: from.x + 250_000, y: 3_000_000 - 25_000 },
      targets([nearbyWall]),
      reach,
      shift,
    )
    expect(snapped.at).toEqual({ x: from.x, y: 3_000_000 })
    expect(snapped.guides).toHaveLength(1)
    expect(snapped.guides[0]).toMatchObject({ kind: "snap", axis: "y", at: 3_000_000 })
  })

  it("keeps an exact 45-degree diagonal when Shift snaps to the nearer X or Y target", () => {
    const anchor = { x: 1_000_000, y: 5_000_000 }
    const edge = box(3_020_000, 2_950_000, 500_000, 500_000)
    const snapped = snapConnectorEnd(anchor, { x: 3_000_000, y: 3_000_000 }, targets([edge]), reach, shift)
    expect(snapped.at).toEqual({ x: 3_020_000, y: 2_980_000 })
    expect(Math.abs(snapped.at.x - anchor.x)).toBe(Math.abs(snapped.at.y - anchor.y))
    expect(snapped.guides).toHaveLength(1)
    expect(snapped.guides[0]).toMatchObject({ kind: "snap", axis: "x", at: 3_020_000 })
  })

  it("holds the 45-degree angle without snapping when Shift and Control are both held", () => {
    const snapped = snapConnectorEnd(
      from,
      { x: card.left + 20_000, y: from.y + 200_000 },
      targets([card]),
      reach,
      shiftCtrl,
    )
    expect(snapped).toEqual({ at: { x: card.left + 20_000, y: from.y }, guides: [] })
  })
})
