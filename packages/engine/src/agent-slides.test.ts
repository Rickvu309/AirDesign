import { readDeckId } from "@airdesign/catalog"
import { presentSlides } from "@airdesign/document"
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
it.fails("Undo restores slide edits from an agent run", () => {
  const result = call("delete_slide", opened(), actor, { deck: "deck", base: 0, slide: "256" })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  const undone = call("undo_run", result.deck, { actor: "person" }, { deck: "deck", runId: "run" })
  expect(undone.ok).toBe(true)
  if (undone.ok) expect(presentSlides(undone.deck.register).map((row) => row.id)).toEqual(["256", "257"])
})
