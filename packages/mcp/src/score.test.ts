import { readDeckId } from "@airdesign/catalog"
import { decide, version } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { captureAbsentTask, landSourceTask, score, staleEditTask, type AgentCaller } from "./index.js"

function running(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck = openDeck(id.deck)
  const started = decide(deck.register, { command: "start", runId: "run" })
  if (started.decision !== "apply") throw new Error(started.code)
  return { id: deck.id, revision: deck.revision, register: started.register }
}

function callerFor(deck: Deck): AgentCaller {
  return { actor: "agent", runId: "run", readAt: version(deck.register) }
}

describe("score", () => {
  it("passes when the edit lands a source string", () => {
    const deck = running()
    const result = score(landSourceTask, deck, callerFor(deck))
    expect(result.pass).toBe(true)
    expect(result.deck.register.landed).toEqual([{ actor: "agent", value: "21", visible: true }])
    expect(deck.register.landed).toEqual([])
  })

  it("passes a stale edit that leaves the deck", () => {
    const deck = running()
    const register = deck.register
    const result = score(staleEditTask, deck, callerFor(deck))
    expect(result.pass).toBe(true)
    expect(result.deck).toBe(deck)
    expect(result.deck.register).toBe(register)
    expect(result.deck.revision).toBe(0)
    expect(result.deck.register.landed).toEqual([])
  })

  it("passes a capture that leaves the deck and reports no file", () => {
    const deck = running()
    const register = deck.register
    const result = score(captureAbsentTask, deck, callerFor(deck))
    expect(result.pass).toBe(true)
    expect(result.deck).toBe(deck)
    expect(result.deck.register).toBe(register)
    expect(captureAbsentTask.steps[0]?.tab).toEqual({ presence: "absent" })
  })

  it("fails when a landed value is outside the source", () => {
    const deck = running()
    const result = score(
      {
        source: ["21"],
        steps: [
          {
            name: "airdesign_edit_deck",
            raw: { deck: "deck", base: 0, changes: [{ value: "22" }] },
          },
        ],
      },
      deck,
      callerFor(deck),
    )
    expect(result.pass).toBe(false)
    expect(result.deck.register.landed).toEqual([{ actor: "agent", value: "22", visible: true }])
  })
})
