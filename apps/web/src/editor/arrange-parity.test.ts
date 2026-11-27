import * as doom from "@airdesign/doom"
import { compileIntent, placement, starts } from "@airdesign/doom/testing"
import { describe, expect, it } from "vitest"
import { geometryOf } from "@/editing/slide-geometry"
import { ungroupWrites, wrapWrites } from "./group-writes"
import { grow, landed, spot } from "./testing/doom-fixtures"

const freeLine = (start: doom.Point, end: doom.Point) => ({
  box: spot(0, 0, 10, 10),
  geometry: { kind: "line" as const, start, end, route: "straight" as const, arrows: ["none", "none"] as const },
})

const tree: readonly doom.TreeNode[] = [
  {
    type: "frame",
    name: "holder",
    props: { box: spot(200, 100, 600, 400, 30) },
    children: [
      { type: "shape", name: "a", props: { box: spot(40, 60, 120, 80, 45) } },
      { type: "shape", name: "b", props: { box: spot(300, 200, 100, 50) } },
      { type: "shape", name: "wire", props: freeLine({ x: 50, y: 300 }, { x: 250, y: 350 }) },
      {
        type: "frame",
        name: "inner",
        props: { box: spot(330, 40, 240, 160, -20) },
        children: [
          { type: "shape", name: "k", props: { box: spot(10, 10, 50, 40, 15) } },
          { type: "shape", name: "tie", props: freeLine({ x: 20, y: 120 }, { x: 200, y: 140 }) },
        ],
      },
      { type: "shape", name: "c", props: { box: spot(400, 300, 60, 60) } },
    ],
  },
]

const minter = () => {
  let made = 0
  return () => doom.nodeId(`new:${String((made += 1))}`)
}

type Grown = ReturnType<typeof grow>

function both(editor: (grown: Grown) => readonly doom.Write[] | undefined, intent: (ids: Grown["ids"]) => object) {
  const grown = grow(tree)
  const writes = editor(grown)
  if (writes === undefined) throw new Error("the editor made no writes")
  const compiled = compileIntent(grown.view, intent(grown.ids) as doom.Intent, minter(), placement, starts)
  if ("refused" in compiled) throw new Error(JSON.stringify(compiled))
  return { grown, person: landed(grown.view, writes), agent: landed(grown.view, compiled) }
}

function sameArrangement(person: doom.Doom, agent: doom.Doom, slide: doom.NodeId) {
  const measure = doom.measureWith({})
  const painted = (view: doom.Doom) => geometryOf(doom.resolveSlide(view, slide, measure)).byId
  const personPlaced = painted(person)
  const agentPlaced = painted(agent)
  expect([...agentPlaced.keys()]).toEqual([...personPlaced.keys()])
  for (const [id, placed] of personPlaced) {
    expect(doom.parentOf(agent.nodes.get(id))?.id, id).toBe(doom.parentOf(person.nodes.get(id))?.id)
    expect(doom.childrenOf(agent, id).map((node) => node.id)).toEqual(
      doom.childrenOf(person, id).map((node) => node.id),
    )
    expect(doom.propOf(agent.nodes.get(id), "box"), id).toEqual(doom.propOf(person.nodes.get(id), "box"))
    expect(doom.propOf(agent.nodes.get(id), "geometry"), id).toEqual(doom.propOf(person.nodes.get(id), "geometry"))
    expect(agentPlaced.get(id)?.corners, id).toEqual(placed.corners)
  }
  expect(doom.childrenOf(agent, slide).map((node) => node.id)).toEqual(
    doom.childrenOf(person, slide).map((node) => node.id),
  )
}

describe("an agent's wrap and unwrap land the editor's arrangement", () => {
  it("wraps a turned shape and a free line inside a turned frame", () => {
    const { grown, person, agent } = both(
      ({ view, geometry, ids }) => wrapWrites(view, geometry, [ids.a!, ids.wire!], "group", minter())?.writes,
      (ids) => ({ op: "wrap", nodes: [ids.a, ids.wire] }),
    )
    sameArrangement(person, agent, grown.slides[0]!)
  })

  it("wraps a turned shape and a free line inside a frame nested in a turned frame", () => {
    const { grown, person, agent } = both(
      ({ view, geometry, ids }) => wrapWrites(view, geometry, [ids.k!, ids.tie!], "group", minter())?.writes,
      (ids) => ({ op: "wrap", nodes: [ids.k, ids.tie] }),
    )
    sameArrangement(person, agent, grown.slides[0]!)
  })

  it("unwraps a turned frame nested in a turned frame", () => {
    const { grown, person, agent } = both(
      ({ view, geometry, ids }) => ungroupWrites(view, geometry, [ids.inner!])?.writes,
      (ids) => ({ op: "unwrap", node: ids.inner }),
    )
    sameArrangement(person, agent, grown.slides[0]!)
  })

  it("unwraps a turned frame onto the slide", () => {
    const { grown, person, agent } = both(
      ({ view, geometry, ids }) => ungroupWrites(view, geometry, [ids.holder!])?.writes,
      (ids) => ({ op: "unwrap", node: ids.holder }),
    )
    sameArrangement(person, agent, grown.slides[0]!)
  })
})

describe("Doom places a slide the way the editor does", () => {
  it("gives every layer the editor's matrix, corners and turn", () => {
    const { view, geometry, slides, measure } = grow(tree)
    const placed = doom.placeSlide(view, slides[0]!, measure)
    expect([...placed.keys()]).toEqual([...geometry.byId.keys()])
    for (const [id, editor] of geometry.byId) {
      const { box: _box, ...own } = placed.get(id)!
      const {
        node: _node,
        reveals: _reveals,
        maskedBy: _masked,
        children: _children,
        box: _editorBox,
        ...seen
      } = editor
      expect(own, id).toEqual(seen)
    }
  })
})
