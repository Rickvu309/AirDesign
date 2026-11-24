import { describe, expect, it } from "vitest"
import { build, compiled, minter, startedDeck } from "./agent-fixtures.js"
import { duplicateWrites } from "./copy-writes.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import type { Doom, NodeId } from "./index.js"
import { orderKeyBetween, type OrderKey } from "./order-key.js"
import { land } from "./sample-deck.js"

const slideOf = (doom: Doom) => slidesOf(doom)[0]!.id
const painted = (doom: Doom) => childrenOf(doom, slideOf(doom)).map((node) => node.id)
const keyOf = (doom: Doom, id: NodeId) => propOf(doom.nodes.get(id), "parent")!.at as OrderKey
const titleOf = (doom: Doom) => childrenOf(doom, slideOf(doom)).find((node) => propOf(node, "role") === "title")!.id

function tied(): Doom {
  const before = startedDeck(1, "title")
  const slide = slideOf(before)
  const top = orderKeyBetween(keyOf(before, painted(before).at(-1)!), null)
  return land(before, [
    { node: "a:1" as NodeId, prop: "type", value: "shape" },
    { node: "a:1" as NodeId, prop: "parent", value: { id: slide, at: top } },
    { node: "b:1" as NodeId, prop: "type", value: "shape" },
    { node: "b:1" as NodeId, prop: "parent", value: { id: slide, at: top } },
  ])
}

describe("siblings whose saved order keys tie", () => {
  it("take an agent's move after the lower one above both, and leave their keys alone", () => {
    const before = tied()
    const title = titleOf(before)
    const writes = compiled(before, { op: "move", node: title, after: "a:1" as NodeId })
    expect(writes.map((write) => write.node)).toEqual([title])
    const doom = build(before, { op: "move", node: title, after: "a:1" as NodeId })
    expect(painted(doom).slice(-3)).toEqual(["a:1", "b:1", title])
  })

  it("take a duplicate of the lower one without throwing, above it", () => {
    const before = tied()
    const copies = duplicateWrites(before, ["a:1" as NodeId], minter("c"))
    const order = painted(land(before, copies.writes))
    expect(order.indexOf(copies.roots[0]!)).toBeGreaterThan(order.indexOf("a:1" as NodeId))
  })
})
