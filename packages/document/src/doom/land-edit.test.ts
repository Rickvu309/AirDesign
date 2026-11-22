import fc from "fast-check"
import { expect, it } from "vitest"
import { orderKeyBetween } from "../order-key.js"
import { countsOf, hasDeck, isRefusal, landEdit, nodeId, rev } from "./index.js"
import type { Landed, Node, NodeId, Refusal, Doom, Write } from "./index.js"
import { create, ids, once, person, place, sampleDeck } from "./sample-deck.js"

const pool = {
  rows: [ids.row, nodeId("r:1"), nodeId("r:2")],
  slides: [ids.slide, nodeId("p:1"), nodeId("p:2"), nodeId("p:3")],
  shapes: [ids.card, ids.side, nodeId("q:1"), nodeId("q:2"), nodeId("q:3")],
}

const known = (doom: Doom) => ({ counts: () => countsOf(doom), deck: () => hasDeck(doom) })

const parentOf = (node: Node | undefined) => (node as { parent?: { id: NodeId } | null } | undefined)?.parent

function partOf(doom: Doom, writes: readonly Write[]): Doom {
  const wanted = new Set<NodeId>()
  const queue: NodeId[] = []
  for (const write of writes) {
    queue.push(write.node)
    const value = write.value as { id?: NodeId } | null
    if (write.prop === "parent" && value !== null && value.id !== undefined) queue.push(value.id)
  }
  for (let at = queue.pop(); at !== undefined; at = queue.pop()) {
    if (wanted.has(at)) continue
    const node = doom.nodes.get(at)
    if (node === undefined) continue
    wanted.add(at)
    const parent = parentOf(node)
    if (parent != null) queue.push(parent.id)
    if (node.type === "slideRow") for (const slide of doom.children.get(at) ?? []) queue.push(slide)
  }
  const nodes = new Map([...wanted].map((id) => [id, doom.nodes.get(id)!] as const))
  const children = new Map<NodeId, readonly NodeId[]>()
  for (const id of wanted) if (doom.nodes.get(id)!.type === "slideRow") children.set(id, doom.children.get(id) ?? [])
  return {
    nodes,
    revs: new Map([...wanted].map((id) => [id, doom.revs.get(id) ?? new Map()] as const)),
    children,
    rev: doom.rev,
    onces: new Map(),
    runs: doom.runs,
  }
}

type Move =
  | { readonly kind: "slide"; readonly slide: number; readonly row: number }
  | { readonly kind: "shape"; readonly shape: number; readonly slide: number }
  | { readonly kind: "hide"; readonly row: number; readonly hidden: boolean }
  | { readonly kind: "drop"; readonly of: "rows" | "slides" | "shapes"; readonly at: number }
  | { readonly kind: "row"; readonly row: number }

const moves: fc.Arbitrary<Move> = fc.oneof(
  fc.record({ kind: fc.constant("slide" as const), slide: fc.nat(3), row: fc.nat(2) }),
  fc.record({ kind: fc.constant("shape" as const), shape: fc.nat(4), slide: fc.nat(3) }),
  fc.record({ kind: fc.constant("hide" as const), row: fc.nat(2), hidden: fc.boolean() }),
  fc.record({
    kind: fc.constant("drop" as const),
    of: fc.constantFrom("rows" as const, "slides" as const, "shapes" as const),
    at: fc.nat(4),
  }),
  fc.record({ kind: fc.constant("row" as const), row: fc.nat(2) }),
)

function writesOf(doom: Doom, move: Move): readonly Write[] {
  const nodes = doom.nodes
  const found = (id: NodeId) => parentOf(nodes.get(id)) != null
  switch (move.kind) {
    case "row": {
      const id = pool.rows[move.row]!
      return nodes.has(id) ? [{ node: id, prop: "parent", value: null }] : create(id, "slideRow", ids.deck)
    }
    case "slide": {
      const id = pool.slides[move.slide]!
      const row = pool.rows[move.row]!
      const at = place(row, orderKeyBetween(null, null))
      return nodes.has(id) ? [{ node: id, prop: "parent", value: at }] : create(id, "slide", row)
    }
    case "shape": {
      const id = pool.shapes[move.shape]!
      const slide = pool.slides[move.slide]!
      return nodes.has(id)
        ? [{ node: id, prop: "parent", value: place(slide, orderKeyBetween(null, null)) }]
        : create(id, "shape", slide)
    }
    case "hide": {
      const id = pool.rows[move.row]!
      return nodes.has(id) ? [{ node: id, prop: "hidden", value: move.hidden }] : []
    }
    case "drop": {
      const id = pool[move.of][move.at % pool[move.of].length]!
      return found(id) ? [{ node: id, prop: "parent", value: null }] : []
    }
  }
}

it("counts the nodes an edit adds or removes from the nodes it touches, and lands the same on a part of the deck", () => {
  fc.assert(
    fc.property(fc.array(moves, { minLength: 1, maxLength: 24 }), (sequence) => {
      let doom = sampleDeck()
      for (const move of sequence) {
        const writes = writesOf(doom, move)
        if (writes.length === 0) continue
        const landed: Landed = { once: once(), author: person, writes, rev: rev(doom.rev + 1) }
        const whole = landEdit(doom, landed, known(doom))
        const counts = countsOf(doom)
        const part = partOf(doom, writes)
        const partial = landEdit(part, landed, { counts: () => counts, deck: () => hasDeck(doom) })
        if (isRefusal(whole)) {
          expect(isRefusal(partial) ? (partial as Refusal).refused : "landed").toBe(whole.refused)
          continue
        }
        if (isRefusal(partial)) throw new Error(`a part refused what the whole landed: ${JSON.stringify(partial)}`)
        const after = countsOf(whole.doom)
        expect(whole.delta).toEqual({
          elements: after.elements - counts.elements,
          slides: after.slides - counts.slides,
        })
        expect(partial.delta).toEqual(whole.delta)
        for (const write of writes) expect(partial.doom.nodes.get(write.node)).toEqual(whole.doom.nodes.get(write.node))
        doom = whole.doom
      }
    }),
    { numRuns: 300 },
  )
})
