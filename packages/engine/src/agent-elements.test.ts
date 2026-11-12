import { readDeckId } from "@airdesign/catalog"
import { decide, elementGone, elementId, type Box, type Register } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, indexDeck, openDeck, type Deck } from "./index.js"

const actor = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const title: Box = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }
const subtitle: Box = { x: 1_524_000, y: 3_602_038, cx: 9_144_000, cy: 1_655_762 }
const grouped: Box = { x: 100, y: 100, cx: 100, cy: 100 }

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const result = indexDeck(openDeck(id.deck), person, {
    deck: "deck",
    once: "index",
    offset: 0,
    total: 4,
    slides: [
      { id: "256", position: 0, size, free: 6, animated: ["5"], layout: [] },
      { id: "257", position: 1, size, free: 2, animated: [], layout: [] },
      { id: "258", position: 2 },
    ],
    elements: [
      { node: elementId("256.2"), kind: "shape", value: "Title", box: title, grouped: false },
      { node: elementId("256.3"), kind: "shape", value: "Sub", box: subtitle, grouped: false },
      { node: elementId("256.4"), kind: "shape", value: "In a group", box: grouped, grouped: true },
      { node: elementId("256.5"), kind: "shape", value: "Animated", box: grouped, grouped: false },
    ],
  })
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function add(deck: Deck, input: Record<string, unknown> = {}, as: typeof actor | typeof person = actor) {
  return call("add_text_box", deck, as, { deck: "deck", base: deck.revision, slide: "256", ...input })
}

function remove(deck: Deck, node: string, as: typeof actor | typeof person = actor) {
  return call("delete_element", deck, as, { deck: "deck", base: deck.revision, node })
}

function landed<Result extends { ok: boolean }>(result: Result): Extract<Result, { ok: true }> {
  if (!result.ok) throw new Error(JSON.stringify(result))
  return result as Extract<Result, { ok: true }>
}

function lastAdded(register: Register) {
  const last = register.order.at(-1)
  if (last?.slide !== "element-add") throw new Error("no add")
  return last
}

describe("add_text_box", () => {
  it("adds an empty box at the box the agent sends, under the agent's run, with the next free shape id", () => {
    const box = { x: 10, y: 20, cx: 300, cy: 40 }
    const { deck } = landed(add(opened(), { box }))
    const added = lastAdded(deck.register)
    expect(added).toMatchObject({ id: "256", runId: "run" })
    expect(added.element).toEqual({ node: "256.6", kind: "shape", value: "", box, grouped: false })
    expect(deck.revision).toBe(1)
  })

  it("puts the box in clear space when the agent sends none", () => {
    const { deck } = landed(add(opened()))
    const box = lastAdded(deck.register).element.box
    expect(box).not.toBeNull()
    if (box === null) return
    for (const other of [title, subtitle]) {
      const apart =
        box.x >= other.x + other.cx ||
        other.x >= box.x + box.cx ||
        box.y >= other.y + other.cy ||
        other.y >= box.y + box.cy
      expect(apart).toBe(true)
    }
    expect(box.y + box.cy).toBeLessThanOrEqual(size.height)
  })

  it("hands out a new id for every box and keeps two boxes in a row apart", () => {
    const first = landed(add(opened()))
    const second = landed(add(first.deck))
    expect(lastAdded(second.deck.register).element.node).toBe("256.7")
    expect(lastAdded(second.deck.register).element.box).not.toEqual(lastAdded(first.deck.register).element.box)
  })

  it("adds a box to a slide the run added, and one cloned from a slide", () => {
    const born = landed(call("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256", layout: "256" })).deck
    const slide = born.register.order.at(-1)?.id
    expect(slide).toBe("259")
    const result = landed(call("add_text_box", born, actor, { deck: "deck", base: 1, slide }))
    expect(lastAdded(result.deck.register).element.node).toBe("259.2")
    const cloned = landed(call("duplicate_slide", opened(), actor, { deck: "deck", base: 0, slide: "256" })).deck
    const copy = landed(call("add_text_box", cloned, actor, { deck: "deck", base: 1, slide: "259" }))
    expect(lastAdded(copy.deck.register).element.node).toBe("259.6")
  })

  it("refuses a slide the index did not measure, a slide that is gone, a stale base, a person and an unindexed deck", () => {
    expect(add(opened(), { slide: "258" })).toEqual({ ok: false, refusal: "dead" })
    expect(add(opened(), { slide: "999" })).toEqual({ ok: false, refusal: "dead" })
    expect(add(opened(), { base: 9 })).toEqual({ ok: false, refusal: "stale" })
    expect(add(opened(), {}, person)).toEqual({ ok: false, refusal: "field" })
    expect(add(openDeck(opened().id))).toEqual({ ok: false, refusal: "indexing" })
    expect(add(opened(), { box: { x: 0, y: 0, cx: 0, cy: 5 } })).toEqual({ ok: false, refusal: "field" })
  })
})

