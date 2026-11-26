import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { applyEdit } from "./apply-edit.js"
import { type Doom, type Write, emptyDoom } from "./doom.js"
import { childrenOf, parentOf } from "./doom-walk.js"
import { type NodeId, nodeId, rev } from "./ids.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"
import { isRefusal } from "./refusal.js"
import { siblingKeys } from "./sibling-keys.js"

const parent = nodeId("deck:1")

function land(doom: Doom, writes: readonly Write[]): Doom {
  const next = applyEdit(doom, {
    once: `w${String(doom.rev + 1)}`,
    author: { kind: "person", id: "test" },
    writes,
    rev: rev(doom.rev + 1),
  })
  if (isRefusal(next)) throw new Error(JSON.stringify(next))
  return next
}

function rowsAt(keys: readonly OrderKey[]): Doom {
  return land(emptyDoom, [
    { node: parent, prop: "type", value: "deck" },
    ...keys.flatMap((at, index): Write[] => [
      { node: nodeId(`r:${String(index)}`), prop: "type", value: "slideRow" },
      { node: nodeId(`r:${String(index)}`), prop: "parent", value: { id: parent, at } },
    ]),
  ])
}

function insertion(doom: Doom, index: number, ids: readonly NodeId[]): Write[] {
  const siblings = childrenOf(doom, parent).map((node) => ({ id: node.id, at: parentOf(node)!.at }))
  const { keys, shifted } = siblingKeys(siblings, index, ids.length)
  return [
    ...ids.flatMap((id, offset): Write[] => [
      { node: id, prop: "type", value: "slideRow" },
      { node: id, prop: "parent", value: { id: parent, at: keys[offset]! } },
    ]),
    ...shifted.map((each): Write => ({ node: each.id, prop: "parent", value: { id: parent, at: each.at } })),
  ]
}

function placed(doom: Doom, index: number, ids: readonly NodeId[]): Doom {
  return land(doom, insertion(doom, index, ids))
}

const order = (doom: Doom) => childrenOf(doom, parent).map((node) => node.id as string)

describe("sibling keys", () => {
  const a = orderKeyBetween(null, null)
  const b = orderKeyBetween(a, null)

  it("places between two siblings that share a key, which concurrent adds at one spot make", () => {
    const doom = rowsAt([a, b, b])
    expect(order(placed(doom, 2, [nodeId("new:1")]))).toEqual(["r:0", "r:1", "new:1", "r:2"])
  })

  it("rekeys every sibling of a tie from any index inside it, and none from outside", () => {
    const tied = rowsAt([b, b, b])
    const siblings = childrenOf(tied, parent).map((node) => ({ id: node.id, at: parentOf(node)!.at }))
    const inside = siblingKeys(siblings, 1, 1)
    expect(inside.shifted.map((each) => each.id)).toEqual(["r:0", "r:1", "r:2"])
    expect(siblingKeys(siblings, 2, 1).shifted).toEqual(inside.shifted)
    expect(siblingKeys(siblings, 0, 1).shifted).toEqual([])
    expect(siblingKeys(siblings, 3, 1).shifted).toEqual([])
  })

  it("rekeys the whole tie the same way from every index inside it, so both insert orders converge", () => {
    const tied = rowsAt([b, b, b])
    const siblings = childrenOf(tied, parent).map((node) => ({ id: node.id, at: parentOf(node)!.at }))
    expect(siblingKeys(siblings, 1, 1).shifted).toEqual(siblingKeys(siblings, 2, 1).shifted)
    const left = insertion(tied, 1, [nodeId("l:1")])
    const right = insertion(tied, 2, [nodeId("m:1")])
    const leftFirst = land(land(tied, left), right)
    const rightFirst = land(land(tied, right), left)
    const keysOf = (doom: Doom) => childrenOf(doom, parent).map((node) => `${node.id as string}@${parentOf(node)!.at}`)
    expect(order(leftFirst)).toEqual(["r:0", "l:1", "r:1", "m:1", "r:2"])
    expect(order(rightFirst)).toEqual(order(leftFirst))
    expect(keysOf(rightFirst)).toEqual(keysOf(leftFirst))
    const ats = childrenOf(leftFirst, parent).map((node) => parentOf(node)!.at)
    expect(new Set(ats).size).toBe(ats.length)
  })

  it("lands every placement where it was asked, for any keys, ties included", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 0, maxLength: 6 }),
        fc.nat(6),
        fc.integer({ min: 1, max: 3 }),
        (picks, rawIndex, count) => {
          const pool = [a, b, orderKeyBetween(b, null)]
          const keys = picks.map((pick) => pool[pick]!).toSorted()
          const doom = rowsAt(keys)
          const index = rawIndex % (keys.length + 1)
          const before = order(doom)
          const made = Array.from({ length: count }, (_, at) => nodeId(`new:${String(at)}`))
          expect(order(placed(doom, index, made))).toEqual([...before.slice(0, index), ...made, ...before.slice(index)])
        },
      ),
      { numRuns: 300 },
    )
  })
})
