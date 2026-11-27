import { describe, expect, it, vi } from "vitest"
import { hitChain } from "@/editing/hit-test"
import { grow, paint, spot } from "./testing/doom-fixtures"
import { allIn, kept, marqueeSelection, noSelection, picked, rectBetween, steppedIn, steppedOut } from "./selection"

const tree = [
  { type: "shape", name: "plain", props: { box: spot(40, 40, 100, 100), fills: paint } },
  {
    type: "frame",
    name: "group",
    props: { box: spot(400, 200, 500, 300) },
    children: [
      { type: "shape", name: "left", props: { box: spot(0, 0, 200, 300), fills: paint } },
      { type: "shape", name: "right", props: { box: spot(300, 0, 200, 300), fills: paint } },
    ],
  },
  {
    type: "frame",
    name: "card",
    props: { box: spot(1000, 200, 400, 300), fills: paint },
    children: [{ type: "shape", name: "inside", props: { box: spot(50, 50, 100, 100), fills: paint } }],
  },
  { type: "shape", name: "hollow", props: { box: spot(1500, 900, 100, 100) } },
] as const

describe("what a click reaches", () => {
  const { geometry, ids } = grow(tree)
  const at = (x: number, y: number) => hitChain(geometry.roots, { x, y }, 4)

  it("reaches a painted shape and nothing where there is no paint", () => {
    expect(at(60, 60)?.map((each) => each.id)).toEqual([ids.plain])
    expect(at(1550, 950)).toBeNull()
    expect(at(10, 10)).toBeNull()
  })

  it("passes through an unpainted group and lands on the layer inside it, with the group above it in the chain", () => {
    expect(at(450, 250)?.map((each) => each.id)).toEqual([ids.group, ids.left])
    expect(at(650, 250)).toBeNull()
  })

  it("reaches a painted frame's own body as well as the layer inside it", () => {
    expect(at(1300, 400)?.map((each) => each.id)).toEqual([ids.card])
    expect(at(1100, 300)?.map((each) => each.id)).toEqual([ids.card, ids.inside])
  })

  it("hits an ellipse only inside its curve", () => {
    const round = grow([
      { type: "shape", name: "dot", props: { box: spot(0, 0, 100, 100), fills: paint, geometry: { kind: "ellipse" } } },
    ])
    expect(hitChain(round.geometry.roots, { x: 50, y: 50 }, 4)).not.toBeNull()
    expect(hitChain(round.geometry.roots, { x: 5, y: 5 }, 4)).toBeNull()
  })

  it("hits a triangle only inside its outline, not in its box's empty corners", () => {
    const peak = grow([
      {
        type: "shape",
        name: "peak",
        props: { box: spot(0, 0, 200, 100), fills: paint, geometry: { kind: "preset", name: "triangle" } },
      },
    ])
    expect(hitChain(peak.geometry.roots, { x: 100, y: 80 }, 4)).not.toBeNull()
    expect(hitChain(peak.geometry.roots, { x: 10, y: 10 }, 4)).toBeNull()
  })

  it("hits a rotated shape where it is, not where its unrotated box was", () => {
    const turned = grow([{ type: "shape", name: "bar", props: { box: spot(100, 100, 200, 20, 90), fills: paint } }])
    expect(hitChain(turned.geometry.roots, { x: 200, y: 50 }, 4)).not.toBeNull()
    expect(hitChain(turned.geometry.roots, { x: 150, y: 110 }, 4)).toBeNull()
  })

  it("skips a layer the caller refuses, as it does for a locked one", () => {
    expect(hitChain(geometry.roots, { x: 60, y: 60 }, 4, (id) => id === ids.plain)).toBeNull()
  })

  it("reaches the nearest point of a thin line within the reach", () => {
    const lined = grow([
      {
        type: "shape",
        name: "line",
        props: {
          strokes: paint,
          stroke: { weight: 2, align: "center", dash: "solid" },
          geometry: {
            kind: "line",
            start: { x: 0, y: 0 },
            end: { x: 400, y: 0 },
            route: "straight",
            arrows: ["none", "none"],
          },
        },
      },
    ])
    expect(hitChain(lined.geometry.roots, { x: 200, y: 3 }, 4)).not.toBeNull()
    expect(hitChain(lined.geometry.roots, { x: 200, y: 30 }, 4)).toBeNull()
  })

  it("checks the painted stroke within the padded path bounds and skips it beyond them", () => {
    const trace = grow([
      {
        type: "shape",
        name: "trace",
        props: {
          box: spot(0, 0, 100, 100),
          geometry: { kind: "path", d: "M0 0L1 0" },
          strokes: paint,
          stroke: { weight: 4, align: "center", dash: "dash" },
        },
      },
    ])
    const isPointInStroke = vi.fn((_path: unknown, _x: number, y: number) => y < 0)
    const context = { resetTransform: () => {}, setLineDash: vi.fn(), isPointInStroke }
    vi.stubGlobal("Path2D", class {})
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) })
    try {
      expect(hitChain(trace.geometry.roots, { x: 12, y: -5 }, 4)).toBeNull()
      expect(isPointInStroke).not.toHaveBeenCalled()
      expect(hitChain(trace.geometry.roots, { x: 12, y: -3 }, 4)?.map(({ id }) => id)).toEqual([trace.ids.trace])
      expect(hitChain(trace.geometry.roots, { x: 50, y: 50 }, 4)).toBeNull()
      expect(context.setLineDash).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("reaches an elbow of no length at the seam of two touching shapes", () => {
    const seam = grow([
      { type: "shape", name: "a", props: { box: spot(100, 100, 100, 100), fills: paint } },
      { type: "shape", name: "b", props: { box: spot(200, 100, 100, 100), fills: paint } },
      {
        type: "shape",
        name: "line",
        props: (ids: Record<string, string>) =>
          ({
            strokes: paint,
            stroke: { weight: 2, align: "center", dash: "solid" },
            geometry: {
              kind: "line",
              start: { node: ids.a, site: "r" },
              end: { node: ids.b, site: "l" },
              route: "elbow",
              arrows: ["none", "arrow"],
            },
          }) as never,
      },
    ])
    expect(hitChain(seam.geometry.roots, { x: 201, y: 152 }, 4)?.map((each) => each.id)).toEqual([seam.ids.line])
  })
})

