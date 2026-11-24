import { describe, expect, it } from "vitest"
import { copiedMove, duplicateWrites } from "./copy-writes.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { nodeId } from "./ids.js"
import { box, ids, land, sampleDeck } from "./sample-deck.js"

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

  it("lands at the dragged place when it moved, and as a plain copy when nothing moved", () => {
    const deck = sampleDeck()
    const copies = duplicateWrites(deck, [ids.side], minted())
    const after = land(deck, copiedMove(copies, [{ node: ids.side, prop: "box", value: box(160, 30) }]))
    expect(propOf(after.nodes.get(copies.roots[0]!)!, "box")).toEqual(box(160, 30))
    expect(propOf(after.nodes.get(ids.side)!, "box")).toEqual(box(400))
    expect(copiedMove(copies, [])).toEqual(copies.writes)
  })
})
