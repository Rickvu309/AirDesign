import { expect, it } from "vitest"
import { connectorEnds, routed, type Tie } from "./connector.js"
import type { Place } from "./group-place.js"
import { presets } from "./trait-geometry.js"
import { siteTie } from "./site-tie.spec.js"

type Spot = { readonly x: number; readonly y: number }

const near = (left: Spot, right: Spot, within: number) =>
  Math.abs(left.x - right.x) <= within && Math.abs(left.y - right.y) <= within

const rounding = 2

const halfPoint = 6_350

const pointWide = 12_700

const levelAlongStart = (start: Tie, end: Tie): boolean => {
  const gap = { x: end.spot.x - start.spot.x, y: end.spot.y - start.spot.y }
  const apart = gap.x !== 0 || gap.y !== 0
  return apart && gap.x * start.way.x + gap.y * start.way.y === 0
}

const straight: readonly string[] = ["line", "straightConnector1"]
const quarters: readonly number[] = [0, 5_400_000, 10_800_000, 16_200_000]

type Outlined = { readonly preset: (typeof presets)[number]; readonly site: number }

function holds(connector: Place, preset: string, from: Place, fromOutline: Outlined, to: Place, toOutline: Outlined) {
  const start = siteTie(from, { preset: fromOutline.preset, adjust: {} }, fromOutline.site)
  const end = siteTie(to, { preset: toOutline.preset, adjust: {} }, toOutline.site)
  if (start === null || end === null) throw new Error("site")
  const once = routed(connector, preset, {}, start, end)
  if (once === null) throw new Error("route")
  const ends = connectorEnds(once.place)
  const pointWideElbow = !straight.includes(preset) && levelAlongStart(start, end) && once.place.box.cx === pointWide
  const within = pointWideElbow ? halfPoint + rounding : rounding
  expect(near(ends.start, start.spot, within) && near(ends.end, end.spot, within)).toBe(true)
  if (straight.includes(preset)) expect(once.place.rot).toBe(connector.rot)
  else expect(quarters).toContain(once.place.rot)
  expect(Object.values(once.adjust).every(Number.isSafeInteger)).toBe(true)
  expect(routed(once.place, preset, once.adjust, start, end)).toEqual(once)
}

it("keeps a curved elbow from a flipped rectangle's bottom site to an arc's centre site level with its start one point wide, its ends within half a point, as in issue 1177", () => {
  const upright = { rot: 0, flipH: false, flipV: false }
  holds(
    { box: { x: 0, y: 0, cx: 1, cy: 1 }, ...upright },
    "curvedConnector3",
    { box: { x: 0, y: 2, cx: 1, cy: 1 }, ...upright, flipV: true },
    { preset: "rect", site: 2 },
    { box: { x: 0, y: -2, cx: 3, cy: 7 }, ...upright },
    { preset: "arc", site: 1 },
  )
})
