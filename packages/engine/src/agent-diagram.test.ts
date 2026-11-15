import { readDeckId } from "@airdesign/catalog"
import {
  elementId,
  groupedNow,
  groupFormed,
  landedPatch,
  placeOf,
  type DeckIndex,
  type IndexElement,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { labelBoxes } from "./agent-diagram.js"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`258.${shape}`)

const elements: readonly IndexElement[] = [
  {
    node: node(2),
    kind: "shape",
    value: "Title",
    box: { x: 838200, y: 365125, cx: 10515600, cy: 1325563 },
    grouped: false,
    role: "title",
  },
  { node: node(3), kind: "shape", value: "", box: { x: 400, y: 300, cx: 100, cy: 100 }, grouped: false },
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

function patchOf(register: Register, shape: number) {
  const body = register.elements[node(shape)]
  if (body === undefined) throw new Error("body")
  return landedPatch(body, "text")
}

const area = { x: 914400, y: 2286000, cx: 9144000, cy: 1828800 }

describe("an agent builds a diagram in one change", () => {
  it("lays out one rounded shape per label across the area, with a quarter of a shape between each", () => {
    expect(labelBoxes(area, 3)).toEqual([
      { x: 914400, y: 2416629, cx: 2612571, cy: 1567543 },
      { x: 4180113, y: 2416629, cx: 2612571, cy: 1567543 },
      { x: 7445826, y: 2416629, cx: 2612571, cy: 1567543 },
    ])
  })

  it("adds three labelled shapes, two arrows bound right site to left site, and one group, all under the run", () => {
    const deck = landed(
      edit(indexed(), {
        op: "diagram",
        slide: "258",
        labels: ["Plan", "Build", "Ship"],
        box: { x: 72, y: 180, w: 720, h: 144 },
      }),
    )
    const added = deck.register.order.filter((command) => command.slide === "element-add")
    expect(added.map((command) => command.slide === "element-add" && command.element.kind)).toEqual([
      "shape",
      "shape",
      "shape",
      "connector",
      "connector",
    ])
    expect(patchOf(deck.register, 9).geometry).toEqual({ shape: { set: { preset: "roundRect", adjust: {} } } })
    expect(patchOf(deck.register, 9).text?.value).toEqual({ set: expect.stringContaining('"text":"Plan"') })
    expect(patchOf(deck.register, 12).connection).toEqual({
      start: { set: { shape: { node: node(9), site: 3 } } },
      end: { set: { shape: { node: node(10), site: 1 } } },
    })
    expect(patchOf(deck.register, 13).connection?.end).toEqual({ set: { shape: { node: node(11), site: 1 } } })
    expect(patchOf(deck.register, 12).line).toMatchObject({
      fill: { set: { solid: { scheme: "accent1" } } },
      width: { set: 25_400 },
      tail: { set: { type: "triangle", width: "med", length: "med" } },
    })
    const group = deck.register.order.at(-1)
    expect(group).toMatchObject({ slide: "element-group", runId: "run", element: { node: "258.14" } })
    for (const shape of [9, 10, 11, 12, 13]) expect(groupedNow(deck.register, node(shape))).toBe(true)
    const first = placeOf(deck.register, node(9))?.box
    const arrow = placeOf(deck.register, node(12))?.box
    expect(arrow).toEqual({
      x: (first?.x ?? 0) + (first?.cx ?? 0),
      y: Math.round((first?.y ?? 0) + (first?.cy ?? 0) / 2),
      cx: 653142,
      cy: 0,
    })
    const read = readDeckPage(deck, { runId: "run" })
    const listed = read.ok ? read.elements : []
    expect(listed.find((each) => each.node === "258.12")?.design).toContain("connection.start 258.9 site 3")
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(groupFormed(undone.register, node(14))).toBe(false)
  })

  it("puts the diagram in the largest free area when no box is sent", () => {
    const deck = landed(edit(indexed(), { op: "diagram", slide: "258", labels: ["One", "Two"] }))
    const first = placeOf(deck.register, node(9))?.box
    expect(first?.y).toBeGreaterThan(365125 + 1325563)
  })

  it("refuses one label, an empty label, an unknown slide and a connection to a site the shape lacks", () => {
    expect(edit(indexed(), { op: "diagram", slide: "258", labels: ["Only"] })).toEqual({ ok: false, refusal: "field" })
    expect(edit(indexed(), { op: "diagram", slide: "258", labels: ["A", " "] })).toEqual({
      ok: false,
      refusal: "field",
    })
    expect(edit(indexed(), { op: "diagram", slide: "259", labels: ["A", "B"] })).toEqual({ ok: false, refusal: "dead" })
    const deck = landed(edit(indexed(), { op: "diagram", slide: "258", labels: ["A", "B"] }))
    const rebind = { op: "set", target: "258.11", connection: { end: { shape: { node: "258.10", site: 4 } } } }
    expect(edit(deck, rebind)).toEqual({ ok: false, refusal: "site" })
    const other = { op: "set", target: "258.11", connection: { end: { shape: { node: "258.3", site: 0 } } } }
    expect(edit(deck, other)).toEqual({ ok: false, refusal: "site" })
  })
})
