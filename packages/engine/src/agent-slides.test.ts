import { changeCall } from "./call-fixtures.js"
import { readDeckId } from "@airdesign/catalog"
import {
  decide,
  elementId,
  gridGroups,
  orderKeyBetween,
  presentSlides,
  readSlideId,
  writeTextValue,
} from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck } from "./index.js"

const actor = { actor: "agent", runId: "run" } as const
function opened(count = 2) {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const result = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 0,
      slides: Array.from({ length: count }, (_, position) => ({ id: String(position + 256), position, layout: [] })),
      elements: [],
    },
  )
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}
it("adds below the source slide group through the existing agent change and undoes the run", () => {
  const result = changeCall("add_slide", opened(6), actor, {
    deck: "deck",
    base: 0,
    after: "257",
    layout: "256",
    group: "new",
  })
  if (!result.ok) throw new Error(result.refusal)
  expect(gridGroups(result.deck.register)).toEqual([["256", "257", "258", "259"], ["262"], ["260", "261"]])
  expect(result.deck.register.order.at(-1)).toMatchObject({ grid: 1, row: "new", after: "257", runId: "run" })
  const undone = call("undo_run", result.deck, { actor: "person" }, { deck: "deck", runId: "run" })
  if (!undone.ok) throw new Error(undone.refusal)
  expect(gridGroups(undone.deck.register)).toEqual([
    ["256", "257", "258", "259"],
    ["260", "261"],
  ])
})
for (const [op, input, ids] of [
  ["add_slide", { after: "256", layout: "256" }, ["256", "258", "257"]],
  ["duplicate_slide", { slide: "256" }, ["256", "258", "257"]],
  ["delete_slide", { slide: "256" }, ["257"]],
  ["move_slide", { slide: "257", after: null }, ["257", "256"]],
] as const) {
  it(`runs ${op} through the agent caller`, () => {
    const result = changeCall(op, opened(), actor, { deck: "deck", base: 0, ...input })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(presentSlides(result.deck.register).map((row) => row.id)).toEqual(ids)
    expect(result.deck.revision).toBe(1)
  })
}
for (const [op, input, ids] of [
  ["add_slide", { after: "256", layout: "256" }, ["256", "257"]],
  ["duplicate_slide", { slide: "256" }, ["256", "257"]],
  ["delete_slide", { slide: "256" }, ["256", "257"]],
  ["move_slide", { slide: "257", after: null }, ["256", "257"]],
] as const) {
  it(`Undo of a run that used ${op} restores the slide order`, () => {
    const result = changeCall(op, opened(), actor, { deck: "deck", base: 0, ...input })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const undone = call("undo_run", result.deck, { actor: "person" }, { deck: "deck", runId: "run" })
    expect(undone.ok).toBe(true)
    if (undone.ok) expect(presentSlides(undone.deck.register).map((row) => row.id)).toEqual(ids)
  })
}
it("refuses Undo of a run once a person moved the slide the run added", () => {
  const result = changeCall("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256", layout: "256" })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  const added = readSlideId("258")
  if (added === undefined) throw new Error("slide")
  const moved = decide(result.deck.register, {
    command: "slide",
    file: result.deck.register.file,
    edit: { slide: "move", id: added, key: orderKeyBetween(null, null) },
  })
  expect(moved.decision).toBe("apply")
  if (moved.decision !== "apply") return
  const undone = call(
    "undo_run",
    { ...result.deck, register: moved.register },
    { actor: "person" },
    { deck: "deck", runId: "run" },
  )
  expect(undone).toEqual({ ok: false, refusal: "run-fenced" })
})
it("refuses a second Undo of a run once a person deleted again the slide the first brought back", () => {
  const removed = changeCall("delete_slide", opened(), actor, { deck: "deck", base: 0, slide: "256" })
  if (!removed.ok) throw new Error(removed.refusal)
  const back = call("undo_run", removed.deck, { actor: "person" }, { deck: "deck", runId: "run" })
  if (!back.ok) throw new Error(back.refusal)
  const slide = readSlideId("256")
  if (slide === undefined) throw new Error("slide")
  const deleted = decide(back.deck.register, {
    command: "slide",
    file: back.deck.register.file,
    edit: { slide: "remove", id: slide },
  })
  if (deleted.decision !== "apply") throw new Error(deleted.code)
  const again = call(
    "undo_run",
    { ...back.deck, register: deleted.register },
    { actor: "person" },
    { deck: "deck", runId: "run" },
  )
  expect(again).toEqual({ ok: false, refusal: "run-fenced" })
})
it("uses the requested layout's package relationships when inserting after a different slide", () => {
  const result = changeCall("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256", layout: "257" })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.deck.register.order.at(-1)).toMatchObject({ slide: "add", after: "256", layout: "257" })
  expect(presentSlides(result.deck.register).map((row) => row.id)).toEqual(["256", "258", "257"])
})
it("Undo of a run that added a slide and titled it removes the slide", () => {
  const title = {
    node: elementId("256.2"),
    kind: "shape",
    value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
    box: null,
    grouped: false,
  } as const
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, layout: [title] }],
      elements: [title],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  const added = changeCall("add_slide", indexed.deck, actor, { deck: "deck", base: 0, after: "256", layout: "256" })
  expect(added.ok).toBe(true)
  if (!added.ok) return
  const started = call("start_run", added.deck, actor, { deck: "deck", runId: "run", elements: [{ node: "257.2" }] })
  expect(started).toMatchObject({ ok: true })
  if (!started.ok) return
  const titled = call("edit_deck", started.deck, actor, {
    deck: "deck",
    base: started.deck.revision,
    changes: [{ node: "257.2", value: "Hello", readAt: 0 }],
  })
  expect(titled).toMatchObject({ ok: true })
  if (!titled.ok) return
  const undone = call("undo_run", titled.deck, { actor: "person" }, { deck: "deck", runId: "run" })
  expect(undone).toMatchObject({ ok: true })
  if (undone.ok) expect(presentSlides(undone.deck.register).map((row) => row.id)).toEqual(["256"])
})

