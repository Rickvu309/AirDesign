import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { roundedRectPath } from "./node-outline.js"
import { masksOf, silhouetteIn } from "./silhouette.js"
import { testTheme } from "@airdesign/doom/testing"

type Matrix = doom.Matrix
const identity = doom.identityMatrix

const spot = (x: number, y: number, w: number, h: number, extra: object = {}) => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
  ...extra,
})
const paint = [{ kind: "solid", color: { var: "accent1" } }] as const

function resolved(children: readonly doom.TreeNode[]) {
  const grown = doom.doomFromTree({ theme: testTheme, slides: [{ children }] })
  const nodes = doom.resolveSlide(grown.doom, grown.slides[0]!, doom.measureWith({}))
  return (name: string) => nodes.find((node) => node.id === grown.ids[name])!
}

const at = ([a, b, c, d, e, f]: Matrix, x: number, y: number) => {
  const point = { x: a * x + c * y + e, y: b * x + d * y + f }
  return { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 }
}

describe("a node's silhouette", () => {
  it("is its rounded outline, placed where the box sits", () => {
    const node = resolved([
      { type: "shape", name: "card", props: { box: spot(40, 30, 200, 120), radius: [24, 0, 8, 0], fills: paint } },
    ])("card")
    const shape = silhouetteIn(node, identity)
    expect(shape.d).toBe(roundedRectPath(200, 120, [24, 0, 8, 0]))
    expect(at(shape.matrix, 0, 0)).toEqual({ x: 40, y: 30 })
    expect(at(shape.matrix, 200, 120)).toEqual({ x: 240, y: 150 })
  })

  it("mirrors with a horizontal or vertical flip while its children stay unflipped", () => {
    const named = resolved([
      { type: "shape", name: "across", props: { box: spot(40, 30, 200, 120, { flipH: true }), fills: paint } },
      { type: "shape", name: "down", props: { box: spot(40, 30, 200, 120, { flipV: true }), fills: paint } },
    ])
    expect(at(silhouetteIn(named("across"), identity).matrix, 0, 0)).toEqual({ x: 240, y: 30 })
    expect(at(silhouetteIn(named("down"), identity).matrix, 0, 0)).toEqual({ x: 40, y: 150 })
    expect(at(doom.boxMatrix(identity, named("across").box), 0, 0)).toEqual({ x: 40, y: 30 })
  })

  it("turns about the box's centre and sits inside its parent", () => {
    const node = resolved([
      { type: "shape", name: "turned", props: { box: spot(0, 0, 200, 100, { rotation: 90 }), fills: paint } },
    ])("turned")
    const parent: Matrix = [1, 0, 0, 1, 500, 400]
    expect(at(silhouetteIn(node, identity).matrix, 0, 0)).toEqual({ x: 150, y: -50 })
    expect(at(silhouetteIn(node, parent).matrix, 0, 0)).toEqual({ x: 650, y: 350 })
  })

  it("follows an ellipse or a path exactly", () => {
    const named = resolved([
      {
        type: "shape",
        name: "oval",
        props: { box: spot(0, 0, 400, 200), geometry: { kind: "ellipse" }, fills: paint },
      },
      {
        type: "shape",
        name: "peak",
        props: { box: spot(0, 0, 400, 200), geometry: { kind: "path", d: "M0 1L0.5 0L1 1Z" }, fills: paint },
      },
    ])
    expect(silhouetteIn(named("oval"), identity).d).toBe("M0 100A200 100 0 1 0 400 100A200 100 0 1 0 0 100Z")
    expect(silhouetteIn(named("peak"), identity).d).toBe("M0 200L200 0L400 200Z")
  })
})

describe("which mask a layer paints through", () => {
  it("is the nearest mask below it, and never another mask for a mask", () => {
    const named = resolved([
      { type: "shape", name: "under", props: { box: spot(0, 0, 10, 10), fills: paint } },
      { type: "shape", name: "first", props: { box: spot(0, 0, 10, 10), fills: paint, mask: true } },
      { type: "shape", name: "inside", props: { box: spot(0, 0, 10, 10), fills: paint } },
      { type: "shape", name: "second", props: { box: spot(5, 5, 10, 10), fills: paint, mask: true } },
      { type: "shape", name: "over", props: { box: spot(0, 0, 10, 10), fills: paint } },
    ])
    const nodes = ["under", "first", "inside", "second", "over"].map(named)
    expect(masksOf(nodes)).toEqual([null, null, named("first"), null, named("second")])
  })
})
