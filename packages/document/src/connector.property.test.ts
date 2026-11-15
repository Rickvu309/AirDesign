import fc from "fast-check"
import { expect, it } from "vitest"
import { connectorEnds, routedPlace, routedPresets, sitePoint } from "./connector.js"
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

const near = (left: { x: number; y: number }, right: { x: number; y: number }) =>
  Math.abs(left.x - right.x) <= 2 && Math.abs(left.y - right.y) <= 2

it("puts every bound end on its site, whatever the shapes' places, turns, flips and presets", () => {
  fc.assert(
    fc.property(
      placement,
      fc.constantFrom(...routedPresets),
      placement,
      outline,
      placement,
      outline,
      (connector, preset, from, fromOutline, to, toOutline) => {
        const start = sitePoint(from, { preset: fromOutline.preset, adjust: {} }, fromOutline.site)
        const end = sitePoint(to, { preset: toOutline.preset, adjust: {} }, toOutline.site)
        if (start === null || end === null) throw new Error("site")
        const routed = routedPlace(connector, preset, start, end)
        if (routed === null) throw new Error("route")
        const ends = connectorEnds(routed)
        expect(near(ends.start, start) && near(ends.end, end)).toBe(true)
        expect(routed.rot).toBe(connector.rot)
        expect(routedPlace(routed, preset, start, end)).toEqual(routed)
      },
    ),
    { numRuns: 400 },
  )
})
