import { describe, expect, it } from "vitest"
import { hitChain } from "./hit-test"
import { grow, paint, spot } from "./testing/doom-fixtures"

const tree = [
  { type: "shape", name: "under", props: { box: spot(300, 300, 200, 200), fills: paint } },
  {
    type: "shape",
    name: "round",
    props: { box: spot(100, 100, 200, 200), fills: paint, mask: true, geometry: { kind: "ellipse" } },
  },
  { type: "shape", name: "clipped", props: { box: spot(0, 0, 400, 400), fills: paint } },
] as const

describe("what a click reaches through a mask", () => {
  const { geometry, ids } = grow(tree)
  const at = (x: number, y: number) => hitChain(geometry.roots, { x, y }, 0)?.map((each) => each.id) ?? null

  it("reaches a masked layer inside the mask's outline and not in the clipped-away part", () => {
    expect(at(200, 200)).toEqual([ids.clipped])
    expect(at(20, 20)).toBeNull()
  })

  it("does not reach a masked layer in the corner of the box an ellipse mask cuts away", () => {
    expect(at(110, 110)).toBeNull()
  })

  it("still reaches the layers below the mask", () => {
    expect(at(450, 450)).toEqual([ids.under])
  })
})
