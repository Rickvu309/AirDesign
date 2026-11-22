import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, orderKeyBetween, slideId, writeTextValue } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { expect, it } from "vitest"
import { callTool, emptyLog, memoryTurns, type Session } from "./index.js"

const floor = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Copied title" }] }])
const node = elementId("258.2")

function clonedDeck(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck = openDeck(id.deck)
  const cloned = decide(deck.register, {
    command: "slide",
    file: [slideId("256"), slideId("257")],
    edit: {
      slide: "clone",
      id: slideId("258"),
      source: slideId("256"),
      key: orderKeyBetween(null, null),
      floor: [{ node, kind: "shape", value: floor, box: null, grouped: false }],
    },
  })
  if (cloned.decision !== "apply") throw new Error(cloned.code)
  return { id: deck.id, revision: 1, register: cloned.register }
}

function edit(deck: Deck, value: string) {
  const turns = memoryTurns()
  const session: Session = { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns }
  return callTool(
    "airdesign_edit_deck",
    { deck: "deck", base: deck.revision, changes: [{ node, readAt: 0, value }] },
    session,
  )
}

it("lands an agent's text edit on a cloned slide against the copied text", () => {
  const deck = clonedDeck()
  const sent = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Agent title" }] }])
  const good = edit(deck, sent)
  expect(good).toMatchObject({ ok: true })
})
