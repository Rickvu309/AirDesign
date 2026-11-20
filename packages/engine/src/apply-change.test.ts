import { readDeckId } from "@airdesign/catalog"
import {
  changedTable,
  currentBox,
  currentValue,
  elementGone,
  elementId,
  format,
  openingTable,
  readTableValue,
  readTextValue,
  writeTableValue,
  writeTextValue,
  type DeckIndex,
  type IndexElement,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { nodeBody } from "./call-fixtures.js"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const box = { x: 914_400, y: 457_200, cx: 1_828_800, cy: 914_400 }
const size = { width: 12_192_000, height: 6_858_000 }
const agent = { actor: "agent", runId: "run" } as const
const person = { actor: "person" } as const
const titled = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Quarterly" }] }])

function element(node: string, extra: Partial<IndexElement> = {}): IndexElement {
  return { node: elementId(node), kind: "shape", value: titled, box, grouped: false, ...extra }
}

const elements: readonly IndexElement[] = [
  element("258.2", { role: "title" }),
  element("258.4", { kind: "shape", value: null, role: "picture" }),
  element("258.5", { grouped: true }),
  element("258.6", { kept: ["text.color"] }),
  element("259.2", { role: "title" }),
]

function indexed(index: Partial<DeckIndex> = {}): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const whole: DeckIndex = {
    format: 2,
    total: elements.length,
    slides: [
      { id: "258", position: 0, size, free: 9 },
      { id: "259", position: 1, size, free: 9 },
    ],
    elements,
    pages: [],
    ...index,
  }
  return { ...opened, register: { ...opened.register, index: whole } }
}

function landed(result: ReturnType<typeof call>): Deck {
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function started(deck: Deck, ...nodes: readonly string[]): Deck {
  const elements = nodes.map((node) => ({ node }))
  return landed(call("start_run", deck, agent, { deck: "deck", runId: "run", elements }))
}

function edit(deck: Deck, ...changes: readonly object[]) {
  return call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes })
}

function colours(register: Register, node: string): readonly unknown[] {
  const text = readTextValue(currentValue(nodeBody(register, elementId(node)))) ?? []
  return text.flatMap((paragraph) => paragraph.runs.map((run) => run.color))
}

describe("edit_deck lands a set change as one row of trait fields on each element it names", () => {
  it("recolours every title, and undo_run takes every row back", () => {
    const deck = landed(
      edit(started(indexed(), "258.2", "259.2"), { op: "set", target: "*.title", text: { color: "accent1" } }),
    )
    expect(colours(deck.register, "258.2")).toEqual([{ scheme: "accent1" }])
    expect(colours(deck.register, "259.2")).toEqual([{ scheme: "accent1" }])
    const row = nodeBody(deck.register, elementId("258.2")).landed.at(-1)
    expect(row).toMatchObject({ actor: "agent", runId: "run", visible: true, v: format })
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(currentValue(nodeBody(undone.register, elementId("259.2")))).toBe(titled)
  })

  it("moves one side of a box and keeps the rest", () => {
    const deck = landed(edit(started(indexed(), "258.2"), { op: "set", target: "258.2", box: { x: 36 } }))
    expect(currentBox(nodeBody(deck.register, elementId("258.2")))).toEqual({ ...box, x: 457_200 })
  })

  it("lands a set beside a text change in one call", () => {
    const deck = landed(
      edit(
        started(indexed(), "258.2", "259.2"),
        { node: "259.2", readAt: 0, value: "Agenda" },
        { op: "set", target: "259.title", text: { bold: true } },
      ),
    )
    expect(readTextValue(currentValue(nodeBody(deck.register, elementId("259.2"))))).toEqual([
      { from: 0, runs: [{ from: 0, text: "Agenda", bold: true }] },
    ])
  })
})

