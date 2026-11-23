import { describe, expect, it } from "vitest"
import { grow, paint, spot } from "@/testing/doom-fixtures"
import { lineEndDrag } from "./line-end-drag"

const line = (start: unknown, end: unknown) => ({
  type: "shape" as const,
  name: "rule",
  props: (ids: Record<string, string>) =>
    ({
      strokes: paint,
      stroke: { weight: 2, align: "center", dash: "solid" },
      geometry: {
        kind: "line",
        start: typeof start === "function" ? start(ids) : start,
        end: typeof end === "function" ? end(ids) : end,
        route: "straight",
        arrows: ["none", "none"],
      },
    }) as never,
})

const deck = () =>
  grow([
    { type: "shape", name: "card", props: { box: spot(600, 400, 200, 100), fills: paint } },
    {
      type: "shape",
      name: "peak",
      props: { box: spot(1000, 400, 200, 100), fills: paint, geometry: { kind: "preset", name: "triangle" } },
    },
    line({ x: 100, y: 100 }, { x: 300, y: 100 }),
  ])

describe("dragging a line's end", () => {
  const { view, geometry, ids } = deck()
  const drag = (at: { x: number; y: number }, more: { snap?: boolean; lockAngle?: boolean } = {}) =>
    lineEndDrag({
      view,
      geometry,
      line: ids.rule as never,
      grip: "line-end",
      at,
      snap: more.snap ?? true,
      lockAngle: more.lockAngle ?? false,
      scale: 1,
    })
  const ended = (writes: readonly { readonly value: unknown }[]) =>
    (writes[0]?.value as { end: unknown } | undefined)?.end

  it("moves the end to a free point on empty slide", () => {
    expect(ended(drag({ x: 320, y: 240 }).writes)).toEqual({ x: 320, y: 240 })
  })

  it("attaches the end to the site it comes near, and shows that shape's sites", () => {
    const done = drag({ x: 596, y: 452 })
    expect(ended(done.writes)).toEqual({ node: ids.card, site: "l" })
    expect(done.aim?.site).toEqual({ x: 600, y: 450 })
    expect(done.aim?.sites).toHaveLength(5)
  })

  it("attaches to a preset's site on its outline", () => {
    expect(ended(drag({ x: 1052, y: 448 }).writes)).toEqual({ node: ids.peak, site: "l" })
  })

  it("stays free inside a shape away from its sites, but shows them", () => {
    const done = drag({ x: 640, y: 420 })
    expect(ended(done.writes)).toEqual({ x: 640, y: 420 })
    expect(done.aim).toMatchObject({ site: null })
  })

  it("never attaches with snapping off or the angle held, and Shift keeps a 45 degree step", () => {
    expect(ended(drag({ x: 598, y: 450 }, { snap: false }).writes)).toEqual({ x: 598, y: 450 })
    expect(ended(drag({ x: 300, y: 130 }, { lockAngle: true }).writes)).toEqual({ x: 300, y: 100 })
    expect(ended(drag({ x: 300, y: 290 }, { lockAngle: true }).writes)).toEqual({ x: 295, y: 295 })
  })
})
