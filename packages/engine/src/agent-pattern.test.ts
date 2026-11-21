import { readDeckId } from "@airdesign/catalog"
import { readLayout, readRegister, type DeckIndex } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { call, openDeck, readDeckPage, type Deck } from "./index.js"

const agent = { actor: "agent", runId: "run" } as const
const size = { width: 12_192_000, height: 6_858_000 }
const point = 12_700

function blank(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  const opened = openDeck(id.deck)
  const index: DeckIndex = {
    format: 2,
    total: 0,
    slides: [{ id: "258", position: 0, size, free: 9 }],
    elements: [],
    pages: [],
  }
  return { ...opened, register: { ...opened.register, index } }
}

function edit(deck: Deck, ...changes: readonly object[]) {
  return call("edit_deck", deck, agent, { deck: "deck", base: deck.revision, changes })
}

const area = { x: 64, y: 150, w: 832, h: 200 }

describe("an agent builds a laid-out slide part with op diagram and a pattern", () => {
  it("lays a KPI row out as cards of equal width across the box, as tall as the tallest card", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "kpi",
      box: area,
      items: [
        { title: "Revenue", value: "$48.2M", note: "▲ 24% YoY" },
        { title: "Gross margin", value: "61.4%", note: "▼ 2.0 pts YoY" },
        { title: "Net revenue retention", value: "118%", note: "▲ 4 pts YoY" },
      ],
    })
    if (!result.ok) throw new Error(result.refusal)
    const listed = readDeckPage(result.deck, { runId: "run" }).elements
    const frames = listed.filter(
      (element) => readLayout(result.deck.register, element.node as never)?.flow === "horizontal",
    )
    expect(frames).toHaveLength(1)
    const row = readLayout(result.deck.register, frames[0]!.node as never)
    expect(row?.box).toMatchObject({ x: 64 * point, y: 150 * point, cx: 832 * point })
    expect(row?.box.cy).toBeGreaterThan(60 * point)
    expect(row?.box.cy).toBeLessThan(200 * point)
    expect(new Set(row?.children.map((child) => child.box.cx)).size).toBe(1)
    expect(new Set(row?.children.map((child) => child.box.cy))).toEqual(new Set([row?.box.cy]))
    expect(row?.children).toHaveLength(3)
  })

  const long = (at: number) => ({
    title: `Priority ${String(at + 1)}: a heading that runs long enough to wrap`,
    value: "−$148.2M",
    points: Array.from(
      { length: 3 },
      (_, line) => `Point ${String(line + 1)} carries a full sentence of detail that a board member would read`,
    ),
    icon: "users",
  })
  const rowOf = (deck: Deck, flow: "horizontal" | "vertical") => {
    const listed = readDeckPage(deck, { runId: "run" }).elements
    const frame = listed.find((element) => readLayout(deck.register, element.node as never)?.flow === flow)
    return readLayout(deck.register, frame!.node as never)
  }
  const big = { x: 64, y: 110, w: 832, h: 380 }

  it("steps the type down until six long cards fit inside the box", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: Array.from({ length: 6 }, (_, at) => long(at)),
    })
    if (!result.ok) throw new Error(result.refusal)
    expect(rowOf(result.deck, "horizontal")?.box.cy).toBeLessThanOrEqual(380 * point)
  })

  it("refuses with limit when the words cannot fit the box at the smallest type", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: { x: 64, y: 110, w: 300, h: 60 },
      items: Array.from({ length: 6 }, (_, at) => long(at)),
    })
    expect(result).toMatchObject({ ok: false, refusal: "limit" })
  })

  it("sizes each KPI number so the longest value keeps to one line", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "kpi",
      box: big,
      items: Array.from({ length: 6 }, (_, at) => long(at)),
    })
    if (!result.ok) throw new Error(result.refusal)
    const row = rowOf(result.deck, "horizontal")
    const inner = (row?.children[0]?.box.cx ?? 0) / point - 2 * 19.2
    const sizes = JSON.stringify(result.deck.register).match(/\\"size\\":(\d+)/g) ?? []
    const number = Math.max(...sizes.map((size) => Number(size.replace(/\D/g, "")))) / 100
    expect("−$148.2M".length * number * 0.52).toBeLessThan(inner)
  })

  const item = (at: number) => ({
    title: `Item ${String(at + 1)}`,
    value: `Q${String(at + 1)}`,
    note: "One line under it",
    points: ["First point", "Second point"],
    icon: "users",
  })
  const counts = { cards: [2, 6], compare: [2, 3], matrix: [4, 4], timeline: [2, 6], kpi: [2, 6] } as const

  it.each(
    Object.entries(counts).flatMap(
      ([pattern, [low, high]]) =>
        [
          [pattern, low],
          [pattern, high],
        ] as const,
    ),
  )("lands %s with %i items", (pattern, count) => {
    const items = Array.from({ length: count }, (_, at) => item(at))
    const result = edit(blank(), { op: "diagram", slide: "258", pattern, box: area, items })
    if (!result.ok) throw new Error(result.refusal)
    const { index, ...stored } = result.deck.register
    expect(readRegister(JSON.parse(JSON.stringify(stored)), JSON.parse(JSON.stringify(index)))).toMatchObject({
      ok: true,
    })
  })
})