describe("edit_deck moves a layer inside a group by its place on the slide", () => {
  const frame = { x: 0, y: 0, cx: 914_400, cy: 457_200 }
  const group = element("258.7", { kind: "group", value: null, frame })
  const child = element("258.8", { box: { x: 0, y: 0, cx: 457_200, cy: 457_200 }, grouped: true, group: group.node })
  const grouped = () => {
    const all = [...elements, group, child]
    return started(indexed({ elements: all, total: all.length }), "258.8")
  }

  it("stores the move in the group's own space, as a person's move does", () => {
    const deck = landed(edit(grouped(), { op: "set", target: "258.8", box: { x: 144 } }))
    expect(currentBox(nodeBody(deck.register, elementId("258.8")))).toEqual({
      x: 457_200,
      y: 0,
      cx: 457_200,
      cy: 457_200,
    })
    expect(deck.register.nodes).not.toContain(elementId("258.7"))
    const read = readDeckPage(deck, { runId: "run" }).elements
    expect(read.find((each) => each.node === "258.8")?.box).toEqual({
      x: 1_828_800,
      y: 457_200,
      cx: 914_400,
      cy: 914_400,
    })
    expect(read.find((each) => each.node === "258.7")?.box).toEqual({
      x: 1_828_800,
      y: 457_200,
      cx: 914_400,
      cy: 914_400,
    })
  })

  it("stores an agent's whole-box edit of a grouped layer in its group's space, and refuses one whose group is unknown", () => {
    const value = { x: 1_828_800, y: 457_200, cx: 914_400, cy: 914_400 }
    const deck = landed(edit(grouped(), { node: "258.8", readAt: 0, property: "box", value }))
    expect(currentBox(nodeBody(deck.register, elementId("258.8")))).toEqual({
      x: 457_200,
      y: 0,
      cx: 457_200,
      cy: 457_200,
    })
    const lost = started(indexed(), "258.5")
    expect(edit(lost, { node: "258.5", readAt: 0, property: "box", value })).toEqual({
      ok: false,
      refusal: "group-box",
    })
  })

  it("reads a grouped layer's box where it sits on the slide", () => {
    const read = readDeckPage(grouped(), { runId: "run" }).elements
    expect(read.find((each) => each.node === "258.8")?.box).toEqual({
      x: 914_400,
      y: 457_200,
      cx: 914_400,
      cy: 914_400,
    })
  })
})

describe("edit_deck refuses a set change it cannot land, and lands nothing", () => {
  const running = () => started(indexed(), "258.2", "258.4", "258.5", "258.6", "259.2")

  it("refuses kind, group-box and kept", () => {
    expect(edit(running(), { op: "set", target: "258.4", text: { bold: true } })).toEqual({
      ok: false,
      refusal: "kind",
    })
    expect(edit(running(), { op: "set", target: "258.5", box: { x: 1 } })).toEqual({ ok: false, refusal: "group-box" })
    expect(edit(running(), { op: "set", target: "258.6", text: { color: "accent2" } })).toEqual({
      ok: false,
      refusal: "kept",
    })
  })

  it("refuses a role before the index holds roles, and an element the deck does not hold", () => {
    expect(edit(indexed({ format: 1 }), { op: "set", target: "*.title", text: { bold: true } })).toEqual({
      ok: false,
      refusal: "indexing",
    })
    expect(edit(running(), { op: "set", target: "258.77", box: { x: 1 } })).toEqual({ ok: false, refusal: "dead" })
    expect(edit(running(), { op: "set", target: "*.footer", box: { x: 1 } })).toEqual({ ok: false, refusal: "dead" })
  })

  it("refuses a set on an element the run does not hold, a person's edit during the run, and a stale base", () => {
    expect(edit(indexed(), { op: "set", target: "258.2", box: { x: 1 } })).toEqual({ ok: false, refusal: "run-fenced" })
    const guarded = landed(
      call("commit_edits", running(), person, { deck: "deck", batch: [{ node: "259.2", value: "Mine" }] }),
    )
    expect(edit(guarded, { op: "set", target: "*.title", text: { bold: true } })).toEqual({
      ok: false,
      refusal: "person-protected",
    })
    const stale = call("edit_deck", guarded, agent, {
      deck: "deck",
      base: 0,
      changes: [{ op: "set", target: "258.2", box: { x: 1 } }],
    })
    expect(stale).toEqual({ ok: false, refusal: "stale" })
  })

  it("refuses a row over the value limit", () => {
    const long = "x".repeat(8_001)
    expect(edit(running(), { op: "set", target: "258.2", text: { value: long } })).toEqual({
      ok: false,
      refusal: "limit",
    })
  })

  it("lands an agent's table cell fills as the table's value", () => {
    const opening = writeTableValue(openingTable(2, 2))
    const table = element("259.3", { kind: "table", value: opening, role: "table" })
    const deck = started(indexed({ elements: [...elements, table], total: elements.length + 1 }), "259.3")
    const accent = { solid: { scheme: "accent1" } } as const
    const filled = changedTable(openingTable(2, 2), {
      change: "fill",
      cells: { rows: [0, 0], columns: [0, 1] },
      fill: accent,
    })
    const value = writeTableValue(filled!)
    const filledDeck = landed(edit(deck, { op: "set", target: "259.3", table: { value } }))
    expect(currentValue(nodeBody(filledDeck.register, elementId("259.3")))).toBe(value)
  })
})

