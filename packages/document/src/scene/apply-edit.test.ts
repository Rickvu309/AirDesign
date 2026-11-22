import { describe, expect, it } from "vitest"
import { orderKeyBetween } from "../order-key.js"
import { applyEdit, isRefusal, nodeId, rev, type Scene } from "./index.js"
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
    const scene = sampleDeck()
    expect(scene.children.get(ids.slide)).toEqual([ids.card, ids.side, ids.kept])
    const first = orderKeyBetween(null, null)
    const before = orderKeyBetween(null, first)
    const moved = land(scene, [{ node: ids.kept, prop: "parent", value: { id: ids.slide, at: before } }])
    expect(moved.children.get(ids.slide)).toEqual([ids.kept, ids.card, ids.side])
  })

  it("keeps children and parent in one property, so a reparent never leaves two parents", () => {
    const scene = land(sampleDeck(), [{ node: ids.title, prop: "parent", value: place(ids.side) }])
    expect(scene.children.get(ids.card) ?? []).toEqual([])
    expect(scene.children.get(ids.side)).toEqual([ids.title, ids.caption])
    expect(scene.nodes.get(ids.title)).toMatchObject({ parent: { id: ids.side } })
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
    const scene = sampleDeck()
    const result = tryLand(scene, [
      { node: ids.card, prop: "name", value: "Card" },
      { node: ids.card, prop: "text", value: textOf("no") },
    ])
    refusedWith(result, "shape", ids.card, "text")
    expect(scene.nodes.get(ids.card)).not.toHaveProperty("name")
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

describe("kept nodes", () => {
  it("move, resize, rename, hide and delete, and take nothing else", () => {
    const scene = sampleDeck()
    const moved = land(scene, [
      { node: ids.kept, prop: "box", value: box(10) },
      { node: ids.kept, prop: "name", value: "Diagram" },
      { node: ids.kept, prop: "hidden", value: true },
    ])
    expect(moved.nodes.get(ids.kept)).toMatchObject({ name: "Diagram", hidden: true })
    refusedWith(tryLand(scene, [{ node: ids.kept, prop: "fills", value: [], base: rev(0) }]), "kept", ids.kept, "fills")
    refusedWith(tryLand(scene, [{ node: ids.kept, prop: "snapshot", value: "other" }]), "kept", ids.kept, "snapshot")
    refusedWith(tryLand(scene, [{ node: ids.kept, prop: "locked", value: true }]), "kept", ids.kept, "locked")
    const gone = land(scene, [{ node: ids.kept, prop: "parent", value: null }])
    expect(gone.children.get(ids.slide)).not.toContain(ids.kept)
  })
})

describe("delete and missing", () => {
  it("deletes with parent null, keeps the node and its props, and revives it in place", () => {
    const scene = sampleDeck()
    const gone = land(scene, [{ node: ids.card, prop: "parent", value: null }])
    expect(gone.nodes.get(ids.card)).toMatchObject({ parent: null, box: box(100) })
    expect(gone.children.get(ids.slide)).toEqual([ids.side, ids.kept])
    expect(gone.children.get(ids.card)).toEqual([ids.title])
    const back = land(gone, [
      { node: ids.card, prop: "parent", value: (scene.nodes.get(ids.card) as { parent: unknown }).parent },
    ])
    expect(back.children.get(ids.slide)).toEqual([ids.card, ids.side, ids.kept])
  })

  it("refuses a write to an absent or deleted node, and a parent that is absent or deleted", () => {
    const scene = sampleDeck()
    refusedWith(tryLand(scene, [{ node: nodeId("t:95"), prop: "name", value: "x" }]), "missing", nodeId("t:95"))
    refusedWith(tryLand(scene, [{ node: ids.card, prop: "parent", value: place(nodeId("t:96")) }]), "missing")
    const gone = land(scene, [{ node: ids.card, prop: "parent", value: null }])
    refusedWith(tryLand(gone, [{ node: ids.card, prop: "name", value: "x" }]), "missing", ids.card, "name")
    refusedWith(tryLand(gone, [{ node: ids.title, prop: "parent", value: place(ids.card) }]), "missing")
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
    const scene = nested()
    refusedWith(tryLand(scene, [{ node: ids.card, prop: "parent", value: place(ids.card) }]), "cycle")
    refusedWith(tryLand(scene, [{ node: ids.card, prop: "parent", value: place(nodeId("t:11")) }]), "cycle")
    refusedWith(tryLand(scene, [{ node: nodeId("t:10"), prop: "parent", value: place(nodeId("t:11")) }]), "cycle")
  })

  it("refuses a cycle that two writes of one edit make together", () => {
    const scene = land(sampleDeck(), [
      ...create(nodeId("t:12"), "frame", ids.slide),
      ...create(nodeId("t:13"), "frame", ids.slide),
    ])
    refusedWith(
      tryLand(scene, [
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
    const scene = sampleDeck()
    const before = revOf(scene, ids.card, "box")
    const next = land(scene, [{ node: ids.card, prop: "name", value: "Card" }])
    expect(revOf(next, ids.card, "name")).toBe(next.rev)
    expect(revOf(next, ids.card, "box")).toBe(before)
    expect(next.nodes.get(ids.card)).toMatchObject({ rev: next.rev })
    expect(next.rev).toBe(scene.rev + 1)
    expect(scene.nodes.get(ids.card)).not.toHaveProperty("name")
  })

  it("keeps the same node object for a node no write touched", () => {
    const scene = sampleDeck()
    const next = land(scene, [{ node: ids.card, prop: "name", value: "Card" }])
    expect(next.nodes.get(ids.side)).toBe(scene.nodes.get(ids.side))
  })
})

describe("idempotence per once", () => {
  it("returns the scene it was given when the edit's once has landed", () => {
    const scene = sampleDeck()
    const edit = {
      once: once(),
      author: person,
      writes: [{ node: ids.card, prop: "name" as const, value: "Card" }],
      rev: rev(scene.rev + 1),
    }
    const first = applyEdit(scene, edit) as Scene
    expect(applyEdit(first, edit)).toBe(first)
    expect(applyEdit(first, { ...edit, rev: rev(first.rev + 1) })).toBe(first)
    expect(first.onces.get(edit.once)).toBe(edit.rev)
  })

  it("does not remember a refused edit", () => {
    const scene = sampleDeck()
    const edit = {
      once: once(),
      author: person,
      writes: [{ node: ids.card, prop: "text" as const, value: textOf("x") }],
      rev: rev(scene.rev + 1),
    }
    expect(isRefusal(applyEdit(scene, edit))).toBe(true)
    expect(scene.onces.has(edit.once)).toBe(false)
  })
})
