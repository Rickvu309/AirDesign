import { describe, expect, it } from "vitest"
import { applyEdit, isRefusal, rev, viewOf, type Edit, type Scene } from "./index.js"
import { box, ids, once, person, revOf, sampleDeck, textOf, valuesOf } from "./sample-deck.js"

const edit = (writes: Edit["writes"]): Edit => ({ once: once(), author: person, writes })

describe("viewOf", () => {
  it("is the server's scene when nothing is pending", () => {
    const server = sampleDeck()
    expect(viewOf(server, [])).toBe(server)
  })

  it("puts pending edits on top, in order, and leaves the server's scene alone", () => {
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
    const landed = applyEdit(server, { ...first, rev: rev(server.rev + 1) }) as Scene
    const withAck = viewOf(landed, [first, second])
    const withoutAck = viewOf(landed, [second])
    expect(valuesOf(withAck)).toEqual(valuesOf(withoutAck))
    expect(revOf(withAck, ids.side, "name")).toBe(revOf(withoutAck, ids.side, "name"))
  })

  it("drops a pending edit that now refuses and keeps the ones after it", () => {
    const server = sampleDeck()
    const stale = edit([{ node: ids.title, prop: "text", value: textOf("old"), base: rev(0) }])
    const fine = edit([{ node: ids.card, prop: "name", value: "Fine" }])
    const view = viewOf(server, [stale, fine])
    expect(view.nodes.get(ids.title)).toMatchObject({ text: { chars: "Revenue" } })
    expect(view.nodes.get(ids.card)).toMatchObject({ name: "Fine" })
  })

  it("equals folding the pending edits over the server one by one", () => {
    const server = sampleDeck()
    const pending = [
      edit([{ node: ids.card, prop: "name", value: "A" }]),
      edit([{ node: ids.title, prop: "text", value: textOf("B"), base: revOf(server, ids.title, "text")! }]),
      edit([{ node: ids.card, prop: "parent", value: null }]),
    ]
    let folded = server
    for (const each of pending) {
      const next = applyEdit(folded, { ...each, rev: rev(folded.rev + 1) })
      if (!isRefusal(next)) folded = next
    }
    expect(viewOf(server, pending)).toEqual(folded)
  })
})
