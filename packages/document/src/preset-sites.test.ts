import { expect, it } from "vitest"
import { siteLimit } from "./preset-sites.js"
import { presets } from "./trait-geometry.js"
import { siteSpot } from "./site-tie.spec.js"

const count = (preset: (typeof presets)[number]) => {
  let sites = 0
  while (siteSpot(preset, 200, 100, {}, sites) !== null) sites += 1
  return sites
}

it("bounds a connection's site by the most sites any preset in doom's table has", () => {
  expect(Math.max(...presets.map(count))).toBe(siteLimit)
})