it("moves a complete slide group in one revision through edit and undoes the run", () => {
  const result = changeCall("move_slides", opened(6), actor, {
    deck: "deck",
    base: 0,
    slides: ["261", "260"],
    after: null,
    group: "keep",
  })
  if (!result.ok) throw new Error(result.refusal)
  expect(result.deck.revision).toBe(1)
  expect(result.deck.register.order).toHaveLength(1)
  expect(gridGroups(result.deck.register)).toEqual([
    ["260", "261"],
    ["256", "257", "258", "259"],
  ])
  const undone = call("undo_run", result.deck, { actor: "person" }, { deck: "deck", runId: "run" })
  if (!undone.ok) throw new Error(undone.refusal)
  expect(gridGroups(undone.deck.register)).toEqual([
    ["256", "257", "258", "259"],
    ["260", "261"],
  ])
})

it("duplicates and deletes the selected slides through edit in one revision per call", () => {
  const deck = opened(7)
  const original = [
    ["256", "257", "258", "259"],
    ["260", "261", "262"],
  ]
  const copy = changeCall("duplicate_slides", deck, actor, { deck: "deck", base: 0, slides: ["261", "257"] })
  if (!copy.ok) throw new Error(copy.refusal)
  expect(copy.deck.revision).toBe(1)
  expect(copy.deck.register.order).toHaveLength(1)
  expect(gridGroups(copy.deck.register)).toEqual([
    ["256", "257", "258", "259"],
    ["260", "261", "263", "264", "262"],
  ])
  const deletion = changeCall("delete_slides", copy.deck, actor, { deck: "deck", base: 1, slides: ["256", "260"] })
  if (!deletion.ok) throw new Error(deletion.refusal)
  expect(deletion.deck.revision).toBe(2)
  expect(deletion.deck.register.order).toHaveLength(2)
  expect(gridGroups(deletion.deck.register)).toEqual([
    ["257", "258", "259"],
    ["261", "263", "264", "262"],
  ])
  const undone = call("undo_run", deletion.deck, { actor: "person" }, { deck: "deck", runId: "run" })
  if (!undone.ok) throw new Error(undone.refusal)
  expect(gridGroups(undone.deck.register)).toEqual(original)
})
