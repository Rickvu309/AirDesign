import { readDeckId } from "@airdesign/catalog"
import { elementGone, elementId, openingElement, type DeckIndex, type IndexElement } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`258.${shape}`)

const elements: readonly IndexElement[] = [
  { node: node(2), kind: "shape", value: "", box: { x: 100, y: 100, cx: 200, cy: 100 }, grouped: false },
  { node: node(3), kind: "shape", value: "", box: { x: 400, y: 300, cx: 100, cy: 100 }, grouped: false },
  {
    node: node(4),
    kind: "group",
    value: null,
    box: { x: 1000, y: 1000, cx: 400, cy: 200 },
    grouped: false,
    frame: { x: 0, y: 0, cx: 200, cy: 100 },
  },
  { node: node(5), kind: "shape", value: "", box: { x: 0, y: 0, cx: 100, cy: 100 }, grouped: true, group: node(4) },
  {
    node: node(6),
    kind: "shape",
    value: null,
    box: { x: 100, y: 0, cx: 100, cy: 100 },
    grouped: true,
    group: node(4),
  },
  {
    node: node(7),
    kind: "shape",
    value: "Title",
    box: { x: 0, y: 0, cx: 900, cy: 100 },
    grouped: false,
    role: "title",
  },
]

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [
      { id: "258", position: 0, size, free: 9 },
      { id: "259", position: 1, size, free: 3 },
    ],
    elements,
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index } }
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function edit(deck: Deck, ...changes: readonly object[]) {
  return call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes })
}

describe("an agent duplicates layers through edit_deck", () => {
  it("copies each layer just above it under the run, and undo_run takes the copies away", () => {
    const deck = landed(edit(indexed(), { op: "duplicate", elements: ["258.2", "258.7"] }))
    expect(deck.register.order.map((command) => command.slide)).toEqual(["element-clone", "element-clone"])
    expect(deck.register.order).toMatchObject([
      { runId: "run", source: "258.2", element: { node: "258.9", box: elements[0]?.box } },
      { runId: "run", source: "258.7", element: { node: "258.10", value: "Title", role: "title" } },
    ])
    expect(openingElement(deck.register, node(10))?.box).toEqual(elements[5]?.box)
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(elementGone(undone.register, node(9))).toBe(true)
    expect(elementGone(undone.register, node(10))).toBe(true)
    expect(elementGone(undone.register, node(2))).toBe(false)
  })

  it("copies a group with its layers, and a layer inside a group into that group just above it", () => {
    const deck = landed(edit(indexed(), { op: "duplicate", elements: ["258.4", "258.5"] }))
    expect(deck.register.order).toMatchObject([
      {
        runId: "run",
        source: "258.4",
        element: { node: "258.9", kind: "group", box: elements[2]?.box },
        layers: [
          { source: "258.5", element: { node: "258.10", group: "258.9" } },
          { source: "258.6", element: { node: "258.11", group: "258.9" } },
        ],
      },
      { runId: "run", source: "258.5", element: { node: "258.12", group: "258.4", box: elements[3]?.box } },
    ])
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    for (const copy of [9, 10, 11, 12]) expect(elementGone(undone.register, node(copy))).toBe(true)
  })

  it("pastes layers onto another slide at the place it names, keeping their offsets to each other", () => {
    const deck = landed(
      edit(indexed(), { op: "duplicate", elements: ["258.2", "258.3"], slide: "259", x: 1000, y: 2000 }),
    )
    expect(deck.register.order).toMatchObject([
      { runId: "run", id: "259", source: "258.2", element: { node: "259.3", box: { x: 1000, y: 2000 } } },
      { runId: "run", id: "259", source: "258.3", element: { node: "259.4", box: { x: 1300, y: 2200 } } },
    ])
  })

  it("pastes a layer onto another slide at its own place when no place is named", () => {
    const deck = landed(edit(indexed(), { op: "duplicate", elements: ["258.5"], slide: "259" }))
    expect(deck.register.order).toMatchObject([
      { id: "259", source: "258.5", element: { node: "259.3", grouped: false } },
    ])
    expect(openingElement(deck.register, elementId("259.3"))?.group).toBeUndefined()
  })

  it("refuses a slide or a place on a change that is not a duplicate, and a place without both sides", () => {
    const refusal = (change: object) => {
      const result = edit(indexed(), change)
      return result.ok ? "landed" : result.refusal
    }
    expect(refusal({ op: "group", elements: ["258.2", "258.3"], slide: "259" })).toBe("field")
    expect(refusal({ op: "duplicate", elements: ["258.2"], x: 10 })).toBe("field")
    expect(refusal({ op: "duplicate", elements: ["258.2"], slide: "999" })).not.toBe("landed")
  })

  it("refuses a layer it cannot find, and changes nothing", () => {
    const result = edit(indexed(), { op: "duplicate", elements: ["258.2", "258.40"] })
    expect(result.ok ? "landed" : result.refusal).toBe("dead")
  })
})
