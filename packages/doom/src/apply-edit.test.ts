import { describe, expect, it } from "vitest"
import { orderKeyBetween } from "./order-key.js"
import { applyEdit, isRefusal, nodeId, rev, type Doom } from "./index.js"
import { box, create, ids, land, once, person, place, revOf, sampleDeck, textOf, tryLand } from "./sample-deck.js"

const refusedWith = (result: unknown, refused: string, node?: string, prop?: string) => {
  expect(isRefusal(result)).toBe(true)
  expect(result).toMatchObject({
    refused,
    ...(node === undefined ? {} : { node }),
    ...(prop === undefined ? {} : { prop }),
  })
}

describe("creating and ordering nodes", () => {
  it("indexes children by order key, with equal keys broken by node id", () => {
    const doom = sampleDeck()
    expect(doom.children.get(ids.slide)).toEqual([ids.card, ids.side])
    const first = orderKeyBetween(null, null)
    const before = orderKeyBetween(null, first)
    const moved = land(doom, [{ node: ids.side, prop: "parent", value: { id: ids.slide, at: before } }])
    expect(moved.children.get(ids.slide)).toEqual([ids.side, ids.card])
  })

  it("keeps children and parent in one property, so a reparent never leaves two parents", () => {
    const doom = land(sampleDeck(), [{ node: ids.title, prop: "parent", value: place(ids.side) }])
    expect(doom.children.get(ids.card) ?? []).toEqual([])
    expect(doom.children.get(ids.side)).toEqual([ids.title, ids.caption])
    expect(doom.nodes.get(ids.title)).toMatchObject({ parent: { id: ids.side } })
  })

  it("refuses a second deck", () => {
    refusedWith(tryLand(sampleDeck(), create(nodeId("t:90"), "deck", null)), "limit")
  })

  it("refuses to change a node's type", () => {
    refusedWith(tryLand(sampleDeck(), [{ node: ids.card, prop: "type", value: "shape" }]), "shape", ids.card, "type")
  })

  it("refuses a node with no parent after its edit, except the deck", () => {
    refusedWith(
      tryLand(sampleDeck(), [{ node: nodeId("t:91"), prop: "type", value: "frame" }]),
      "shape",
      nodeId("t:91"),
    )
  })

  it("lets a parent grammar hold: shapes hold nothing, slides sit in rows", () => {
    refusedWith(tryLand(sampleDeck(), create(nodeId("t:92"), "frame", ids.title)), "shape")
    refusedWith(tryLand(sampleDeck(), create(nodeId("t:93"), "slide", ids.card)), "shape")
    refusedWith(tryLand(sampleDeck(), create(nodeId("t:94"), "frame", ids.deck)), "shape")
  })
})

describe("what a type accepts", () => {
  it("refuses a property the type does not take, and lands nothing from the same edit", () => {
    const doom = sampleDeck()
    const result = tryLand(doom, [
      { node: ids.card, prop: "name", value: "Card" },
      { node: ids.card, prop: "text", value: textOf("no") },
    ])
    refusedWith(result, "shape", ids.card, "text")
    expect(doom.nodes.get(ids.card)).not.toHaveProperty("name")
  })

  it("refuses a value its reader does not read", () => {
    refusedWith(tryLand(sampleDeck(), [{ node: ids.card, prop: "opacity", value: 2 }]), "shape", ids.card, "opacity")
    refusedWith(tryLand(sampleDeck(), [{ node: ids.card, prop: "box", value: { x: 1 } }]), "shape", ids.card, "box")
  })

  it("reads a value a second time on the way in, so a hand-built edit cannot store a malformed value", () => {
    refusedWith(tryLand(sampleDeck(), [{ node: ids.card, prop: "hidden", value: "yes" }]), "shape", ids.card, "hidden")
  })

  it("unsets a property with null, and keeps its rev", () => {
    const named = land(sampleDeck(), [{ node: ids.card, prop: "name", value: "Card" }])
    const unset = land(named, [{ node: ids.card, prop: "name", value: null }])
    expect(unset.nodes.get(ids.card)).not.toHaveProperty("name")
    expect(revOf(unset, ids.card, "name")).toBe(unset.rev)
  })

  it("never unsets a type or a theme key", () => {
    refusedWith(tryLand(sampleDeck(), [{ node: ids.card, prop: "type", value: null }]), "shape")
    refusedWith(tryLand(sampleDeck(), [{ node: ids.deck, prop: "theme.colors.accent1", value: null }]), "shape")
  })
})

