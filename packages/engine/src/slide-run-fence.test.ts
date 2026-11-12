import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck, type Deck } from "./index.js"

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
