import { readDeckId } from "@airdesign/catalog"
import { openDeck } from "@airdesign/engine"
import { expect, it } from "vitest"

import { callTool, type Session } from "./call-tool.js"
import { emptyLog } from "./admit.js"
import { agentCaller } from "./run.js"
import { memoryTurns } from "./turn.js"

function sessionOn(id: string): Session {
  const deck = readDeckId(id)
  if (!deck.ok) throw new Error(deck.refusal)
  return { caller: agentCaller("run"), deck: openDeck(deck.deck), log: emptyLog(), now: 0, turns: memoryTurns() }
}

it("answers a created deck with its id, its name and its first read", () => {
  const session = sessionOn("made")
  session.created = { deck: session.deck.id, name: "Board review" }
  const result = callTool("airdesign_create_deck", { name: "Board review" }, session)
  expect(result).toMatchObject({
    ok: true,
    reported: { ok: true, deck: "made", name: "Board review", revision: 0, slides: [], elements: [] },
    content: [{ type: "text", text: "Created deck made." }, { type: "text" }],
  })
  expect(Object.keys(result.ok ? (result.reported ?? {}) : {}).slice(0, 4)).toEqual(["ok", "deck", "name", "revision"])
})

it("refuses when no deck was made for this call, and when the call names a field it does not take", () => {
  const session = sessionOn("pending")
  expect(callTool("airdesign_create_deck", {}, session)).toMatchObject({ ok: false, refusal: "store" })
  session.created = { deck: session.deck.id, name: "Blank deck" }
  for (const raw of [{ name: " " }, { name: 1 }, { deck: "pending" }, null])
    expect(callTool("airdesign_create_deck", raw, session)).toMatchObject({ ok: false, refusal: "field" })
})
