import { readDeckId } from "@airdesign/catalog"
import { elementId, landedPatch, type DeckIndex } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 72, y: 72, w: 240, h: 120 }

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: 0,
    slides: [{ id: "258", position: 0, size, free: 2 }],
    elements: [],
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index } }
}

function added(...changes: readonly object[]): Deck {
  const deck = indexed()
  const result = call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes })
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function traitsOf(deck: Deck) {
  const body = deck.register.elements[elementId("258.2")]
  if (body === undefined) throw new Error("body")
  return Object.keys(landedPatch(body, "text")).sort()
}

function designOf(deck: Deck) {
  return readDeckPage(deck, { runId: "run", slide: "258" }).elements.find((each) => each.node === "258.2")?.design
}

describe("an agent adds a styled layer in one change", () => {
  it("adds a filled rounded card with a border and centered text, and reads it back that way", () => {
    const deck = added({
      op: "add",
      kind: "shape",
      slide: "258",
      box,
      text: { value: "Revenue" },
      fills: { paint: "accent1" },
      geometry: { shape: { preset: "roundRect", adjust: {} } },
      border: { width: 1 },
      body: { anchor: "ctr" },
    })
    expect(traitsOf(deck)).toEqual(["body", "border", "fills", "geometry", "text"])
    const design = designOf(deck)
    expect(design).toContain("accent1")
    expect(design).toContain("roundRect")
    expect(design).toContain("ctr")
  })

  it("adds a filled rectangle with no text", () => {
    const deck = added({ op: "add", kind: "shape", slide: "258", box, fills: { paint: "accent2" } })
    expect(traitsOf(deck)).toEqual(["fills"])
    expect(designOf(deck)).toContain("accent2")
  })

  it("adds an arrow with a set width and arrowhead", () => {
    const deck = added({
      op: "add",
      kind: "arrow",
      slide: "258",
      box,
      border: { width: 3, tail: { type: "stealth", width: "lg", length: "lg" } },
    })
    expect(traitsOf(deck)).toEqual(["border"])
    expect(designOf(deck)).toContain("stealth")
  })
})