describe("selecting", () => {
  const { geometry, ids } = grow(tree)
  const chainAt = (x: number, y: number) => hitChain(geometry.roots, { x, y }, 4)!

  it("selects the whole group on a first click and the layer inside after stepping in", () => {
    const first = picked(chainAt(450, 250), noSelection, { shift: false, deep: false })
    expect(first).toEqual({ ids: [ids.group], inside: null })
    const stepped = steppedIn(chainAt(450, 250), first)
    expect(stepped).toEqual({ ids: [ids.left], inside: ids.group })
  })

  it("selects a sibling directly once inside a group", () => {
    const sibling = picked(chainAt(850, 250), { ids: [ids.left], inside: ids.group }, { shift: false, deep: false })
    expect(sibling).toEqual({ ids: [ids.right], inside: ids.group })
  })

  it("deep select picks the layer inside at once and remembers its group", () => {
    expect(picked(chainAt(450, 250), noSelection, { shift: false, deep: true })).toEqual({
      ids: [ids.left],
      inside: ids.group,
    })
  })

  it("adds and removes with Shift", () => {
    const one = picked(chainAt(60, 60), noSelection, { shift: false, deep: false })
    const two = picked(chainAt(450, 250), one, { shift: true, deep: false })
    expect(two.ids).toEqual([ids.plain, ids.group])
    expect(picked(chainAt(60, 60), two, { shift: true, deep: false }).ids).toEqual([ids.group])
  })

  it("steps out to the parent", () => {
    expect(steppedOut(geometry, { ids: [ids.left], inside: ids.group })).toEqual({ ids: [ids.group], inside: null })
    expect(steppedOut(geometry, { ids: [ids.plain], inside: null })).toEqual(noSelection)
  })

  it("does not step into a layer that has nothing inside it", () => {
    expect(steppedIn(chainAt(60, 60), { ids: [ids.plain], inside: null })).toBeNull()
  })

  it("marquee takes every top-level layer it touches, and the leaves with deep", () => {
    const rect = rectBetween({ x: 0, y: 0 }, { x: 1100, y: 600 })
    const shallow = marqueeSelection(geometry, rect, { deep: false, locked: () => false })
    expect(shallow).toEqual([ids.plain, ids.group, ids.card])
    const deep = marqueeSelection(geometry, rectBetween({ x: 0, y: 0 }, { x: 1100, y: 600 }), {
      deep: true,
      locked: () => false,
    })
    expect(deep).toEqual([ids.plain, ids.left, ids.right, ids.inside])
  })

  it("marquee leaves a locked layer out", () => {
    const rect = rectBetween({ x: 0, y: 0 }, { x: 200, y: 200 })
    expect(marqueeSelection(geometry, rect, { deep: false, locked: (id) => id === ids.plain })).toEqual([])
  })

  it("drops ids that are no longer on the slide", () => {
    const { geometry: smaller } = grow([tree[0]])
    expect(kept({ ids: [ids.right], inside: ids.group }, smaller)).toEqual({ ids: [], inside: null })
    expect(kept({ ids: [ids.plain, ids.right], inside: ids.group }, smaller)).toEqual({
      ids: [ids.plain],
      inside: null,
    })
    expect(kept({ ids: [ids.plain], inside: null }, geometry)).toEqual({ ids: [ids.plain], inside: null })
  })

  it("selects every layer beside the selection", () => {
    expect(allIn(geometry, { ids: [ids.left], inside: ids.group }, () => false).ids).toEqual([ids.left, ids.right])
    expect(allIn(geometry, noSelection, () => false).ids).toEqual([ids.plain, ids.group, ids.card, ids.hollow])
    expect(allIn(geometry, noSelection, (id) => id === ids.card).ids).toEqual([ids.plain, ids.group, ids.hollow])
  })
})
