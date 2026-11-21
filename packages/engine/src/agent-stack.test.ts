import { readDeckId } from "@airdesign/catalog"
import { elementId, elementStacks, type DeckIndex, type IndexElement } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`258.${shape}`)
const square = { cx: 1_000_000, cy: 1_000_000 }

function shape(at: number, extra: Partial<IndexElement> = {}): IndexElement {
  return {
    node: node(at),
    kind: "shape",
    value: "",
    box: { x: at * 100_000, y: 0, ...square },
    grouped: false,
    ...extra,
  }
}

const elements: readonly IndexElement[] = [
  shape(2),
  shape(3),
  shape(4),
  { ...shape(5), kind: "group" },
  shape(6, { grouped: true, group: node(5) }),
]

function indexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [{ id: "258", position: 0, size, free: 9 }],
    elements,
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index } }
}

function edit(deck: Deck, ...changes: readonly object[]) {
  return call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes })
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function layers(deck: Deck): readonly string[] {
  return elementStacks(deck.register).find((stack) => stack.slide === "258")?.ids ?? []
}

describe("an agent sets a layer's paint order", () => {
  it("brings a layer to the front and sends one to the back, as Figma's Bring to front and Send to back", () => {
    const front = landed(edit(indexed(), { op: "set", target: "258.2", stack: "front" }))
    expect(layers(front)).toEqual(["258.3", "258.4", "258.5", "258.2"])
    const back = landed(edit(front, { op: "set", target: "258.4", stack: "back" }))
    expect(layers(back)).toEqual(["258.4", "258.3", "258.5", "258.2"])
  })

  it("moves a layer just above or just below another", () => {
    const above = landed(edit(indexed(), { op: "set", target: "258.2", stack: "above 258.4" }))
    expect(layers(above)).toEqual(["258.3", "258.4", "258.2", "258.5"])
    const below = landed(edit(above, { op: "set", target: "258.5", stack: "below 258.3" }))
    expect(layers(below)).toEqual(["258.5", "258.3", "258.4", "258.2"])
  })

  it("sends a layer it added in the same call behind the ones already there", () => {
    const deck = landed(
      edit(
        indexed(),
        { op: "add", kind: "shape", slide: "258", box: { x: 10, y: 10, w: 100, h: 50 } },
        { op: "set", target: "258.9", stack: "back" },
      ),
    )
    expect(layers(deck)).toEqual(["258.9", "258.2", "258.3", "258.4", "258.5"])
  })

  it("sets a fill and the order in one change", () => {
    const started = landed(
      call("start_run", indexed(), agent, { deck: "deck", runId: "run", elements: [{ node: "258.3" }] }),
    )
    const deck = landed(edit(started, { op: "set", target: "258.3", stack: "front", fills: { paint: "accent1" } }))
    expect(layers(deck)).toEqual(["258.2", "258.4", "258.5", "258.3"])
    expect(deck.register.elements[node(3)]?.landed.length).toBeGreaterThan(0)
  })

  it("follows a person's reorder before its own", () => {
    const deck = indexed()
    const moved = landed(
      call("commit_edits", deck, person, {
        deck: "deck",
        batch: [
          {
            slide: "element-order",
            id: "258",
            node: "258.4",
            before: "258.2",
            among: ["258.2", "258.3", "258.4", "258.5"],
            file: ["258"],
          },
        ],
      }),
    )
    const front = landed(edit(moved, { op: "set", target: "258.4", stack: "front" }))
    expect(layers(front)).toEqual(["258.2", "258.3", "258.5", "258.4"])
  })

  it("leaves the order alone when the layer is already there", () => {
    const deck = indexed()
    const same = landed(edit(deck, { op: "set", target: "258.5", stack: "front" }))
    expect(same.register.order.filter((command) => command.slide === "element-order")).toEqual([])
  })

  it("refuses a layer inside a group as group-box", () => {
    const refused = edit(indexed(), { op: "set", target: "258.6", stack: "front" })
    expect(refused).toMatchObject({ ok: false, refusal: "group-box" })
  })

  it("is undone with the run", () => {
    const front = landed(edit(indexed(), { op: "set", target: "258.2", stack: "front" }))
    const undone = landed(call("undo_run", front, person, { deck: "deck", runId: "run" }))
    expect(layers(undone)).toEqual(["258.2", "258.3", "258.4", "258.5"])
  })
})
