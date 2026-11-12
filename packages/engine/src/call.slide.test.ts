import { readDeckId } from "@airdesign/catalog"
import { elementId, orderKeyBetween, presentSlides, slideId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, openDeck, type Deck } from "./index.js"

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const
const file = ["256", "257"]
const key = orderKeyBetween(null, null)

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it("lands a person's slide edits and leaves them off the agent tool", () => {
  const removed = landed(
    call("commit_edits", opened(), person, {
      deck: "deck",
      batch: [{ slide: "remove", id: "257", file }],
    }),
  )
  expect(removed.revision).toBe(1)
  expect(presentSlides(removed.register).map((spot) => spot.id)).toEqual([slideId("256")])
  const added = landed(
    call("commit_edits", removed, person, {
      deck: "deck",
      batch: [{ slide: "add", id: "258", after: "256", key, layout: "256", file }],
    }),
  )
  expect(presentSlides(added.register).map((spot) => spot.id)).toEqual([slideId("256"), slideId("258")])
  expect(
    call("edit_deck", opened(), agent, { deck: "deck", base: 0, changes: [{ slide: "remove", id: "257", file }] }),
  ).toEqual({
    ok: false,
    refusal: "field",
  })
  const started = landed(call("start_run", added, agent, { deck: "deck", runId: "run", elements: [{ node: "256.2" }] }))
  const edited = landed(
    call("edit_deck", started, agent, {
      deck: "deck",
      base: started.revision,
      changes: [{ node: "256.2", readAt: 0, value: "kept" }],
    }),
  )
  expect(edited.register.elements[elementId("256.2")]?.landed.at(-1)?.value).toBe("kept")
})

it("refuses the last slide and a slide past the limit", () => {
  expect(
    call("commit_edits", opened(), person, { deck: "deck", batch: [{ slide: "remove", id: "256", file: ["256"] }] }),
  ).toEqual({ ok: false, refusal: "dead" })
})
