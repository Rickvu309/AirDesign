import { readDeckId } from "@airdesign/catalog"
import { elementId, writeTextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck } from "./index.js"

const actor = { actor: "agent", runId: "run" } as const
const inputs = [
  ["add_slide", { after: "256", layout: "256" }],
  ["duplicate_slide", { slide: "256" }],
  ["delete_slide", { slide: "256" }],
  ["move_slide", { slide: "256", after: null }],
] as const

function deckId() {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  return id.deck
}

function title(node: string) {
  return {
    node: elementId(node),
    kind: "shape",
    value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
    box: null,
    grouped: false,
  } as const
}

function page(offset: number, total: number, elements: ReturnType<typeof title>[]) {
  return {
    deck: "deck",
    once: `page${String(offset)}`,
    offset,
    total,
    slides: [
      { id: "256", position: 0, layout: [title("256.2")] },
      { id: "257", position: 1, layout: [title("257.2")] },
    ],
    elements,
  }
}

function withPages(...pages: ReturnType<typeof page>[]) {
  let deck = openDeck(deckId())
  for (const next of pages) {
    const indexed = indexDeck(deck, { actor: "person" }, next)
    if (!indexed.ok) throw new Error(indexed.refusal)
    deck = indexed.deck
  }
  return deck
}

for (const [op, input] of inputs) {
  it(`refuses ${op} as indexing while the deck has no index`, () => {
    expect(call(op, openDeck(deckId()), actor, { deck: "deck", base: 0, ...input })).toEqual({
      ok: false,
      refusal: "indexing",
    })
  })

  it(`refuses ${op} as indexing while the last index page has not arrived`, () => {
    const deck = withPages(page(0, 2, [title("256.2")]))
    expect(call(op, deck, actor, { deck: "deck", base: 0, ...input })).toEqual({ ok: false, refusal: "indexing" })
  })

  it(`runs ${op} once the last index page has arrived`, () => {
    const deck = withPages(page(0, 2, [title("256.2")]), page(1, 2, [title("257.2")]))
    expect(call(op, deck, actor, { deck: "deck", base: 0, ...input }).ok).toBe(true)
  })
}
