import { describe, expect, it } from "vitest"
import { copiedMove, duplicateWrites } from "./copy-writes.js"
import { childrenOf, parentOf, propOf } from "./doom-walk.js"
import { nodeId } from "./ids.js"
import { orderKeyBetween } from "./order-key.js"
import { box, create, ids, land, sampleDeck } from "./sample-deck.js"

const minted = () => {
  let count = 0
  return () => nodeId(`c:${String((count += 1))}`)
}

describe("a copy of a layer", () => {
  it("lands right after the original with its children, and leaves the original where it was", () => {
    const deck = sampleDeck()
    const copies = duplicateWrites(deck, [ids.side], minted())
    const after = land(deck, copies.writes)
    const [copy] = copies.roots
    expect(childrenOf(after, ids.slide).map((node) => node.id)).toEqual([ids.card, ids.side, copy])
    expect(childrenOf(after, copy!).map((node) => node.type)).toEqual(["shape"])
    expect(propOf(after.nodes.get(copy!)!, "box")).toEqual(box(400))
  })

  it("rekeys the whole tied run when the copy lands inside it", () => {
    const tie = orderKeyBetween(null, null)
    const third = nodeId("t:8")
    const deck = land(sampleDeck(), [
      { node: ids.card, prop: "parent", value: { id: ids.slide, at: tie } },
      { node: ids.side, prop: "parent", value: { id: ids.slide, at: tie } },
      ...create(third, "frame", ids.slide, { node: third, prop: "box", value: box(800) }),
      { node: third, prop: "parent", value: { id: ids.slide, at: tie } },
    ])
    const copies = duplicateWrites(deck, [ids.side], minted())
    const after = land(deck, copies.writes)
    const copy = copies.roots[0]!
    expect(childrenOf(after, ids.slide).map((node) => node.id)).toEqual([ids.card, ids.side, copy, third])
    const ats = childrenOf(after, ids.slide).map((node) => parentOf(node)!.at)
    expect(new Set(ats).size).toBe(ats.length)
  })

  it("lands at the dragged place when it moved, and as a plain copy when nothing moved", () => {
    const deck = sampleDeck()
    const copies = duplicateWrites(deck, [ids.side], minted())
    const after = land(deck, copiedMove(copies, [{ node: ids.side, prop: "box", value: box(160, 30) }]))
    expect(propOf(after.nodes.get(copies.roots[0]!)!, "box")).toEqual(box(160, 30))
    expect(propOf(after.nodes.get(ids.side)!, "box")).toEqual(box(400))
    expect(copiedMove(copies, [])).toEqual(copies.writes)
  })
})
