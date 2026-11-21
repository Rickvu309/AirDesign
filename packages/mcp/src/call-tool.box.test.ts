import { readDeckId } from "@airdesign/catalog"
import { openDeck, type Deck } from "@airdesign/engine"
import { expect, it } from "vitest"
import { callTool, emptyLog, memoryTurns, type Session } from "./index.js"

const box = { x: 914400, y: 457200, cx: 1828800, cy: 914400 }

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck: Deck = openDeck(id.deck)
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() }
}

it("refuses the box change in EMU, which op set box in points replaced, before a run opens", () => {
  const held = session()
  const result = callTool(
    "airdesign_edit_deck",
    { deck: "deck", base: 0, changes: [{ node: "258.7", readAt: 0, property: "box", value: box }] },
    held,
  )
  expect(result).toMatchObject({ ok: false, refusal: "field" })
  expect(result.deck).toBe(held.deck)
})
