import { describe, expect, it } from "vitest"
import { connectorEnds, outlineOf, routedPlace, sitePoint } from "./connector.js"
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
    expect(routedPlace(line, "line", start, sitePoint(card, rect, 0))).toEqual(line)
    const moved = { ...card, box: { ...card.box, x: card.box.x + 254000 } }
    expect(routedPlace(line, "line", start, sitePoint(moved, rect, 0))).toEqual({
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
    expect(routedPlace(free, "straightConnector1", null, end)).toEqual(free)
  })

  it("leaves a connector whose preset no route knows to its file geometry", () => {
    expect(routedPlace(line, "rightArrow", { x: 0, y: 0 }, { x: 10, y: 10 })).toBeNull()
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
})
