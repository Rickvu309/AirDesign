import { readDeckId } from "@airdesign/catalog"
import { currentBox, currentValue, elementId, valueBytes } from "@airdesign/document"
import { expect, it } from "vitest"
import { nodeBody } from "./call-fixtures.js"
import { call, openDeck, type Deck } from "./index.js"

const node = elementId("258.7")
const first = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }
const second = { x: 0, y: 0, cx: 1, cy: 1 }
const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function started(deck: Deck): Deck {
  return landed(call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: "258.7" }] }))
}

it("lands a person box from commit_edits on an element nobody opened and counts its bytes", () => {
  const deck = landed(
    call("commit_edits", opened(), person, { deck: "deck", batch: [{ node: "258.7", property: "box", value: first }] }),
  )
  expect(deck.revision).toBe(1)
  expect(currentBox(nodeBody(deck.register, node))).toEqual(first)
  expect(currentValue(nodeBody(deck.register, node))).toBe("")
  expect(deck.register.bytes).toBe(valueBytes({ property: "box", value: first }))
})

it("lands an agent box from edit_deck under its run and undo_run takes it back", () => {
  const moved = landed(
    call("edit_deck", started(opened()), agent, {
      deck: "deck",
      base: 1,
      changes: [{ node: "258.7", readAt: 0, property: "box", value: first }],
    }),
  )
  expect(currentBox(nodeBody(moved.register, node))).toEqual(first)
  const undone = landed(call("undo_run", moved, person, { deck: "deck", runId: "run" }))
  expect(currentBox(nodeBody(undone.register, node))).toBeNull()
})

it("refuses an agent box after a person moved the element during the run, and a stale read", () => {
  const running = started(opened())
  const guarded = landed(
    call("commit_edits", running, person, { deck: "deck", batch: [{ node: "258.7", property: "box", value: first }] }),
  )
  const change = { node: "258.7", readAt: 1, property: "box", value: second }
  expect(call("edit_deck", guarded, agent, { deck: "deck", base: 2, changes: [change] })).toEqual({
    ok: false,
    refusal: "person-protected",
  })
  const stale = { ...change, readAt: 5 }
  expect(call("edit_deck", running, agent, { deck: "deck", base: 1, changes: [stale] })).toEqual({
    ok: false,
    refusal: "stale",
  })
})
