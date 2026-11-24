import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { hitChain } from "./hit-test"
import { grow, paint, spot } from "./testing/doom-fixtures"
import { stubPathCanvas } from "./testing/path-canvas"

const tree = [
  { type: "shape", name: "under", props: { box: spot(300, 300, 200, 200), fills: paint } },
  {
    type: "shape",
    name: "round",
    props: { box: spot(100, 100, 200, 200), fills: paint, mask: true, geometry: { kind: "ellipse" } },
  },
  { type: "shape", name: "clipped", props: { box: spot(0, 0, 400, 400), fills: paint } },
  {
    type: "shape",
    name: "pill",
    props: { box: spot(500, 0, 100, 100), fills: paint, mask: true, radius: [40, 0, 0, 0] },
  },
  { type: "shape", name: "badge", props: { box: spot(480, 0, 200, 200), fills: paint } },
] as const

describe("what a click reaches through a mask", () => {
  const { geometry, ids } = grow(tree)
  const at = (x: number, y: number) => hitChain(geometry.roots, { x, y }, 0)?.map((each) => each.id) ?? null
  beforeEach(stubPathCanvas)
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reaches a masked layer inside the mask's outline and not in the clipped-away part", () => {
    expect(at(200, 200)).toEqual([ids.clipped])
    expect(at(20, 20)).toBeNull()
  })

  it("does not reach a masked layer in the corner of the box an ellipse mask cuts away", () => {
    expect(at(110, 110)).toBeNull()
  })

  it("does not reach a masked layer in a corner the mask's radius cuts away", () => {
    expect(at(502, 2)).toBeNull()
    expect(at(598, 2)).toEqual([ids.badge])
    expect(at(550, 50)).toEqual([ids.badge])
  })

  it("still reaches the layers below the mask", () => {
    expect(at(450, 450)).toEqual([ids.under])
  })
})
