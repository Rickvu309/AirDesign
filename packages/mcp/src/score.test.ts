import { readDeckId } from "@airdesign/catalog"
import { decide, elementId, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { captureAbsentTask, landSourceTask, score, staleEditTask, type AgentCaller } from "./index.js"

const node = elementId("258.7")

function nodeBody(register: Register) {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return body
}

function running(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const deck = openDeck(id.deck)
  const added = decide(deck.register, {
    command: "add",
    node,
    floor: deck.register.floor,
    route: deck.register.route,
  })
  if (added.decision !== "apply") throw new Error(added.code)
  const started = decide(added.register, { command: "start", runId: "run", node })
  if (started.decision !== "apply") throw new Error(started.code)
  return { id: deck.id, revision: deck.revision, register: started.register }
}

function callerFor(): AgentCaller {
  return { actor: "agent", runId: "run" }
}

describe("score", () => {
  it("passes when the edit lands a source string", () => {
    const deck = running()
    const result = score(landSourceTask, deck, callerFor())
    expect(result.pass).toBe(true)
    expect(nodeBody(result.deck.register).landed).toEqual([{ actor: "agent", value: "21", visible: true }])
    expect(nodeBody(deck.register).landed).toEqual([])
  })

  it("passes an edit whose base is behind the revision", () => {
    const deck = running()
    const result = score(staleEditTask, deck, callerFor())
    expect(result.pass).toBe(true)
    expect(result.deck).not.toBe(deck)
    expect(result.deck.revision).toBe(1)
    expect(nodeBody(result.deck.register).landed).toEqual([{ actor: "agent", value: "21", visible: true }])
    expect(deck.revision).toBe(0)
  })

  it("passes a capture that leaves the deck and reports no file", () => {
    const deck = running()
    const register = deck.register
    const result = score(captureAbsentTask, deck, callerFor())
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
            raw: { deck: "deck", base: 0, changes: [{ value: "22", node: "258.7", readAt: 0 }] },
          },
        ],
      },
      deck,
      callerFor(),
    )
    expect(result.pass).toBe(false)
    expect(nodeBody(result.deck.register).landed).toEqual([{ actor: "agent", value: "22", visible: true }])
  })
})
