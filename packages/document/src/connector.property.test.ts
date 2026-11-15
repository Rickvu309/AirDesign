import fc from "fast-check"
import { expect, it } from "vitest"
import { connectorEnds, routed, routedPresets, siteTie } from "./connector.js"
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

const straight: readonly string[] = ["line", "straightConnector1"]
const quarters: readonly number[] = [0, 5_400_000, 10_800_000, 16_200_000]

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
        const start = siteTie(from, { preset: fromOutline.preset, adjust: {} }, fromOutline.site)
        const end = siteTie(to, { preset: toOutline.preset, adjust: {} }, toOutline.site)
        if (start === null || end === null) throw new Error("site")
        const once = routed(connector, preset, {}, start, end)
        if (once === null) throw new Error("route")
        const ends = connectorEnds(once.place)
        expect(near(ends.start, start.spot) && near(ends.end, end.spot)).toBe(true)
        if (straight.includes(preset)) expect(once.place.rot).toBe(connector.rot)
        else expect(quarters).toContain(once.place.rot)
        expect(Object.values(once.adjust).every(Number.isSafeInteger)).toBe(true)
        expect(routed(once.place, preset, once.adjust, start, end)).toEqual(once)
      },
    ),
    { numRuns: 400 },
  )
})