describe("edit_deck adds a text box from an add change", () => {
  it("adds it under the run with its box in points and its text", () => {
    const deck = landed(
      edit(indexed(), {
        op: "add",
        kind: "shape",
        slide: "258",
        box: { x: 72, y: 36, w: 144, h: 72 },
        text: { value: "New", bold: true },
      }),
    )
    const added = deck.register.order.at(-1)
    expect(added).toMatchObject({
      slide: "element-add",
      runId: "run",
      element: { node: "258.9", kind: "shape", value: "", box: { x: 914_400, y: 457_200, cx: 1_828_800, cy: 914_400 } },
    })
    expect(readTextValue(currentValue(nodeBody(deck.register, elementId("258.9"))))).toEqual([
      { from: 0, runs: [{ from: 0, text: "New", bold: true }] },
    ])
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(elementGone(undone.register, elementId("258.9"))).toBe(true)
  })

  it("places an add with no box in the largest free area, and refuses a slide the deck does not hold", () => {
    const deck = landed(edit(indexed(), { op: "add", kind: "shape", slide: "259" }))
    expect(deck.register.order.at(-1)).toMatchObject({ slide: "element-add", element: { node: "259.9" } })
    expect(edit(indexed(), { op: "add", kind: "shape", slide: "300" })).toEqual({ ok: false, refusal: "dead" })
  })
})

describe("edit_deck adds a table from an add change", () => {
  const typed = (rows: readonly (readonly string[])[]) =>
    writeTableValue({
      rows: rows.map((cells, from) => ({
        from,
        cells: cells.map((text) => [{ from: 0, runs: [{ from: -1, text }] }]),
      })),
    })

  it("adds an empty table of the value's rows and columns under the run, then writes its cells", () => {
    const value = typed([
      ["Region", "Revenue", "Growth"],
      ["Europe", "4.2", "12%"],
    ])
    const deck = landed(
      edit(indexed(), {
        op: "add",
        kind: "table",
        slide: "258",
        box: { x: 72, y: 36, w: 432, h: 72 },
        table: { value },
      }),
    )
    const added = deck.register.order.at(-1)
    expect(added).toMatchObject({
      slide: "element-add",
      runId: "run",
      element: { node: "258.9", kind: "table", value: writeTableValue(openingTable(2, 3)) },
    })
    expect(readTableValue(currentValue(nodeBody(deck.register, elementId("258.9"))))).toEqual(readTableValue(value))
    const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
    expect(elementGone(undone.register, elementId("258.9"))).toBe(true)
  })

  it("places a table with no box in the largest free area at a row height per row", () => {
    const value = typed([["A"], ["B"], ["C"]])
    const deck = landed(edit(indexed(), { op: "add", kind: "table", slide: "259", table: { value } }))
    const added = deck.register.order.at(-1)
    if (added?.slide !== "element-add") throw new Error("not added")
    expect(added.element.box?.cy).toBe(3 * 370_840)
  })
})

for (const text of [{ strike: true }, { letterSpacing: -0.64 }, { list: "numbers" }]) {
  it(`lets an agent set ${JSON.stringify(text)} through edit_deck`, () => {
    const result = edit(started(indexed(), "258.2"), { op: "set", target: "258.2", text })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = readTextValue(currentValue(nodeBody(result.deck.register, elementId("258.2"))))
    expect(value).toMatchObject([
      {
        from: 0,
        ...(text.list ? { list: "numbers" } : {}),
        runs: [
          {
            from: 0,
            text: "Quarterly",
            ...(text.strike ? { strike: true } : {}),
            ...(text.letterSpacing ? { letterSpacing: -64 } : {}),
          },
        ],
      },
    ])
  })
}

it("lets agents apply the indexed template typography using the same text path and undo it", () => {
  const fields = { size: 4400, font: "+mj-lt", bold: true, align: "center" as const, lineHeight: 120000 }
  const original = indexed({
    slides: [
      { id: "258", position: 0, textStyles: [{ id: "master/title", name: "Title", fields }] },
      { id: "259", position: 1 },
    ],
  })
  const deck = landed(edit(started(original, "258.2"), { op: "set", target: "258.2", text: { style: "master/title" } }))
  const body = nodeBody(deck.register, elementId("258.2"))
  expect(body.landed).toHaveLength(1)
  expect(readTextValue(currentValue(body))?.[0]).toMatchObject({
    align: "center",
    lineHeight: 120000,
    runs: [{ text: "Quarterly", size: 4400, font: "+mj-lt", bold: true }],
  })
  const undone = landed(call("undo_run", deck, person, { deck: "deck", runId: "run" }))
  expect(currentValue(nodeBody(undone.register, elementId("258.2")))).toBe(titled)
})