describe("delete_element", () => {
  it("deletes an indexed element under the agent's run", () => {
    const { deck } = landed(remove(opened(), "256.2"))
    expect(elementGone(deck.register, elementId("256.2"))).toBe(true)
    expect(deck.register.order.at(-1)).toMatchObject({ slide: "element-remove", node: "256.2", runId: "run" })
  })

  it("deletes a box the agent added", () => {
    const added = landed(add(opened())).deck
    const { deck } = landed(remove(added, "256.6"))
    expect(elementGone(deck.register, elementId("256.6"))).toBe(true)
  })

  it("refuses a group, an element inside a group, an animated element, a missing element and a second delete", () => {
    expect(remove(opened(), "256.4")).toEqual({ ok: false, refusal: "group-box" })
    expect(remove(opened(), "256.5")).toEqual({ ok: false, refusal: "locked" })
    expect(remove(opened(), "256.9")).toEqual({ ok: false, refusal: "dead" })
    expect(remove(opened(), "999.2")).toEqual({ ok: false, refusal: "dead" })
    const gone = landed(remove(opened(), "256.2")).deck
    expect(remove(gone, "256.2")).toEqual({ ok: false, refusal: "dead" })
    expect(remove(opened(), "256.2", person)).toEqual({ ok: false, refusal: "field" })
    expect(remove(opened(), "256.2", actor)).toMatchObject({ ok: true })
    expect(call("delete_element", opened(), actor, { deck: "deck", base: 4, node: "256.2" })).toEqual({
      ok: false,
      refusal: "stale",
    })
  })

  function running(deck: Deck, runId: string, node: string): Deck {
    const id = elementId(node)
    const opening = decide(deck.register, { command: "add", node: id, floor: "Title", route: "" })
    if (opening.decision !== "apply") throw new Error(opening.code)
    const started = decide(opening.register, { command: "start", runId, node: id })
    if (started.decision !== "apply") throw new Error(started.code)
    return { ...deck, register: started.register }
  }

  it("refuses an element a person typed in during the run, and an element another run holds", () => {
    const held = running(opened(), "run", "256.2")
    const typed = decide(held.register, { command: "person", value: "Mine", node: elementId("256.2") })
    if (typed.decision !== "apply") throw new Error(typed.code)
    expect(remove({ ...held, register: typed.register }, "256.2")).toEqual({ ok: false, refusal: "person-protected" })
    expect(remove(running(opened(), "other", "256.2"), "256.2")).toEqual({ ok: false, refusal: "run-fenced" })
    expect(remove(held, "256.2")).toMatchObject({ ok: true })
  })
})

describe("Undo of a run that added or deleted an element", () => {
  const undo = (deck: Deck) => call("undo_run", deck, person, { deck: "deck", runId: "run" })

  it("takes back an added box", () => {
    const added = landed(add(opened())).deck
    const { deck } = landed(undo(added))
    expect(elementGone(deck.register, elementId("256.6"))).toBe(true)
  })

  it("brings back a deleted element", () => {
    const removed = landed(remove(opened(), "256.2")).deck
    const { deck } = landed(undo(removed))
    expect(elementGone(deck.register, elementId("256.2"))).toBe(false)
  })

  it("takes back an add and a delete of the same run together", () => {
    const added = landed(add(opened())).deck
    const removed = landed(remove(added, "256.6")).deck
    const second = landed(remove(removed, "256.3")).deck
    const { deck } = landed(undo(second))
    expect(elementGone(deck.register, elementId("256.6"))).toBe(true)
    expect(elementGone(deck.register, elementId("256.3"))).toBe(false)
  })

  it("refuses, and changes nothing, when a person typed in the box the run added", () => {
    const added = landed(add(opened())).deck
    const node = elementId("256.6")
    const opening = decide(added.register, { command: "add", node, floor: "", route: "" })
    if (opening.decision !== "apply") throw new Error(opening.code)
    const typed = decide(opening.register, { command: "person", value: "Mine", node })
    if (typed.decision !== "apply") throw new Error(typed.code)
    expect(undo({ ...added, register: typed.register })).toEqual({ ok: false, refusal: "run-fenced" })
  })

  it("refuses when a person brought back the element the run deleted", () => {
    const removed = landed(remove(opened(), "256.2")).deck
    const restored = decide(removed.register, {
      command: "slide",
      file: removed.register.file,
      edit: { slide: "element-restore", id: removed.register.order[0]!.id, node: elementId("256.2") },
    })
    if (restored.decision !== "apply") throw new Error(restored.code)
    expect(undo({ ...removed, register: restored.register })).toEqual({ ok: false, refusal: "run-fenced" })
  })
})

describe("a box a person typed in", () => {
  it("stays closed to the run that added it", () => {
    const added = landed(add(opened())).deck
    const node = elementId("256.6")
    const opening = decide(added.register, { command: "add", node, floor: "", route: "" })
    if (opening.decision !== "apply") throw new Error(opening.code)
    const typed = decide(opening.register, { command: "person", value: "Mine", node })
    if (typed.decision !== "apply") throw new Error(typed.code)
    const held = { ...added, register: typed.register }
    expect(remove(held, "256.6")).toEqual({ ok: false, refusal: "person-protected" })
    expect(
      call("delete_element", held, { actor: "agent", runId: "later" }, { deck: "deck", base: 1, node: "256.6" }).ok,
    ).toBe(true)
  })
})
