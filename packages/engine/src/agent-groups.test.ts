import { readDeckId } from "@airdesign/catalog"
import {
  elementId,
  groupedNow,
  groupFormed,
  placeOf,
  type DeckIndex,
  type IndexElement,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

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
    kind: "picture",
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

function lastGroup(register: Register) {
  const command = register.order.at(-1)
  return command?.slide === "element-group" ? command : undefined
}

describe("an agent groups and ungroups elements through edit_deck", () => {
  it("groups two shapes in place under the run, and undo_run turns the group back", () => {
    const deck = landed(edit(indexed(), { op: "group", elements: ["258.2", "258.3"] }))
    const command = lastGroup(deck.register)
    expect(command).toMatchObject({
      runId: "run",
      element: { node: "258.9", box: { x: 100, y: 100, cx: 400, cy: 300 } },
    })
    expect(groupedNow(deck.register, node(2))).toBe(true)
    expect(placeOf(deck.register, node(3))?.box).toEqual(elements[1]?.box)
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(groupFormed(undone.register, node(9))).toBe(false)
    expect(groupedNow(undone.register, node(2))).toBe(false)
  })

  it("ungroups a file group with each child placed where it shows, and undo_run puts the group back", () => {
    const deck = landed(edit(indexed(), { op: "ungroup", elements: ["258.4"] }))
    expect(groupFormed(deck.register, node(4))).toBe(false)
    const read = readDeckPage(deck, { runId: "run" })
    const listed = read.ok ? read.elements : []
    expect(listed.find((each) => each.node === "258.5")).toMatchObject({ grouped: false })
    expect(listed.some((each) => each.node === "258.4")).toBe(false)
    expect(placeOf(deck.register, node(5))?.box).toEqual({ x: 1000, y: 1000, cx: 200, cy: 200 })
    expect(placeOf(deck.register, node(6))?.box).toEqual({ x: 1200, y: 1000, cx: 200, cy: 200 })
    expect(deck.register.elements[node(6)]?.landed.at(-1)).toMatchObject({ actor: "agent", runId: "run" })
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(groupFormed(undone.register, node(4))).toBe(true)
    expect(groupedNow(undone.register, node(5))).toBe(true)
    expect(placeOf(undone.register, node(5))?.box).toEqual(elements[3]?.box)
  })

  it("refuses a group across slides, of a placeholder or of one element, and an ungroup of a shape", () => {
    expect(edit(indexed(), { op: "group", elements: ["258.2", "259.3"] })).toEqual({ ok: false, refusal: "dead" })
    expect(edit(indexed(), { op: "group", elements: ["258.2", "258.7"] })).toEqual({ ok: false, refusal: "kind" })
    expect(edit(indexed(), { op: "group", elements: ["258.2"] })).toEqual({ ok: false, refusal: "field" })
    expect(edit(indexed(), { op: "group", elements: ["258.2", "258.5"] })).toEqual({ ok: false, refusal: "group-box" })
    expect(edit(indexed(), { op: "ungroup", elements: ["258.2"] })).toEqual({ ok: false, refusal: "kind" })
  })
})
