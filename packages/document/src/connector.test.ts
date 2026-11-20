import { describe, expect, it } from "vitest"
import { connectorEnds, elbowClearance, outlineOf, routed, siteTie, sitePoint, type Tie } from "./connector.js"
import { siteCount } from "./preset-sites.js"

const upright = { rot: 0, flipH: false, flipV: false }
const picture = { box: { x: 4358398, y: 3042697, cx: 895278, cy: 914400 }, ...upright }
const card = { box: { x: 3948437, y: 4728663, cx: 914400, cy: 914400 }, ...upright }
const rect = { preset: "rect", adjust: {} } as const
const line = { box: { x: 4405637, y: 3957097, cx: 400400, cy: 771566 }, rot: 0, flipH: true, flipV: false }

describe("a connector bound to two shapes", () => {
  it("reads the census line's ends on the picture's bottom site and the rectangle's top site", () => {
    const start = sitePoint(picture, rect, 2)
    const end = sitePoint(card, rect, 0)
    expect(start).toEqual({ x: 4806037, y: 3957097 })
    expect(end).toEqual({ x: 4405637, y: 4728663 })
    expect(connectorEnds(line)).toEqual({ start, end })
  })

  it("routes the census line to the box and flips PowerPoint wrote, and keeps them after the rectangle moves", () => {
    const start = sitePoint(picture, rect, 2)
    const bottom = siteTie(picture, rect, 2)
    expect(bottom?.spot).toEqual(start)
    expect(routed(line, "line", {}, bottom, siteTie(card, rect, 0))).toEqual({
      place: line,
      preset: "line",
      adjust: {},
    })
    const moved = { ...card, box: { ...card.box, x: card.box.x + 254000 } }
    expect(routed(line, "line", {}, bottom, siteTie(moved, rect, 0))?.place).toEqual({
      box: { x: 4659637, y: 3957097, cx: 146400, cy: 771566 },
      rot: 0,
      flipH: true,
      flipV: false,
    })
  })

  it("keeps a free end where it is when only the other end is bound", () => {
    const free = { box: { x: 7202184, y: 3771276, cx: 479913, cy: 21689 }, rot: 0, flipH: false, flipV: true }
    const snipped = { box: { x: 7682097, y: 3039756, cx: 1238464, cy: 1463040 }, ...upright }
    const end = sitePoint(snipped, { preset: "snip2DiagRect", adjust: {} }, 2)
    expect(end).toEqual({ x: 7682097, y: 3771276 })
    expect(
      routed(free, "straightConnector1", {}, null, siteTie(snipped, { preset: "snip2DiagRect", adjust: {} }, 2)),
    ).toEqual({
      preset: "straightConnector1",
      place: free,
      adjust: {},
    })
  })

  it("leaves a connector whose preset no route knows to its file geometry", () => {
    const anywhere = { spot: { x: 0, y: 0 }, way: { x: 1, y: 0 } }
    expect(routed(line, "rightArrow", {}, anywhere, anywhere)).toBeNull()
  })

  it("gives an element with no preset the rectangle's four sites, and a custom outline none", () => {
    expect(outlineOf(null, {})).toEqual(rect)
    expect(outlineOf("custom", {})).toBeNull()
    expect(siteCount("rect")).toBe(4)
    expect(siteCount("ellipse")).toBe(8)
    expect(sitePoint(card, rect, 4)).toBeNull()
  })

  it("places a site through the shape's turn and flips", () => {
    const turned = { box: { x: 0, y: 0, cx: 200, cy: 100 }, rot: 5_400_000, flipH: false, flipV: false }
    expect(sitePoint(turned, rect, 3)).toEqual({ x: 100, y: 150 })
    expect(sitePoint({ ...turned, rot: 0, flipH: true }, rect, 3)).toEqual({ x: 0, y: 50 })
  })

  it("faces each site out of the shape's nearest side, through its turn and flips", () => {
    expect([0, 1, 2, 3].map((site) => siteTie(card, rect, site)?.way)).toEqual([
      { x: 0, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
    ])
    const turned = { box: { x: 0, y: 0, cx: 200, cy: 100 }, rot: 5_400_000, flipH: false, flipV: false }
    expect(siteTie(turned, rect, 3)).toEqual({ spot: { x: 100, y: 150 }, way: { x: 0, y: 1 } })
    expect(siteTie({ ...turned, rot: 0, flipH: true }, rect, 3)?.way).toEqual({ x: -1, y: 0 })
  })
})

const square = (x: number, y: number) => ({ box: { x, y, cx: 1_000_000, cy: 1_000_000 }, ...upright })
const tie = (shape: { box: { x: number; y: number; cx: number; cy: number } }, site: number): Tie => {
  const found = siteTie({ ...shape, ...upright }, rect, site)
  if (found === null) throw new Error("site")
  return found
}
const elbow = { box: { x: 0, y: 0, cx: 10, cy: 10 }, ...upright }

describe("an elbow connector's route", () => {
  it("runs right to left between two shapes with its bend midway, as PowerPoint draws it", () => {
    const left = square(1_000_000, 1_000_000)
    const right = square(4_000_000, 2_000_000)
    expect(routed(elbow, "bentConnector3", { adj1: 20_000 }, tie(left, 3), tie(right, 1))).toEqual({
      preset: "bentConnector3",
      place: { box: { x: 2_000_000, y: 1_500_000, cx: 2_000_000, cy: 1_000_000 }, ...upright },
      adjust: { adj1: 50_000 },
    })
    const above = square(4_000_000, 0)
    expect(routed(elbow, "bentConnector3", {}, tie(left, 3), tie(above, 1))).toEqual({
      preset: "bentConnector3",
      place: { box: { x: 2_000_000, y: 500_000, cx: 2_000_000, cy: 1_000_000 }, rot: 0, flipH: false, flipV: true },
      adjust: { adj1: 50_000 },
    })
  })

  it("turns past both shapes when the two sites face the same way", () => {
    const left = square(1_000_000, 1_000_000)
    const right = square(4_000_000, 2_000_000)
    const place = { box: { x: 2_000_000, y: 1_500_000, cx: 3_000_000, cy: 1_000_000 }, ...upright }
    expect(routed(elbow, "bentConnector3", {}, tie(left, 3), tie(right, 3))).toEqual({
      preset: "bentConnector3",
      place,
      adjust: { adj1: Math.round(((3_000_000 + elbowClearance) * 100_000) / 3_000_000) },
    })
    expect(routed(elbow, "bentConnector3", {}, tie(left, 1), tie(right, 1))?.adjust).toEqual({
      adj1: Math.round((-elbowClearance * 100_000) / 3_000_000),
    })
  })

  it("keeps a U under two shapes at one height a point wide, so its bend stays a finite share of that width", () => {
    const left = square(1_000_000, 1_000_000)
    const right = square(4_000_000, 1_000_000)
    const route = routed(elbow, "bentConnector3", {}, tie(left, 2), tie(right, 2))
    if (route === null) throw new Error("no route")
    expect(route.place.box.cx).toBe(12_700)
    expect(route.adjust).toEqual({ adj1: Math.round(((12_700 + elbowClearance) * 100_000) / 12_700) })
    const ends = connectorEnds(route.place)
    expect(Math.abs(ends.start.x - 1_500_000) + Math.abs(ends.start.y - 2_000_000)).toBeLessThanOrEqual(6_350)
    expect(Math.abs(ends.end.x - 4_500_000) + Math.abs(ends.end.y - 2_000_000)).toBeLessThanOrEqual(6_350)
  })

  it("puts both ends of an elbow from a site to that same site on the site, a point with its bend midway", () => {
    const dot = { box: { x: 0, y: 0, cx: 2, cy: 2 }, ...upright }
    const top = tie(dot, 0)
    expect(top.spot).toEqual({ x: 1, y: 0 })
    const route = routed(elbow, "bentConnector3", {}, top, top)
    if (route === null) throw new Error("no route")
    expect(route.place.box).toEqual({ x: 1, y: 0, cx: 0, cy: 0 })
    expect(route.adjust).toEqual({ adj1: 50_000 })
    expect(connectorEnds(route.place)).toEqual({ start: { x: 1, y: 0 }, end: { x: 1, y: 0 } })
    expect(routed(route.place, route.preset, route.adjust, top, top)).toEqual(route)
  })

  it("turns a quarter when it leaves a bottom site for a top site, with PowerPoint's turn and flips", () => {
    const top = square(1_000_000, 1_000_000)
    const below = square(3_000_000, 4_000_000)
    const { place, adjust } = routed(elbow, "bentConnector3", {}, tie(top, 2), tie(below, 0)) ?? {}
    expect(place).toEqual({
      box: { x: 1_500_000, y: 2_000_000, cx: 2_000_000, cy: 2_000_000 },
      rot: 16_200_000,
      flipH: true,
      flipV: false,
    })
    expect(adjust).toEqual({ adj1: 50_000 })
    if (place === undefined) throw new Error("route")
    expect(connectorEnds(place)).toEqual({ start: { x: 1_500_000, y: 2_000_000 }, end: { x: 3_500_000, y: 4_000_000 } })
    const belowLeft = square(-2_000_000, 4_000_000)
    expect(routed(elbow, "bentConnector3", {}, tie(top, 2), tie(belowLeft, 0))?.place).toMatchObject({
      rot: 5_400_000,
      flipH: false,
      flipV: false,
    })
  })

  it("goes around when a right site leads to a left site behind it, with a five-segment elbow", () => {
    const ahead = square(4_000_000, 1_000_000)
    const behind = square(1_000_000, 3_000_000)
    const w = 4_000_000
    expect(routed(elbow, "bentConnector5", {}, tie(ahead, 3), tie(behind, 1))).toEqual({
      preset: "bentConnector5",
      place: { box: { x: 1_000_000, y: 1_500_000, cx: w, cy: 2_000_000 }, rot: 0, flipH: true, flipV: false },
      adjust: {
        adj1: Math.round((-elbowClearance * 100_000) / w),
        adj2: 50_000,
        adj3: Math.round(((w + elbowClearance) * 100_000) / w),
      },
    })
  })

  it("keeps an elbow's adjust out of a two-segment preset and a free end where its box draws it", () => {
    const left = square(1_000_000, 1_000_000)
    const below = square(4_000_000, 4_000_000)
    expect(routed(elbow, "bentConnector2", {}, tie(left, 3), tie(below, 0))).toEqual({
      preset: "bentConnector2",
      place: { box: { x: 2_000_000, y: 1_500_000, cx: 2_500_000, cy: 2_500_000 }, ...upright },
      adjust: {},
    })
    const free = { box: { x: 5_000_000, y: 2_000_000, cx: 1_000_000, cy: 500_000 }, ...upright }
    const { place } = routed(free, "bentConnector3", {}, tie(left, 3), null) ?? {}
    if (place === undefined) throw new Error("route")
    expect(connectorEnds(place)).toEqual({ start: { x: 2_000_000, y: 1_500_000 }, end: { x: 6_000_000, y: 2_500_000 } })
  })
})

describe("an elbow connector's segment count", () => {
  const ends = (start: Tie, end: Tie, preset = "bentConnector3") => {
    const route = routed(elbow, preset, {}, start, end)
    if (route === null) throw new Error("route")
    return { preset: route.preset, ...connectorEnds(route.place) }
  }

  it("goes around in five segments when a bottom site leads to a top site above it, as PowerPoint draws it", () => {
    const low = square(1_000_000, 3_000_000)
    const high = square(3_000_000, 0)
    expect(ends(tie(low, 2), tie(high, 0))).toEqual({
      preset: "bentConnector5",
      start: { x: 1_500_000, y: 4_000_000 },
      end: { x: 3_500_000, y: 0 },
    })
  })

  it("turns once when a right site leads to a top site ahead and below, and three times when it lies behind", () => {
    const left = square(1_000_000, 1_000_000)
    expect(ends(tie(left, 3), tie(square(4_000_000, 4_000_000), 0)).preset).toBe("bentConnector2")
    expect(ends(tie(left, 3), tie(square(-2_000_000, 4_000_000), 0)).preset).toBe("bentConnector4")
  })

  it("keeps three segments between facing sites with room, and under two sites that face the same way", () => {
    const left = square(1_000_000, 1_000_000)
    expect(ends(tie(left, 3), tie(square(4_000_000, 2_000_000), 1), "bentConnector5").preset).toBe("bentConnector3")
    expect(ends(tie(left, 2), tie(square(4_000_000, 1_000_000), 2)).preset).toBe("bentConnector3")
  })

  it("counts a curved connector's segments the same way, and keeps the file's count while an end is free", () => {
    const left = square(1_000_000, 1_000_000)
    expect(ends(tie(left, 3), tie(square(4_000_000, 4_000_000), 0), "curvedConnector3").preset).toBe("curvedConnector2")
    expect(routed(elbow, "bentConnector3", {}, tie(left, 3), null)?.preset).toBe("bentConnector3")
  })
})
