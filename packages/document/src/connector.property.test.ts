import fc from "fast-check"
import { expect, it } from "vitest"
import { connectorEnds, routed, routedPresets, siteTie, type Tie } from "./connector.js"
import type { Place } from "./group-place.js"
import { siteCount } from "./preset-sites.js"
import { presets } from "./trait-geometry.js"

const turns = fc.oneof(fc.constantFrom(0, 5_400_000, 10_800_000, 16_200_000), fc.integer({ min: 0, max: 21_599_999 }))

const placement: fc.Arbitrary<Place> = fc.record({
  box: fc.record({
    x: fc.integer({ min: -2_000_000, max: 12_000_000 }),
    y: fc.integer({ min: -2_000_000, max: 7_000_000 }),
    cx: fc.integer({ min: 1, max: 4_000_000 }),
    cy: fc.integer({ min: 1, max: 4_000_000 }),
  }),
  rot: turns,
  flipH: fc.boolean(),
  flipV: fc.boolean(),
})

const outline = fc
  .constantFrom(...presets.filter((preset) => siteCount(preset) > 0))
  .chain((preset) =>
    fc.record({ preset: fc.constant(preset), site: fc.integer({ min: 0, max: siteCount(preset) - 1 }) }),
  )

type Spot = { readonly x: number; readonly y: number }

const near = (left: Spot, right: Spot, within: number) =>
  Math.abs(left.x - right.x) <= within && Math.abs(left.y - right.y) <= within

const halfPoint = 6_350

const levelU = (start: Tie, end: Tie): boolean => {
  const gap = { x: end.spot.x - start.spot.x, y: end.spot.y - start.spot.y }
  const apart = gap.x !== 0 || gap.y !== 0
  const sameWay = start.way.x === end.way.x && start.way.y === end.way.y
  return apart && sameWay && gap.x * start.way.x + gap.y * start.way.y === 0
}

const straight: readonly string[] = ["line", "straightConnector1"]
const quarters: readonly number[] = [0, 5_400_000, 10_800_000, 16_200_000]

it("puts every bound end on its site, whatever the shapes' places, turns, flips and presets, but for half a point on an elbow U whose ends sit level, which PowerPoint stores one point wide", () => {
  fc.assert(
    fc.property(
      placement,
      fc.constantFrom(...routedPresets),
      placement,
      outline,
      placement,
      outline,
      (connector, preset, from, fromOutline, to, toOutline) => {
        const start = siteTie(from, { preset: fromOutline.preset, adjust: {} }, fromOutline.site)
        const end = siteTie(to, { preset: toOutline.preset, adjust: {} }, toOutline.site)
        if (start === null || end === null) throw new Error("site")
        const once = routed(connector, preset, {}, start, end)
        if (once === null) throw new Error("route")
        const ends = connectorEnds(once.place)
        const within = !straight.includes(preset) && levelU(start, end) ? halfPoint : 2
        expect(near(ends.start, start.spot, within) && near(ends.end, end.spot, within)).toBe(true)
        if (straight.includes(preset)) expect(once.place.rot).toBe(connector.rot)
        else expect(quarters).toContain(once.place.rot)
        expect(Object.values(once.adjust).every(Number.isSafeInteger)).toBe(true)
        expect(routed(once.place, preset, once.adjust, start, end)).toEqual(once)
      },
    ),
    { numRuns: 400 },
  )
})
