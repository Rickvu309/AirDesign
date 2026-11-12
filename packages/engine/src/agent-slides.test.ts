import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, orderKeyBetween, presentSlides, readSlideId, writeTextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck } from "./index.js"

const actor = { actor: "agent", runId: "run" } as const
function opened() {
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
      slides: [
        { id: "256", position: 0, layout: [] },
        { id: "257", position: 1, layout: [] },
      ],
      elements: [],
    },
  )
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}
for (const [op, input, ids] of [
  ["add_slide", { after: "256", layout: "256" }, ["256", "258", "257"]],
  ["duplicate_slide", { slide: "256" }, ["256", "258", "257"]],
  ["delete_slide", { slide: "256" }, ["257"]],
  ["move_slide", { slide: "257", after: null }, ["257", "256"]],
] as const) {
  it(`runs ${op} through the agent caller`, () => {
    const result = call(op, opened(), actor, { deck: "deck", base: 0, ...input })
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
    const result = call(op, opened(), actor, { deck: "deck", base: 0, ...input })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const undone = call("undo_run", result.deck, { actor: "person" }, { deck: "deck", runId: "run" })
    expect(undone.ok).toBe(true)
    if (undone.ok) expect(presentSlides(undone.deck.register).map((row) => row.id)).toEqual(ids)
  })
}
it("refuses Undo of a run once a person moved the slide the run added", () => {
  const result = call("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256", layout: "256" })
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
it("uses the requested layout's package relationships when inserting after a different slide", () => {
  const result = call("add_slide", opened(), actor, { deck: "deck", base: 0, after: "256", layout: "257" })
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
  const added = call("add_slide", indexed.deck, actor, { deck: "deck", base: 0, after: "256", layout: "256" })
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
