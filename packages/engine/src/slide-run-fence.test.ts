import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck, runFenced, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const node = elementId("256.2")

function running(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [
        { id: "256", position: 0, layout: [] },
        { id: "257", position: 1, layout: [] },
      ],
      elements: [{ node, kind: "shape", value: "Title", box: null, grouped: false }],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  const started = call("start_run", indexed.deck, agent, { deck: "deck", runId: "run", elements: [{ node }] })
  if (!started.ok) throw new Error(started.refusal)
  return started.deck
}

const slideCalls = [
  ["add_slide", { after: "256", layout: "256" }],
  ["duplicate_slide", { slide: "256" }],
  ["delete_slide", { slide: "256" }],
  ["move_slide", { slide: "257", after: null }],
] as const

for (const [op, input] of slideCalls) {
  it(`refuses ${op} from a run the agent stopped`, () => {
    const stopped = call("stop_run", running(), agent, { deck: "deck", runId: "run" })
    if (!stopped.ok) throw new Error(stopped.refusal)
    expect(call(op, stopped.deck, agent, { deck: "deck", base: stopped.deck.revision, ...input })).toEqual({
      ok: false,
      refusal: "run-fenced",
    })
  })
}

it("refuses deleting a slide that holds an element a person protected from the run", () => {
  const typed = call("commit_edits", running(), { actor: "person" }, { deck: "deck", batch: [{ node, value: "Mine" }] })
  if (!typed.ok) throw new Error(typed.refusal)
  expect(call("delete_slide", typed.deck, agent, { deck: "deck", base: typed.deck.revision, slide: "256" })).toEqual({
    ok: false,
    refusal: "person-protected",
  })
})

function slidesOnly(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, layout: [] }],
      elements: [{ node, kind: "shape", value: "Title", box: null, grouped: false }],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  const added = call("add_slide", indexed.deck, agent, {
    deck: "deck",
    base: indexed.deck.revision,
    ...slideCalls[0][1],
  })
  if (!added.ok) throw new Error(added.refusal)
  return added.deck
}

for (const end of ["stop_run", "undo_run"] as const) {
  it(`refuses a slide command from a run that only added slides after ${end}`, () => {
    const caller = end === "stop_run" ? agent : ({ actor: "person" } as const)
    const ended = call(end, slidesOnly(), caller, { deck: "deck", runId: "run" })
    if (!ended.ok) throw new Error(ended.refusal)
    expect(runFenced(ended.deck.register, "run")).toBe(true)
    expect(
      call("add_slide", ended.deck, agent, { deck: "deck", base: ended.deck.revision, ...slideCalls[0][1] }),
    ).toEqual({ ok: false, refusal: "run-fenced" })
  })
}

it("moves the revision when it stops a run that only added slides, and changes nothing when stopped again", () => {
  const deck = slidesOnly()
  expect(runFenced(deck.register, "run")).toBe(false)
  const stopped = call("stop_run", deck, agent, { deck: "deck", runId: "run" })
  if (!stopped.ok) throw new Error(stopped.refusal)
  expect(stopped.deck.revision).toBe(deck.revision + 1)
  const again = call("stop_run", stopped.deck, agent, { deck: "deck", runId: "run" })
  expect(again.ok && again.deck).toBe(stopped.deck)
})

it("keeps the record of a stopped run through a person's edit and another run's slide", () => {
  const stopped = call("stop_run", slidesOnly(), agent, { deck: "deck", runId: "run" })
  if (!stopped.ok) throw new Error(stopped.refusal)
  const typed = call(
    "commit_edits",
    stopped.deck,
    { actor: "person" },
    { deck: "deck", batch: [{ node, value: "Mine" }] },
  )
  if (!typed.ok) throw new Error(typed.refusal)
  const next = { actor: "agent", runId: "next" } as const
  const added = call("add_slide", typed.deck, next, { deck: "deck", base: typed.deck.revision, ...slideCalls[0][1] })
  if (!added.ok) throw new Error(added.refusal)
  expect(runFenced(added.deck.register, "run")).toBe(true)
  expect(runFenced(added.deck.register, "next")).toBe(false)
})
