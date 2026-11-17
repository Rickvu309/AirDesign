import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { expect, it } from "vitest"
import { call, indexDeck, openDeck, readDeckPage } from "./index.js"

it("leaves an element the person removed out of an agent's duplicate of its slide", () => {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const box = {
    node: elementId("256.2"),
    kind: "shape",
    value: "",
    box: { x: 0, y: 0, cx: 10, cy: 10 },
    grouped: false,
  } as const
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, layout: [] }],
      elements: [box],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  const removed = call(
    "commit_edits",
    indexed.deck,
    { actor: "person" },
    { deck: "deck", batch: [{ slide: "element-remove", id: "256", node: "256.2", file: ["256"] }] },
  )
  if (!removed.ok) throw new Error(removed.refusal)
  const copied = call(
    "edit_deck",
    removed.deck,
    { actor: "agent", runId: "run" },
    { deck: "deck", base: removed.deck.revision, changes: [{ op: "duplicate_slide", slide: "256" }] },
  )
  if (!copied.ok) throw new Error(copied.refusal)
  expect(readDeckPage(copied.deck, { runId: null }).elements.map((element) => element.node)).toEqual([])
})
