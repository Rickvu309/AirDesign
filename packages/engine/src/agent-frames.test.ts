import { readDeckId } from "@airdesign/catalog"
import { elementId, groupFormed, type DeckIndex, type IndexElement } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck, type ReadElement } from "./index.js"

const crimson = "C00000"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`258.${shape}`)

const elements: readonly IndexElement[] = [
  {
    node: node(2),
    kind: "shape",
    value: "",
    box: { x: 100_000, y: 100_000, cx: 200_000, cy: 100_000 },
    grouped: false,
  },
  {
    node: node(3),
    kind: "shape",
    value: "",
    box: { x: 400_000, y: 300_000, cx: 100_000, cy: 150_000 },
    grouped: false,
  },
  {
    node: node(4),
    kind: "shape",
    value: "",
    box: { x: 900_000, y: 900_000, cx: 100_000, cy: 100_000 },
    grouped: false,
  },
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

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function edit(deck: Deck, ...changes: readonly object[]) {
  return call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes })
}

function set(deck: Deck, target: string, change: object) {
  const started = landed(call("start_run", deck, agent, { deck: "deck", runId: "run", elements: [{ node: target }] }))
  return edit(started, { op: "set", target, ...change })
}

function listed(deck: Deck): ReadonlyMap<string, ReadElement> {
  return new Map(readDeckPage(deck, { runId: "run" }).elements.map((each) => [each.node, each]))
}

function framed(): Deck {
  return landed(edit(indexed(), { op: "frame", elements: ["258.2", "258.3"] }))
}

describe("an agent makes and fills an auto layout frame through edit_deck", () => {
  it("wraps two shapes in a row, lists the frame with its children where they show, hides the backdrop, and undo_run unwraps", () => {
    const deck = framed()
    const read = listed(deck)
    expect(read.get("258.9")).toMatchObject({ kind: "group", frame: "auto" })
    expect(read.has("258.10")).toBe(false)
    const [first, second] = [read.get("258.2")?.box, read.get("258.3")?.box]
    if (first == null || second == null) throw new Error("children")
    expect(second.x).toBeGreaterThan(first.x + first.cx)
    expect(read.get("258.2")).toMatchObject({ grouped: true })
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(groupFormed(undone.register, node(9))).toBe(false)
    expect(listed(undone).get("258.3")?.box).toEqual(elements[1]?.box)
  })

  it("turns the row into a column with set layout, and lays the children one under the other", () => {
    const deck = landed(set(framed(), "258.9", { layout: { flow: "vertical", gap: 10 } }))
    const read = listed(deck)
    const [first, second] = [read.get("258.2")?.box, read.get("258.3")?.box]
    if (first == null || second == null) throw new Error("children")
    expect(second.y).toBe(first.y + first.cy + 127_000)
    expect(second.x).toBe(first.x)
  })

  it("paints the frame's fill on its backdrop and refuses moving a child of an auto layout frame", () => {
    const deck = landed(set(framed(), "258.9", { fills: { paint: `#${crimson}` } }))
    expect(deck.register.elements[node(10)]?.landed.at(-1)).toMatchObject({ actor: "agent", runId: "run" })
    expect(deck.register.elements[node(9)]?.landed).toEqual([])
    expect(listed(deck).get("258.9")?.design).toContain(`fills #${crimson}`)
    expect(set(deck, "258.2", { box: { x: 0 } })).toEqual({ ok: false, refusal: "group-box" })
  })

  it("fades the whole frame with opacity and reads it on the frame, leaving its backdrop's fill as it was", () => {
    const deck = landed(set(framed(), "258.9", { opacity: 50 }))
    expect(deck.register.elements[node(9)]?.landed.at(-1)).toMatchObject({ actor: "agent", runId: "run" })
    expect(deck.register.elements[node(10)]?.landed ?? []).toEqual([])
    expect(listed(deck).get("258.9")?.design).toContain("opacity 50")
  })

  it("takes a child out where it shows with leave, and adds a shape to the end with join", () => {
    const before = listed(framed()).get("258.3")?.box
    const left = landed(edit(framed(), { op: "leave", elements: ["258.3"] }))
    expect(listed(left).get("258.3")).toMatchObject({ grouped: false, box: before })
    const joined = landed(edit(framed(), { op: "join", elements: ["258.9", "258.4"] }))
    const read = listed(joined)
    const [second, third] = [read.get("258.3")?.box, read.get("258.4")?.box]
    if (second == null || third == null) throw new Error("children")
    expect(read.get("258.4")).toMatchObject({ grouped: true })
    expect(third.x).toBeGreaterThan(second.x + second.cx)
  })

  it("moves a child of a frame without auto layout to the slide point the agent names", () => {
    const free = landed(set(framed(), "258.9", { layout: { flow: "none" } }))
    const moved = landed(set(free, "258.3", { box: { x: 200, y: 100 } }))
    expect(listed(moved).get("258.3")?.box).toMatchObject({ x: 200 * 12_700, y: 100 * 12_700 })
  })
})

describe("an agent moves a layer into and out of a plain group through edit_deck", () => {
  it("joins a shape to a group where it shows, and leave puts it back on the slide", () => {
    const group = landed(edit(indexed(), { op: "group", elements: ["258.2", "258.3"] }))
    const joined = landed(edit(group, { op: "join", elements: ["258.9", "258.4"] }))
    expect(listed(joined).get("258.4")).toMatchObject({ grouped: true, box: elements[2]?.box })
    expect(listed(joined).get("258.9")?.box).toEqual({ x: 100_000, y: 100_000, cx: 900_000, cy: 900_000 })
    const left = landed(edit(joined, { op: "leave", elements: ["258.4"] }))
    expect(listed(left).get("258.4")).toMatchObject({ grouped: false, box: elements[2]?.box })
    expect(listed(left).get("258.9")?.box).toEqual({ x: 100_000, y: 100_000, cx: 400_000, cy: 350_000 })
  })
})