describe("delete and missing", () => {
  it("deletes with parent null, keeps the node and its props, and revives it in place", () => {
    const doom = sampleDeck()
    const gone = land(doom, [{ node: ids.card, prop: "parent", value: null }])
    expect(gone.nodes.get(ids.card)).toMatchObject({ parent: null, box: box(100) })
    expect(gone.children.get(ids.slide)).toEqual([ids.side])
    expect(gone.children.get(ids.card)).toEqual([ids.title])
    const back = land(gone, [
      { node: ids.card, prop: "parent", value: (doom.nodes.get(ids.card) as { parent: unknown }).parent },
    ])
    expect(back.children.get(ids.slide)).toEqual([ids.card, ids.side])
  })

  it("refuses a write to an absent or deleted node, and a parent that is absent or deleted", () => {
    const doom = sampleDeck()
    refusedWith(tryLand(doom, [{ node: nodeId("t:95"), prop: "name", value: "x" }]), "missing", nodeId("t:95"))
    refusedWith(tryLand(doom, [{ node: ids.card, prop: "parent", value: place(nodeId("t:96")) }]), "missing")
    const gone = land(doom, [{ node: ids.card, prop: "parent", value: null }])
    refusedWith(tryLand(gone, [{ node: ids.card, prop: "name", value: "x" }]), "missing", ids.card, "name")
    refusedWith(tryLand(gone, [{ node: ids.title, prop: "parent", value: place(ids.card) }]), "missing")
  })

  it("puts a deleted layer back into a deleted frame when the write takes back its delete, so it shows once the frame is back", () => {
    const doom = sampleDeck()
    const slot = (doom.nodes.get(ids.card) as { parent: unknown }).parent
    const gone = land(doom, [{ node: ids.title, prop: "parent", value: null }])
    const both = land(gone, [{ node: ids.card, prop: "parent", value: null }])
    const restore = {
      node: ids.title,
      prop: "parent" as const,
      value: place(ids.card),
      base: revOf(gone, ids.title, "parent")!,
    }
    const restored = land(both, [restore])
    expect(restored.children.get(ids.card)).toEqual([ids.title])
    expect(land(restored, [{ node: ids.card, prop: "parent", value: slot }]).children.get(ids.card)).toEqual([
      ids.title,
    ])
  })

  it("refuses a move of a deleted layer into a deleted frame that takes back no delete, as a tab that has not caught up sends", () => {
    const gone = land(sampleDeck(), [{ node: ids.title, prop: "parent", value: null }])
    const both = land(gone, [{ node: ids.card, prop: "parent", value: null }])
    refusedWith(tryLand(both, [{ node: ids.title, prop: "parent", value: place(ids.card) }]), "missing", ids.title)
  })

  it("refuses a move into a deleted frame of a layer that was not deleted before the edit, even one the edit deletes first", () => {
    const gone = land(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
    const base = revOf(gone, ids.caption, "parent")!
    for (const writes of [
      [{ node: ids.caption, prop: "parent" as const, value: place(ids.card), base }],
      [
        { node: ids.caption, prop: "parent" as const, value: null },
        { node: ids.caption, prop: "parent" as const, value: place(ids.card), base },
      ],
      [
        { node: ids.caption, prop: "parent" as const, value: null },
        { node: ids.caption, prop: "parent" as const, value: place(ids.card) },
      ],
    ])
      refusedWith(tryLand(gone, writes), "missing", ids.caption)
  })

  it("refuses a move into a deleted frame of a layer that is hidden under a deleted frame but not deleted itself", () => {
    const gone = land(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
    const both = land(gone, [{ node: ids.side, prop: "parent", value: null }])
    const move = {
      node: ids.caption,
      prop: "parent" as const,
      value: place(ids.card),
      base: revOf(both, ids.caption, "parent")!,
    }
    refusedWith(tryLand(both, [move]), "missing", ids.caption)
  })

  it("refuses a new layer in a deleted frame, even one the edit makes deleted first", () => {
    const gone = land(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
    const made = nodeId("t:20")
    refusedWith(tryLand(gone, create(made, "shape", ids.card)), "missing", made)
    const [type] = create(made, "shape", null)
    for (const base of [{}, { base: gone.rev }])
      refusedWith(
        tryLand(gone, [
          type!,
          { node: made, prop: "parent", value: null },
          { node: made, prop: "parent", value: place(ids.card), ...base },
          { node: made, prop: "box", value: box(0) },
        ]),
        "missing",
        made,
      )
  })

  it("refuses a move into a layer under a frame the same edit deleted before it", () => {
    const [inner, innermost] = [nodeId("t:10"), nodeId("t:11")]
    const nested = land(sampleDeck(), [...create(inner, "frame", ids.card), ...create(innermost, "frame", inner)])
    const hide = { node: ids.card, prop: "parent" as const, value: place(innermost) }
    refusedWith(tryLand(nested, [{ node: inner, prop: "parent", value: null }, hide]), "missing", ids.card, "parent")
    const tucked = { node: ids.side, prop: "parent" as const, value: place(innermost) }
    const gone = { node: ids.card, prop: "parent" as const, value: null }
    expect(isRefusal(tryLand(nested, [tucked, gone]))).toBe(false)
    expect(isRefusal(tryLand(land(nested, [gone]), [tucked]))).toBe(false)
  })

  it("lets one edit revive a node and write to it, parent first", () => {
    const gone = land(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
    const back = land(gone, [
      { node: ids.card, prop: "parent", value: place(ids.slide) },
      { node: ids.card, prop: "name", value: "Back" },
    ])
    expect(back.nodes.get(ids.card)).toMatchObject({ name: "Back" })
  })
})

describe("reparent cycles", () => {
  const nested = () =>
    land(sampleDeck(), [
      ...create(nodeId("t:10"), "frame", ids.card),
      ...create(nodeId("t:11"), "frame", nodeId("t:10")),
    ])

  it("refuses a frame under itself or under one of its descendants", () => {
    const doom = nested()
    refusedWith(tryLand(doom, [{ node: ids.card, prop: "parent", value: place(ids.card) }]), "cycle")
    refusedWith(tryLand(doom, [{ node: ids.card, prop: "parent", value: place(nodeId("t:11")) }]), "cycle")
    refusedWith(tryLand(doom, [{ node: nodeId("t:10"), prop: "parent", value: place(nodeId("t:11")) }]), "cycle")
  })

  it("refuses a cycle that two writes of one edit make together", () => {
    const doom = land(sampleDeck(), [
      ...create(nodeId("t:12"), "frame", ids.slide),
      ...create(nodeId("t:13"), "frame", ids.slide),
    ])
    refusedWith(
      tryLand(doom, [
        { node: nodeId("t:12"), prop: "parent", value: place(nodeId("t:13")) },
        { node: nodeId("t:13"), prop: "parent", value: place(nodeId("t:12")) },
      ]),
      "cycle",
    )
  })

  it("allows a move out of a nested frame", () => {
    const moved = land(nested(), [{ node: nodeId("t:11"), prop: "parent", value: place(ids.slide) }])
    expect(moved.children.get(nodeId("t:10"))).toEqual([])
  })
})

describe("revs", () => {
  it("bumps the rev of the written props and of no other", () => {
    const doom = sampleDeck()
    const before = revOf(doom, ids.card, "box")
    const next = land(doom, [{ node: ids.card, prop: "name", value: "Card" }])
    expect(revOf(next, ids.card, "name")).toBe(next.rev)
    expect(revOf(next, ids.card, "box")).toBe(before)
    expect(next.nodes.get(ids.card)).toMatchObject({ rev: next.rev })
    expect(next.rev).toBe(doom.rev + 1)
    expect(doom.nodes.get(ids.card)).not.toHaveProperty("name")
  })

  it("keeps the same node object for a node no write touched", () => {
    const doom = sampleDeck()
    const next = land(doom, [{ node: ids.card, prop: "name", value: "Card" }])
    expect(next.nodes.get(ids.side)).toBe(doom.nodes.get(ids.side))
  })
})

describe("idempotence per once", () => {
  it("returns the doom it was given when the edit's once has landed", () => {
    const doom = sampleDeck()
    const edit = {
      once: once(),
      author: person,
      writes: [{ node: ids.card, prop: "name" as const, value: "Card" }],
      rev: rev(doom.rev + 1),
    }
    const first = applyEdit(doom, edit) as Doom
    expect(applyEdit(first, edit)).toBe(first)
    expect(applyEdit(first, { ...edit, rev: rev(first.rev + 1) })).toBe(first)
    expect(first.onces.get(edit.once)).toBe(edit.rev)
  })

  it("does not remember a refused edit", () => {
    const doom = sampleDeck()
    const edit = {
      once: once(),
      author: person,
      writes: [{ node: ids.card, prop: "text" as const, value: textOf("x") }],
      rev: rev(doom.rev + 1),
    }
    expect(isRefusal(applyEdit(doom, edit))).toBe(true)
    expect(doom.onces.has(edit.once)).toBe(false)
  })
})
