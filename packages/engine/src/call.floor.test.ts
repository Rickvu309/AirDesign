import { readDeckId } from "@airdesign/catalog"
import { currentValue, elementId, format, limits } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck, type Deck } from "./index.js"

const person = { actor: "person" } as const
const agent = { actor: "agent", runId: "run" } as const
const node = elementId("258.7")
const floor = "x".repeat(limits.valueBytes + 1)
const box = { x: 10, y: 20, cx: 30, cy: 40 }

function opened(indexed = true): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck = openDeck(id.deck)
  if (!indexed) return deck
  const result = indexDeck(deck, person, {
    deck: id.deck,
    once: "import",
    offset: 0,
    total: 1,
    slides: [{ id: "258", position: 0 }],
    elements: [{ node, kind: "shape", value: floor, box, grouped: false }],
  })
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it.each([
  { name: "move", edit: { property: "box", value: { ...box, x: 100 } } },
  { name: "resize", edit: { property: "box", value: { ...box, cx: 100 } } },
  { name: "replace the text of", edit: { value: "Replacement" } },
  { name: "recolor", edit: { v: format, patch: { fills: { p0: { set: { solid: { scheme: "accent1" } } } } } } },
])("lets a person $name a box whose imported text is over the value limit", ({ edit }) => {
  const result = call("commit_edits", opened(), person, { deck: "deck", batch: [{ node, floor, ...edit }] })
  if (!result.ok) throw new Error(result.refusal)
  const body = result.deck.register.elements[node]
  expect(body?.floor).toBe(floor)
  if ("value" in edit && typeof edit.value === "string" && body !== undefined) {
    expect(currentValue(body)).toBe(edit.value)
  }
})

it("keeps the value limit on typing that leaves the text over it", () => {
  expect(call("commit_edits", opened(), person, { deck: "deck", batch: [{ node, floor, value: floor }] })).toEqual({
    ok: false,
    refusal: "limit",
  })
})

it("refuses a large floor the import did not record", () => {
  expect(
    call("commit_edits", opened(false), person, { deck: "deck", batch: [{ node, floor, value: "Short" }] }),
  ).toEqual({ ok: false, refusal: "limit" })
  expect(
    call("commit_edits", opened(), person, { deck: "deck", batch: [{ node, floor: `${floor}z`, value: "Short" }] }),
  ).toEqual({ ok: false, refusal: "limit" })
  expect(call("start_run", opened(false), agent, { deck: "deck", runId: "run", elements: [{ node, floor }] })).toEqual({
    ok: false,
    refusal: "limit",
  })
})
