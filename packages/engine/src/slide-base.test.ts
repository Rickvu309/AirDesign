import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck, type Caller, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const node = elementId("256.2")
const other = elementId("257.2")
const spare = elementId("257.3")
const size = { width: 12_192_000, height: 6_858_000 }

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const result = indexDeck(openDeck(id.deck), person, {
    deck: "deck",
    once: "index",
    offset: 0,
    total: 3,
    slides: [
      { id: "256", position: 0, size, free: 3, animated: [], layout: [] },
      { id: "257", position: 1, size, free: 4, animated: [], layout: [] },
    ],
    elements: [
      { node, kind: "shape", value: "Title", box: null, grouped: false },
      { node: other, kind: "shape", value: "Body", box: null, grouped: false },
      { node: spare, kind: "shape", value: "Note", box: null, grouped: false },
    ],
  })
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function agentEdit(deck: Deck, caller: Caller & { readonly actor: "agent" }, edited = node): Deck {
  const opened = landed(
    call("start_run", { ...deck, revision: 0 }, caller, {
      deck: "deck",
      runId: caller.runId,
      elements: [{ node: edited }],
    }),
  )
  const under = { ...deck, register: opened.register }
  const changes = [{ node: edited, readAt: 0, value: "Agent" }]
  return landed(call("edit_deck", under, caller, { deck: "deck", base: deck.revision, changes }))
}

function personEdit(deck: Deck, edited = other): Deck {
  return landed(call("commit_edits", deck, person, { deck: "deck", batch: [{ node: edited, value: "Person" }] }))
}

const slideCalls = [
  ["add_slide", { after: "256", layout: "256" }],
  ["duplicate_slide", { slide: "256" }],
  ["delete_slide", { slide: "257" }],
  ["move_slide", { slide: "257", after: null }],
  ["add_text_box", { slide: "256", box: { x: 0, y: 0, cx: 100, cy: 100 } }],
  ["delete_element", { node: spare }],
] as const

for (const [op, input] of slideCalls) {
  it(`lands ${op} on a base that only the caller's own run moved since`, () => {
    const read = indexed()
    const edited = agentEdit(read, agent)
    const result = call(op, edited, agent, { deck: "deck", base: read.revision, ...input })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.deck.revision).toBe(read.revision + 2)
  })

  it(`refuses ${op} as stale on a base that another run moved since`, () => {
    const read = indexed()
    const edited = agentEdit(read, { actor: "agent", runId: "another" })
    expect(call(op, edited, agent, { deck: "deck", base: read.revision, ...input })).toEqual({
      ok: false,
      refusal: "stale",
    })
  })

  it(`refuses ${op} as stale on a base that a person moved since, even after the run's own edit`, () => {
    const read = indexed()
    const typed = personEdit(read)
    const edited = agentEdit(typed, agent)
    expect(call(op, edited, agent, { deck: "deck", base: read.revision, ...input })).toEqual({
      ok: false,
      refusal: "stale",
    })
    expect(call(op, edited, agent, { deck: "deck", base: typed.revision, ...input }).ok).toBe(true)
  })
}

it("lands two slide calls of one run sent at one base, in either order", () => {
  const read = indexed()
  const added = landed(
    call("add_slide", read, agent, { deck: "deck", base: read.revision, after: "256", layout: "256" }),
  )
  const moved = call("move_slide", added, agent, { deck: "deck", base: read.revision, slide: "257", after: null })
  expect(moved.ok).toBe(true)
})

it("refuses a slide call as stale on a base the deck has not reached", () => {
  const read = indexed()
  const edited = agentEdit(read, agent)
  expect(
    call("add_slide", edited, agent, { deck: "deck", base: edited.revision + 1, after: "256", layout: "256" }),
  ).toEqual({ ok: false, refusal: "stale" })
})

it("refuses a slide call as stale on a base older than the run's first write since a person's edit", () => {
  const read = indexed()
  const first = agentEdit(read, agent)
  const typed = personEdit(first, node)
  const again = agentEdit(typed, agent, other)
  expect(call("add_slide", again, agent, { deck: "deck", base: first.revision, after: "256", layout: "256" })).toEqual({
    ok: false,
    refusal: "stale",
  })
  expect(call("add_slide", again, agent, { deck: "deck", base: typed.revision, after: "256", layout: "256" }).ok).toBe(
    true,
  )
})
