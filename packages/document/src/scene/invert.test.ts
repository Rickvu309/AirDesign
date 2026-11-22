import { describe, expect, it } from "vitest"
import { applyEdit, invert, isRefusal, nodeId, rev, type Landed, type Scene, type Write } from "./index.js"
import {
  box,
  create,
  hex,
  ids,
  once,
  person,
  place,
  revOf,
  sampleDeck,
  textOf,
  theme,
  tryLand,
  valuesOf,
} from "./sample-deck.js"

function step(scene: Scene, writes: readonly Write[], by = person) {
  const edit: Landed = { once: once(), author: by, writes, rev: rev(scene.rev + 1) }
  const after = applyEdit(scene, edit)
  if (isRefusal(after)) throw new Error(`refused ${JSON.stringify(after)}`)
  return { before: scene, after, edit }
}

describe("invert", () => {
  it("puts back what the edit replaced, and unsets what it added", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.card, prop: "box", value: box(900) },
      { node: ids.card, prop: "name", value: "Card" },
    ])
    const undone = tryLand(after, invert(before, after, edit)) as Scene
    expect(undone.nodes.get(ids.card)).toMatchObject({ box: box(100) })
    expect(undone.nodes.get(ids.card)).not.toHaveProperty("name")
  })

  it("restores only the props nobody wrote since", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.card, prop: "box", value: box(900) },
      { node: ids.card, prop: "name", value: "Card" },
    ])
    const later = step(after, [{ node: ids.card, prop: "name", value: "Theirs" }])
    const writes = invert(before, later.after, edit)
    expect(writes.map((write) => write.prop)).toEqual(["box"])
    const undone = tryLand(later.after, writes) as Scene
    expect(undone.nodes.get(ids.card)).toMatchObject({ box: box(100), name: "Theirs" })
  })

  it("restores nothing when every prop moved on", () => {
    const { before, after, edit } = step(sampleDeck(), [{ node: ids.card, prop: "name", value: "Card" }])
    const later = step(after, [{ node: ids.card, prop: "name", value: "Theirs" }])
    expect(invert(before, later.after, edit)).toEqual([])
  })

  it("carries the edit's rev as the base of each write, so a write that lands late is stale", () => {
    const { before, after, edit } = step(sampleDeck(), [{ node: ids.card, prop: "opacity", value: 0.5 }])
    const writes = invert(before, after, edit)
    expect(writes).toEqual([{ node: ids.card, prop: "opacity", value: null, base: edit.rev }])
    const raced = step(after, [{ node: ids.card, prop: "opacity", value: 0.9 }])
    expect(tryLand(raced.after, writes)).toMatchObject({ refused: "stale", node: ids.card, prop: "opacity" })
  })

  it("lands every write or none, so a step on two nodes turns whole", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.card, prop: "opacity", value: 0.5 },
      { node: ids.side, prop: "opacity", value: 0.5 },
    ])
    const writes = invert(before, after, edit)
    expect(writes).toHaveLength(2)
    const raced = step(after, [{ node: ids.side, prop: "opacity", value: 0.9 }])
    expect(isRefusal(tryLand(raced.after, writes))).toBe(true)
    expect(valuesOf(raced.after)[ids.card]).toMatchObject({ opacity: 0.5 })
  })

  it("restores a text only while its rev is the edit's", () => {
    const scene = sampleDeck()
    const base = revOf(scene, ids.title, "text")!
    const typed = step(scene, [{ node: ids.title, prop: "text", value: textOf("Revenue!"), base }])
    const undone = tryLand(typed.after, invert(typed.before, typed.after, typed.edit)) as Scene
    expect(undone.nodes.get(ids.title)).toMatchObject({ text: { chars: "Revenue" } })
    const theirs = step(typed.after, [
      { node: ids.title, prop: "text", value: textOf("Theirs"), base: revOf(typed.after, ids.title, "text")! },
    ])
    expect(invert(typed.before, theirs.after, typed.edit)).toEqual([])
  })

  it("undoes a creation by deleting the node, and a delete by putting the parent back", () => {
    const fresh = nodeId("t:40")
    const created = step(sampleDeck(), create(fresh, "frame", ids.slide))
    const deletion = invert(created.before, created.after, created.edit)
    expect(deletion).toEqual([{ node: fresh, prop: "parent", value: null, base: created.edit.rev }])
    const gone = tryLand(created.after, deletion) as Scene
    expect(gone.children.get(ids.slide)).not.toContain(fresh)

    const removed = step(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
    const back = tryLand(removed.after, invert(removed.before, removed.after, removed.edit)) as Scene
    expect(back.nodes.get(ids.card)).toMatchObject({
      parent: (valuesOf(sampleDeck())[ids.card] as { parent: unknown }).parent,
    })
    expect(back.children.get(ids.slide)).toEqual([ids.card, ids.side])
  })

  it("puts the parent first, so a deleted node comes back before its other props are restored", () => {
    const removed = step(sampleDeck(), [
      { node: ids.card, prop: "name", value: "Card" },
      { node: ids.card, prop: "parent", value: null },
    ])
    const writes = invert(removed.before, removed.after, removed.edit)
    expect(writes.map((write) => write.prop)).toEqual(["parent", "name"])
    expect(isRefusal(tryLand(removed.after, writes))).toBe(false)
  })

  it("leaves a node alone that someone put back somewhere else", () => {
    const removed = step(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
    const revived = step(removed.after, [{ node: ids.card, prop: "parent", value: place(ids.side) }])
    expect(invert(removed.before, revived.after, removed.edit)).toEqual([])
  })

  it("restores theme variables one by one", () => {
    const first = step(sampleDeck(), [
      { node: ids.deck, prop: "theme.colors.accent1", value: hex(0x111111) },
      { node: ids.deck, prop: "theme.colors.accent2", value: hex(0x222222) },
    ])
    const second = step(first.after, [{ node: ids.deck, prop: "theme.colors.accent2", value: hex(0x333333) }])
    const writes = invert(first.before, second.after, first.edit)
    expect(writes.map((write) => write.prop)).toEqual(["theme.colors.accent1"])
    const undone = tryLand(second.after, writes) as Scene
    expect(undone.nodes.get(ids.deck)).toMatchObject({
      theme: { colors: { accent1: theme().colors.accent1, accent2: hex(0x333333) } },
    })
  })

  it("expands a whole theme write into its variables", () => {
    const original = sampleDeck()
    const next = step(original, [
      {
        node: ids.deck,
        prop: "theme",
        value: { ...theme(), fonts: { heading: "Fraunces", body: "Fraunces" } },
        base: revOf(original, ids.deck, "theme")!,
      },
    ])
    const writes = invert(next.before, next.after, next.edit)
    expect(writes.length).toBeGreaterThan(1)
    expect(writes.every((write) => String(write.prop).startsWith("theme."))).toBe(true)
    const undone = tryLand(next.after, writes) as Scene
    expect(valuesOf(undone)[ids.deck]).toEqual(valuesOf(original)[ids.deck])
  })
})
