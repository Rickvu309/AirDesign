import { changeCall } from "./call-fixtures.js"
import { readDeckId } from "@airdesign/catalog"
import {
  decide,
  elementGone,
  elementId,
  slideId,
  plainSlideNumber,
  textOpening,
  writeTextValue,
  type Box,
  type ElementId,
  type Register,
} from "@airdesign/document"
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
  return call(
    "edit_deck",
    deck,
    as,
    (({ deck, base, ...change }) => ({ deck, base, changes: [{ op: "add", kind: "shape", ...change }] }))({
      deck: "deck",
      base: deck.revision,
      slide: "256",
      ...input,
    }),
  )
}

function remove(deck: Deck, node: string, as: typeof actor | typeof person = actor) {
  return changeCall("delete", deck, as, { deck: "deck", base: deck.revision, node })
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

it("lands native numbers across slides through one agent edit and refuses to add a second number", () => {
  const value = writeTextValue([{ from: 0, runs: [{ from: -1, text: "1", slideNumber: plainSlideNumber }] }])
  const deck = opened()
  const changes = ["256", "257"].map((slide) => ({ op: "add", kind: "shape", slide, text: { value } }))
  const result = landed(call("edit_deck", deck, actor, { deck: "deck", base: deck.revision, changes }))
  expect(result.deck.revision).toBe(deck.revision + 1)
  expect(result.deck.register.order.map((command) => command.slide === "element-add" && command.element.value)).toEqual(
    [value, value],
  )
  expect(add(result.deck, { text: { value } })).toEqual({ ok: false, refusal: "present" })
})

describe("add_text_box", () => {
  it("adds an empty box at the box the agent sends, under the agent's run, with the next free shape id", () => {
    const box = { x: 10, y: 20, cx: 300, cy: 40 }
    const { deck } = landed(
      add(opened(), { box: { x: box.x / 12700, y: box.y / 12700, w: box.cx / 12700, h: box.cy / 12700 } }),
    )
    const added = lastAdded(deck.register)
    expect(added).toMatchObject({ id: "256", runId: "run" })
    expect(added.element).toEqual({
      node: "256.6",
      kind: "shape",
      value: "",
      box,
      grouped: false,
      opening: textOpening("fixed"),
    })
    expect(deck.revision).toBe(1)
  })

  it("makes text with no inset that hugs its height inside the free area when the agent sends no box, as a person's text does", () => {
    const { deck } = landed(add(opened(), { text: { value: "Takeaway" } }))
    const added = lastAdded(deck.register)
    expect(added.element.opening).toEqual(textOpening("auto-height"))
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
    const born = landed(
      changeCall("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256", layout: "256" }),
    ).deck
    const slide = born.register.order.find((command) => command.slide === "add" || command.slide === "clone")?.id
    expect(slide).toBe("259")
    const result = landed(
      call("edit_deck", born, actor, { deck: "deck", base: 1, changes: [{ op: "add", kind: "shape", slide }] }),
    )
    expect(lastAdded(result.deck.register).element.node).toBe("259.2")
    const cloned = landed(changeCall("duplicate_slide", opened(), actor, { deck: "deck", base: 0, slide: "256" })).deck
    const copy = landed(
      call("edit_deck", cloned, actor, {
        deck: "deck",
        base: 1,
        changes: [{ op: "add", kind: "shape", slide: "259" }],
      }),
    )
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
    expect(changeCall("delete", opened(), actor, { deck: "deck", base: 4, node: "256.2" })).toEqual({
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

  it("takes back a box the run added and wrote in", () => {
    const added = landed(add(opened())).deck
    const node = elementId("256.6")
    const started = landed(call("start_run", added, actor, { deck: "deck", runId: "run", elements: [{ node }] })).deck
    const wrote = landed(
      call("edit_deck", started, actor, {
        deck: "deck",
        base: started.revision,
        changes: [{ node, value: "Mine", readAt: 0 }],
      }),
    ).deck
    const { deck } = landed(undo(wrote))
    expect(elementGone(deck.register, node)).toBe(true)
  })

  it("refuses, and changes nothing, when another run wrote in the box the run added", () => {
    const added = landed(add(opened())).deck
    const node = elementId("256.6")
    const other = { actor: "agent", runId: "other" } as const
    const started = landed(call("start_run", added, other, { deck: "deck", runId: "other", elements: [{ node }] })).deck
    const wrote = landed(
      call("edit_deck", started, other, {
        deck: "deck",
        base: started.revision,
        changes: [{ node, value: "Theirs", readAt: 0 }],
      }),
    ).deck
    expect(undo(wrote)).toEqual({ ok: false, refusal: "run-fenced" })
  })

  it("refuses when a person brought back the element the run deleted", () => {
    const removed = landed(remove(opened(), "256.2")).deck
    const restored = decide(removed.register, {
      command: "slide",
      file: removed.register.file,
      edit: { slide: "element-restore", id: slideId("256"), node: elementId("256.2") },
    })
    if (restored.decision !== "apply") throw new Error(restored.code)
    expect(undo({ ...removed, register: restored.register })).toEqual({ ok: false, refusal: "run-fenced" })
  })

  function shown(deck: Deck, node: ElementId, edit: "element-remove" | "element-restore"): Deck {
    const decision = decide(deck.register, {
      command: "slide",
      file: deck.register.file,
      edit: { slide: edit, id: slideId("256"), node },
    })
    if (decision.decision !== "apply") throw new Error(decision.code)
    return { ...deck, register: decision.register }
  }

  it("refuses a second Undo once a person deleted again the element the first brought back", () => {
    const node = elementId("256.2")
    const back = landed(undo(landed(remove(opened(), node)).deck)).deck
    const deleted = shown(back, node, "element-remove")
    expect(undo(deleted)).toEqual({ ok: false, refusal: "run-fenced" })
    expect(elementGone(deleted.register, node)).toBe(true)
  })

  it("refuses a second Undo once another tab brought back the box the first took away", () => {
    const node = elementId("256.6")
    const gone = landed(undo(landed(add(opened())).deck)).deck
    expect(undo(shown(gone, node, "element-restore"))).toEqual({ ok: false, refusal: "run-fenced" })
  })

  it("refuses once another tab removed the box the run added and brought it back", () => {
    const node = elementId("256.6")
    const added = landed(add(opened())).deck
    const back = shown(shown(added, node, "element-remove"), node, "element-restore")
    expect(undo(back)).toEqual({ ok: false, refusal: "run-fenced" })
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
      changeCall("delete", held, { actor: "agent", runId: "later" }, { deck: "deck", base: 1, node: "256.6" }).ok,
    ).toBe(true)
  })
})

describe("text the device measured", () => {
  it("stays open to the run that added it, since the measured size follows the text", () => {
    const added = landed(add(opened(), { text: { value: "Takeaway" } })).deck
    const node = elementId("256.6")
    const patch = { box: { w: { set: 900_000 }, h: { set: 274_320 } } }
    const measured = decide(added.register, { command: "person", v: 13, patch, node })
    if (measured.decision !== "apply") throw new Error(measured.code)
    expect(remove({ ...added, register: measured.register }, "256.6").ok).toBe(true)
  })

  it("keeps the run's read fresh across the size the open tab measured, and not across a person's edit", () => {
    const added = landed(add(opened(), { text: { value: "Takeaway" } })).deck
    const size = { v: 13, patch: { box: { w: { set: 900_000 }, h: { set: 274_320 } } } }
    const measured = landed(call("commit_edits", added, person, { deck: "deck", batch: [{ ...size, node: "256.6" }] }))
    const set = (after: Deck) =>
      call("edit_deck", after, actor, {
        deck: "deck",
        base: added.revision,
        changes: [{ op: "set", target: "256.6", text: { value: "Takeaway, longer" } }],
      })
    expect(set(measured.deck).ok).toBe(true)
    const typed = landed(
      call("commit_edits", added, person, { deck: "deck", batch: [{ value: "Mine", node: "256.2" }] }),
    )
    expect(set(typed.deck)).toEqual({ ok: false, refusal: "stale" })
  })
})

describe("a run that ended", () => {
  it("cannot add or delete an element", () => {
    const node = elementId("256.2")
    const opening = decide(opened().register, { command: "add", node, floor: "Title", route: "" })
    if (opening.decision !== "apply") throw new Error(opening.code)
    const started = decide(opening.register, { command: "start", runId: "run", node })
    if (started.decision !== "apply") throw new Error(started.code)
    const stopped = decide(started.register, { command: "stop", runId: "run", node })
    if (stopped.decision !== "apply") throw new Error(stopped.code)
    const ended = { ...opened(), register: stopped.register }
    expect(add(ended)).toEqual({ ok: false, refusal: "run-fenced" })
    expect(remove(ended, "256.3")).toEqual({ ok: false, refusal: "run-fenced" })
  })
})
