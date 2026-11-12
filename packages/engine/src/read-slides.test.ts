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

it("reads and edits the opening elements of added and cloned slides, and keeps a clone's copy when its source moves on", () => {
  const key = orderKeyBetween(null, null)
  const box = { x: 1, y: 2, cx: 3, cy: 4 }
  const title = { node: "259.2", kind: "shape", value: "256", box, grouped: false }
  let deck = edit(indexed(), [
    {
      slide: "add",
      id: "258",
      after: "256",
      layout: "256",
      key,
      file,
      floor: [{ ...title, node: "258.3", value: "" }],
    },
    {
      slide: "clone",
      id: "259",
      source: "256",
      key: orderKeyBetween(null, key),
      file,
      floor: [title, { ...title, node: "259.3", box: null }],
    },
  ])
  const agent = { actor: "agent", runId: "run" } as const
  const started = call("start_run", deck, agent, {
    deck: deck.id,
    runId: "run",
    elements: [{ node: "256.2" }, { node: "258.3" }, { node: "259.2" }],
  })
  if (!started.ok) throw new Error(started.refusal)
  const changed = call("edit_deck", started.deck, agent, {
    deck: deck.id,
    base: started.deck.revision,
    changes: [
      { node: "256.2", readAt: 0, value: "source moved on" },
      { node: "258.3", readAt: 0, value: "typed" },
    ],
  })
  if (!changed.ok) throw new Error(changed.refusal)
  deck = changed.deck
  expect(readDeckPage(deck, { runId: "run" }).elements).toEqual([
    { node: "256.2", slide: "256", value: "source moved on", kind: "shape", grouped: false, version: 1, box: null },
    { node: "257.2", slide: "257", value: "257", kind: "shape", grouped: false, version: 0, box: null },
    { node: "258.3", slide: "258", value: "typed", kind: "shape", grouped: false, version: 1, box },
    { node: "259.2", slide: "259", value: "256", kind: "shape", grouped: false, version: 0, box },
    { node: "259.3", slide: "259", value: "256", kind: "shape", grouped: false, version: 0, box: null },
  ])
  deck = edit(deck, [{ slide: "remove", id: "259", file }])
  const next = { actor: "agent", runId: "next" } as const
  expect(readDeckPage(deck, { runId: null, slide: "259" }).elements).toEqual([])
  expect(call("start_run", deck, next, { deck: deck.id, runId: "next", elements: [{ node: "259.3" }] })).toEqual({
    ok: false,
    refusal: "dead",
  })
  expect(call("start_run", deck, next, { deck: deck.id, runId: "next", elements: [{ node: "258.9" }] })).toEqual({
    ok: false,
    refusal: "dead",
  })
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
