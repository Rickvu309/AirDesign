import { readDeckId } from "@airdesign/catalog"
import { currentValue, elementGone, elementId, writeTextValue, type Box } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, indexDeck, openDeck, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const box: Box = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }
const words = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Words" }] }])
const emptied = writeTextValue([{ from: 0, runs: [{ from: 0, text: "" }] }])
const title = elementId("256.2")
const text = elementId("256.3")
const filled = elementId("256.4")

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const result = indexDeck(openDeck(id.deck), person, {
    deck: "deck",
    once: "index",
    offset: 0,
    total: 3,
    slides: [{ id: "256", position: 0, size, free: 6, animated: [], layout: [] }],
    elements: [
      { node: title, kind: "shape", value: words, box, grouped: false, role: "title" },
      { node: text, kind: "shape", value: words, box, grouped: false },
      { node: filled, kind: "shape", value: words, box, grouped: false, design: { fills: ["accent1", "style"] } },
    ],
  })
  if (!result.ok) throw new Error(result.refusal)
  const elements = [title, text, filled].map((node) => ({ node }))
  return landed(call("start_run", result.deck, agent, { deck: "deck", runId: "run", elements }))
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function written(deck: Deck, node: typeof text, value: string): Deck {
  return landed(
    call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes: [{ node, readAt: 0, value }] }),
  )
}

describe("an agent that empties a text layer", () => {
  it("removes the layer in the same run, and undo_run brings it back with its words", () => {
    const removed = written(opened(), text, emptied)
    expect(elementGone(removed.register, text)).toBe(true)
    const undone = landed(call("undo_run", removed, agent, { deck: "deck", runId: "run" }))
    expect(elementGone(undone.register, text)).toBe(false)
    const body = undone.register.elements[text]
    expect(body === undefined ? words : currentValue(body)).toBe(words)
  })

  it("removes the layer when a set change empties its words", () => {
    const deck = opened()
    const set = { op: "set", target: text, text: { value: "" } }
    const removed = landed(call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes: [set] }))
    expect(elementGone(removed.register, text)).toBe(true)
  })

  it("keeps an emptied placeholder and an emptied shape with a fill", () => {
    const kept = written(written(opened(), title, emptied), filled, emptied)
    expect(elementGone(kept.register, title)).toBe(false)
    expect(elementGone(kept.register, filled)).toBe(false)
  })

  it("keeps a text box it adds with no words", () => {
    const deck = opened()
    const add = { op: "add", kind: "shape", slide: "256" }
    const added = call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes: [add] })
    if (!added.ok) throw new Error(added.refusal)
    const last = added.deck.register.order.at(-1)
    expect(last?.slide).toBe("element-add")
    if (last?.slide === "element-add") expect(elementGone(added.deck.register, last.element.node)).toBe(false)
  })
})
