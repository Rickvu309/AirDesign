import { expect, it } from "vitest"
import { readDeckId } from "@airdesign/catalog"
import { elementId, orderKeyBetween } from "@airdesign/document"
import { call, indexDeck, openDeck, readDeckPage, type Deck } from "./index.js"

const person = { actor: "person" } as const
const file = ["256", "257"]
const slides = file.map((id, position) => ({ id, position }))
const parsed = readDeckId("deck")
if (!parsed.ok) throw new Error("deck")
const initial = openDeck(parsed.deck)
const page = {
  deck: initial.id,
  once: "opening",
  offset: 0,
  total: 2,
  slides,
  elements: file.map((id) => ({ node: elementId(`${id}.2`), kind: "shape", value: id, box: null, grouped: false })),
}

function indexed(): Deck {
  const result = indexDeck(initial, person, page)
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function edit(deck: Deck, batch: readonly unknown[]): Deck {
  const result = call("commit_edits", deck, person, { deck: deck.id, batch })
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

it("reads current slide order after add, clone, remove and move, without removed elements", () => {
  let deck = indexed()
  const key = orderKeyBetween(null, null)
  deck = edit(deck, [{ slide: "add", id: "258", after: "256", layout: "256", key, file }])
  deck = edit(deck, [{ slide: "clone", id: "259", source: "256", key: orderKeyBetween(null, key), file }])
  deck = edit(deck, [{ slide: "remove", id: "257", file }])
  deck = edit(deck, [{ slide: "move", id: "256", key: orderKeyBetween(key, null), file }])
  expect(readDeckPage(deck, { runId: null })).toMatchObject({
    slides: [
      { id: "259", position: 0 },
      { id: "258", position: 1 },
      { id: "256", position: 2 },
    ],
    elements: [{ node: "256.2" }],
  })
  expect(readDeckPage(deck, { runId: null }).elements.map((element) => element.node)).toEqual(["256.2"])
  expect(readDeckPage(deck, { runId: null, slide: "257" }).elements).toEqual([])
  expect(
    call(
      "start_run",
      deck,
      { actor: "agent", runId: "run" },
      {
        deck: deck.id,
        runId: "run",
        elements: [{ node: "257.2" }],
      },
    ),
  ).toEqual({ ok: false, refusal: "dead" })
})

it("refuses slide commands whose opening order disagrees with the import index", () => {
  expect(
    call("commit_edits", indexed(), person, {
      deck: initial.id,
      batch: [{ slide: "remove", id: "257", file: ["257", "256"] }],
    }),
  ).toEqual({ ok: false, refusal: "stale" })
})

it("refuses backfill whose opening order disagrees with earlier slide commands", () => {
  const deck = edit(initial, [{ slide: "remove", id: "257", file }])
  expect(
    indexDeck(deck, person, { ...page, slides: [...file].reverse().map((id, position) => ({ id, position })) }),
  ).toEqual({ ok: false, refusal: "stale" })
})
