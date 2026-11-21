import { readDeckId } from "@airdesign/catalog"
import { currentBox, currentValue, elementId, valueBytes } from "@airdesign/document"
import { expect, it } from "vitest"
import { nodeBody } from "./call-fixtures.js"
import { call, openDeck, type Deck } from "./index.js"

const node = elementId("258.7")
const first = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }
const person = { actor: "person" } as const

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
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
