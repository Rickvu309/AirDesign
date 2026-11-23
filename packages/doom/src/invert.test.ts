import { describe, expect, it } from "vitest"
import { applyEdit, invert, isRefusal, nodeId, rev, type Landed, type Doom, type Write } from "./index.js"
import {
  box,
  create,
  hex,
  ids,
  land,
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

function step(doom: Doom, writes: readonly Write[], by = person) {
  const edit: Landed = { once: once(), author: by, writes, rev: rev(doom.rev + 1) }
  const after = applyEdit(doom, edit)
  if (isRefusal(after)) throw new Error(`refused ${JSON.stringify(after)}`)
  return { before: doom, after, edit }
}

describe("invert", () => {
  it("puts back what the edit replaced, and unsets what it added", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.card, prop: "box", value: box(900) },
      { node: ids.card, prop: "name", value: "Card" },
    ])
    const undone = tryLand(after, invert(before, after, edit)) as Doom
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
    const undone = tryLand(later.after, writes) as Doom
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
    const doom = sampleDeck()
    const base = revOf(doom, ids.title, "text")!
    const typed = step(doom, [{ node: ids.title, prop: "text", value: textOf("Revenue!"), base }])
    const undone = tryLand(typed.after, invert(typed.before, typed.after, typed.edit)) as Doom
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
    const gone = tryLand(created.after, deletion) as Doom
    expect(gone.children.get(ids.slide)).not.toContain(fresh)

    const removed = step(sampleDeck(), [{ node: ids.card, prop: "parent", value: null }])
    const back = tryLand(removed.after, invert(removed.before, removed.after, removed.edit)) as Doom
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

  it("puts a delete last, so the redo of typing and a delete in one step writes the text before the delete", () => {
    const base = revOf(sampleDeck(), ids.title, "text")!
    const emptied = step(sampleDeck(), [
      { node: ids.title, prop: "text", value: textOf("Draft"), base },
      { node: ids.title, prop: "parent", value: null },
    ])
    const undone = step(emptied.after, invert(emptied.before, emptied.after, emptied.edit))
    const redo = invert(undone.before, undone.after, undone.edit)
    expect(redo.map((write) => write.prop)).toEqual(["text", "parent"])
    const redone = tryLand(undone.after, redo) as Doom
    expect(redone.nodes.get(ids.title)).toMatchObject({ parent: null, text: { chars: "Draft" } })
  })

  it("brings an ungrouped frame back before its children move back into it", () => {
    const ungrouped = step(sampleDeck(), [
      { node: ids.title, prop: "parent", value: place(ids.slide) },
      { node: ids.card, prop: "parent", value: null },
    ])
    const undone = tryLand(ungrouped.after, invert(ungrouped.before, ungrouped.after, ungrouped.edit))
    expect(isRefusal(undone)).toBe(false)
    expect((undone as Doom).children.get(ids.slide)).toEqual([ids.card, ids.side])
    expect((undone as Doom).children.get(ids.card)).toEqual([ids.title])
  })

  it("moves a node out of the way before its old child takes it back", () => {
    const nested = step(sampleDeck(), [{ node: ids.side, prop: "parent", value: place(ids.card) }]).after
    const swapped = step(nested, [
      { node: ids.side, prop: "parent", value: place(ids.slide) },
      { node: ids.card, prop: "parent", value: place(ids.side) },
    ])
    const undone = tryLand(swapped.after, invert(swapped.before, swapped.after, swapped.edit))
    expect(isRefusal(undone)).toBe(false)
    expect((undone as Doom).children.get(ids.slide)).toEqual([ids.card])
    expect((undone as Doom).children.get(ids.card)).toEqual([ids.side, ids.title])
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
    const undone = tryLand(second.after, writes) as Doom
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
    const undone = tryLand(next.after, writes) as Doom
    expect(valuesOf(undone)[ids.deck]).toEqual(valuesOf(original)[ids.deck])
  })

  it("leaves out a layer someone deleted since, and puts back the rest of the edit", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.card, prop: "opacity", value: 0.5 },
      { node: ids.side, prop: "opacity", value: 0.5 },
    ])
    const later = step(after, [{ node: ids.side, prop: "parent", value: null }])
    const writes = invert(before, later.after, edit)
    expect(writes).toEqual([{ node: ids.card, prop: "opacity", value: null, base: edit.rev }])
    expect(tryLand(later.after, writes)).not.toHaveProperty("refused")
  })

  it("leaves a layer where it is when the layer it came from was deleted since", () => {
    const { before, after, edit } = step(sampleDeck(), [{ node: ids.title, prop: "parent", value: place(ids.side) }])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([])
  })

  it("leaves a layer where it is when the layer it came from sits in a frame deleted since", () => {
    const [inner, innermost] = [nodeId("t:10"), nodeId("t:11")]
    const nested = land(sampleDeck(), [...create(inner, "frame", ids.card), ...create(innermost, "frame", inner)])
    const { before, after, edit } = step(nested, [{ node: innermost, prop: "parent", value: place(ids.side) }])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(before, later.after, edit)).toEqual([])
  })

  it("leaves a layer where it is when putting it back would put it inside itself", () => {
    const [inner, innermost] = [nodeId("t:10"), nodeId("t:11")]
    const nested = land(sampleDeck(), [...create(inner, "frame", ids.card), ...create(innermost, "frame", inner)])
    const out = step(nested, [{ node: innermost, prop: "parent", value: place(ids.side) }])
    const under = step(out.after, [{ node: inner, prop: "parent", value: place(innermost) }])
    const later = step(under.after, [{ node: ids.card, prop: "parent", value: null }])
    expect(invert(under.before, later.after, under.edit)).toEqual([])
    expect(invert(out.before, later.after, out.edit)).toEqual([])
  })

  it("puts a layer back into a frame that stands, though the move that would put that frame back is left out", () => {
    const [inner, innermost, leaf] = [nodeId("t:10"), nodeId("t:11"), nodeId("t:12")]
    const nested = land(sampleDeck(), [
      ...create(inner, "frame", ids.card),
      ...create(innermost, "frame", inner),
      ...create(leaf, "shape", innermost),
    ])
    const { before, after, edit } = step(nested, [
      { node: inner, prop: "parent", value: place(ids.slide) },
      { node: leaf, prop: "parent", value: place(inner) },
    ])
    const later = step(after, [{ node: ids.card, prop: "parent", value: null }])
    const writes = invert(before, later.after, edit)
    expect(writes).toEqual([{ node: leaf, prop: "parent", value: place(innermost), base: edit.rev }])
    expect(tryLand(later.after, writes)).not.toHaveProperty("refused")
  })

  it("keeps a frame the undo would delete while a layer the undo leaves in place, or someone else's, still sits in it", () => {
    const [inner, leaf, wrap] = [nodeId("t:10"), nodeId("t:11"), nodeId("t:12")]
    const nested = land(sampleDeck(), [...create(inner, "frame", ids.card), ...create(leaf, "shape", inner)])
    const { before, after, edit } = step(nested, [
      ...create(wrap, "frame", inner, { node: wrap, prop: "box", value: box(100) }),
      { node: leaf, prop: "parent", value: place(wrap) },
      { node: leaf, prop: "box", value: box(0) },
    ])
    for (const gone of [ids.card, inner]) {
      const later = step(after, [{ node: gone, prop: "parent", value: null }])
      expect(invert(before, later.after, edit)).toEqual([])
    }
    const theirs = step(after, [{ node: ids.caption, prop: "parent", value: place(wrap) }])
    const writes = invert(before, theirs.after, edit)
    expect(writes).toEqual([
      { node: leaf, prop: "parent", value: place(inner), base: edit.rev },
      { node: leaf, prop: "box", value: null, base: edit.rev },
    ])
    expect((tryLand(theirs.after, writes) as Doom).children.get(wrap)).toEqual([ids.caption])
  })

  it("keeps the writes to a layer the undo itself puts back", () => {
    const { before, after, edit } = step(sampleDeck(), [
      { node: ids.caption, prop: "opacity", value: 0.5 },
      { node: ids.caption, prop: "parent", value: null },
    ])
    const writes = invert(before, after, edit)
    expect(writes.map((write) => write.prop)).toEqual(["parent", "opacity"])
    const undone = tryLand(after, writes) as Doom
    expect(undone.nodes.get(ids.caption)).toMatchObject({ parent: { id: ids.side } })
  })

  it("treats a rev the caller owns as the edit's own, and bases the write on the rev it found", () => {
    const first = step(sampleDeck(), [{ node: ids.card, prop: "opacity", value: 0.5 }])
    const second = step(first.after, [{ node: ids.card, prop: "opacity", value: 0.2 }])
    const undone = step(second.after, invert(first.after, second.after, second.edit))
    expect(invert(first.before, undone.after, first.edit)).toEqual([])
    const writes = invert(first.before, undone.after, first.edit, new Set([undone.edit.rev]))
    expect(writes).toEqual([{ node: ids.card, prop: "opacity", value: null, base: undone.edit.rev }])
    expect(tryLand(undone.after, writes)).not.toHaveProperty("refused")
  })
})
