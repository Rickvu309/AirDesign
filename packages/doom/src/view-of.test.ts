import { describe, expect, it } from "vitest"
import { applyEdit, isRefusal, rev, viewOf, type Edit, type Doom } from "./index.js"
import { box, ids, once, person, revOf, sampleDeck, textOf } from "./sample-deck.js"
import { valuesOf } from "./testing/values-of.js"

const edit = (writes: Edit["writes"]): Edit => ({ once: once(), author: person, writes })

describe("viewOf", () => {
  it("is the server's doom when nothing is pending", () => {
    const server = sampleDeck()
    expect(viewOf(server, [])).toBe(server)
  })

  it("puts pending edits on top, in order, and leaves the server's doom alone", () => {
    const server = sampleDeck()
    const view = viewOf(server, [
      edit([{ node: ids.card, prop: "box", value: box(1) }]),
      edit([
        { node: ids.card, prop: "box", value: box(2) },
        { node: ids.side, prop: "name", value: "Side" },
      ]),
    ])
    expect(view.nodes.get(ids.card)).toMatchObject({ box: box(2) })
    expect(view.nodes.get(ids.side)).toMatchObject({ name: "Side" })
    expect(server.nodes.get(ids.card)).toMatchObject({ box: box(100) })
  })

  it("gives pending edits revs above the server's, one per edit that applied", () => {
    const server = sampleDeck()
    const view = viewOf(server, [
      edit([{ node: ids.card, prop: "name", value: "A" }]),
      edit([{ node: ids.card, prop: "name", value: "B" }]),
    ])
    expect(revOf(view, ids.card, "name")).toBe(rev(server.rev + 2))
    expect(view.rev).toBe(server.rev + 2)
  })

  it("skips an edit the server already holds, so an answer that arrives late does not apply twice", () => {
    const server = sampleDeck()
    const first = edit([{ node: ids.card, prop: "name", value: "A" }])
    const second = edit([{ node: ids.side, prop: "name", value: "B" }])
    const landed = applyEdit(server, { ...first, rev: rev(server.rev + 1) }) as Doom
    const withAck = viewOf(landed, [first, second])
    const withoutAck = viewOf(landed, [second])
    expect(valuesOf(withAck)).toEqual(valuesOf(withoutAck))
    expect(revOf(withAck, ids.side, "name")).toBe(revOf(withoutAck, ids.side, "name"))
  })

  it("judges nothing by a pending write's base: the server decides conflicts, the view shows the person's edit", () => {
    const server = sampleDeck()
    const mine = edit([{ node: ids.title, prop: "text", value: textOf("mine"), base: rev(0) }])
    const view = viewOf(server, [mine, edit([{ node: ids.title, prop: "text", value: textOf("mine too") }])])
    expect(view.nodes.get(ids.title)).toMatchObject({ text: { chars: "mine too" } })
  })

  it("keeps a person's second keystroke when an unrelated edit lands before the first reaches the server", () => {
    const server = sampleDeck()
    const base = revOf(server, ids.title, "text")!
    const first = edit([{ node: ids.title, prop: "text", value: textOf("R"), base }])
    const second = edit([{ node: ids.title, prop: "text", value: textOf("Re"), base: rev(server.rev + 1) }])
    const elsewhere = applyEdit(server, {
      once: once(),
      author: person,
      writes: [{ node: ids.side, prop: "name", value: "Side" }],
      rev: rev(server.rev + 1),
    }) as Doom
    expect(viewOf(elsewhere, [first, second]).nodes.get(ids.title)).toMatchObject({ text: { chars: "Re" } })
  })

  it("drops a pending edit that refuses for another reason and keeps the ones after it", () => {
    const server = applyEdit(sampleDeck(), {
      once: once(),
      author: person,
      writes: [{ node: ids.card, prop: "parent", value: null }],
      rev: rev(sampleDeck().rev + 1),
    }) as Doom
    const gone = edit([{ node: ids.card, prop: "name", value: "Gone" }])
    const fine = edit([{ node: ids.side, prop: "name", value: "Fine" }])
    const view = viewOf(server, [gone, fine])
    expect(view.nodes.get(ids.card)).not.toHaveProperty("name")
    expect(view.nodes.get(ids.side)).toMatchObject({ name: "Fine" })
  })

  it("equals folding the pending edits over the server one by one, each based on the view it lands on", () => {
    const server = sampleDeck()
    const pending = [
      edit([{ node: ids.card, prop: "name", value: "A" }]),
      edit([{ node: ids.title, prop: "text", value: textOf("B"), base: revOf(server, ids.title, "text")! }]),
      edit([{ node: ids.card, prop: "parent", value: null }]),
    ]
    let folded = server
    for (const each of pending) {
      const writes = each.writes.map((write) => {
        const was = revOf(folded, write.node, write.prop)
        const { base: _sent, ...rest } = write
        return was === undefined ? rest : { ...rest, base: was }
      })
      const next = applyEdit(folded, { ...each, writes, rev: rev(folded.rev + 1) })
      if (!isRefusal(next)) folded = next
    }
    expect(viewOf(server, pending)).toEqual(folded)
  })
})
