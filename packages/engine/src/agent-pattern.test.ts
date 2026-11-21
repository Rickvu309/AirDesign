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

  const pointSizes = (deck: Deck) =>
    [
      ...JSON.stringify(deck.register)
        .replaceAll("\\", "")
        .matchAll(/"text":"Point[^"]*","size":(\d+)/g),
    ].map((found) => Number(found[1]))
  const wordy = (at: number, points: number) => ({ ...long(at), points: long(at).points.slice(0, points) })

  it("steps the type down so five long cards fit, and no point drops below 10 pt", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: Array.from({ length: 5 }, (_, at) => wordy(at, 3)),
    })
    if (!result.ok) throw new Error(result.refusal)
    expect(rowOf(result.deck, "horizontal")?.box.cy).toBeLessThanOrEqual(380 * point)
    expect(Math.min(...pointSizes(result.deck))).toBeGreaterThanOrEqual(1000)
    expect(Math.max(...pointSizes(result.deck))).toBeLessThan(1200)
  })

  it("refuses six long cards that would only fit below 10 pt", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: Array.from({ length: 6 }, (_, at) => long(at)),
    })
    expect(result).toMatchObject({ ok: false, refusal: "limit" })
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

  const styledDeck = (textStyles: readonly object[]): Deck => {
    const deck = blank()
    const index = deck.register.index
    if (index === undefined) throw new Error("no index")
    const slides = index.slides.map((slide) => ({ ...slide, textStyles }))
    return { ...deck, register: { ...deck.register, index: { ...index, slides } as DeckIndex } }
  }

  it("keeps its own scale in a deck whose only Body 2 is a master's second body level", () => {
    const imported = styledDeck([
      { id: "b1", name: "Body 1", fields: { size: 2800 } },
      { id: "b2", name: "Body 2", fields: { size: 2400 } },
    ])
    const result = edit(imported, {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: [
        { title: "One", points: ["A point"] },
        { title: "Two", points: ["A point"] },
      ],
    })
    if (!result.ok) throw new Error(result.refusal)
    expect(JSON.stringify(result.deck.register).replaceAll("\\", "")).toContain('"text":"A point","size":1200')
  })

  it("never steps a point below the deck's Caption size, and refuses what would need it", () => {
    const scale = [
      { id: "h", name: "Heading", fields: { size: 2000 } },
      { id: "b", name: "Body 2", fields: { size: 1400 } },
      { id: "c", name: "Caption", fields: { size: 1100 } },
    ]
    const fits = edit(styledDeck(scale), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: Array.from({ length: 4 }, (_, at) => wordy(at, 2)),
    })
    if (!fits.ok) throw new Error(fits.refusal)
    expect(Math.min(...pointSizes(fits.deck))).toBeGreaterThanOrEqual(1100)
    const tight = edit(styledDeck(scale), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: Array.from({ length: 6 }, (_, at) => long(at)),
    })
    expect(tight).toMatchObject({ ok: false, refusal: "limit" })
  })

  it("takes each text's size, font and line height from the deck's text styles by name", () => {
    const styled = styledDeck([
      { id: "h", name: "Heading", fields: { size: 2000, font: "+mj-lt", lineHeight: 110_000 } },
      { id: "b", name: "Body 2", fields: { size: 1400, font: "+mn-lt", lineHeight: 125_000, spaceAfter: 600 } },
    ])
    const result = edit(styled, {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: [
        { title: "One", points: ["A point"] },
        { title: "Two", points: ["A point"] },
      ],
    })
    if (!result.ok) throw new Error(result.refusal)
    const stored = JSON.stringify(result.deck.register).replaceAll("\\", "")
    expect(stored).toContain('"lineHeight":110000,"spaceBefore":0,"spaceAfter":0,"runs":[{"from":-1,"text":"One"')
    expect(stored).toContain('"text":"One","bold":true,"size":2000')
    expect(stored).toContain(
      '"lineHeight":125000,"spaceBefore":0,"spaceAfter":600,"runs":[{"from":-1,"text":"A point","size":1400',
    )
  })

  it("stretches cards to the height of their box, every card the same height", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      items: [long(0), { title: "Short" }],
    })
    if (!result.ok) throw new Error(result.refusal)
    const row = rowOf(result.deck, "horizontal")
    expect(row?.box.cy).toBe(380 * point)
    expect(new Set(row?.children.map((child) => child.box.cy))).toEqual(new Set([380 * point]))
  })

  it("fills the box with a 2x2 of equal quadrants and names its axes", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "matrix",
      box: big,
      labels: ["Impact", "Effort"],
      items: Array.from({ length: 4 }, (_, at) => ({ title: `Quadrant ${String(at + 1)}` })),
    })
    if (!result.ok) throw new Error(result.refusal)
    const layouts = readDeckPage(result.deck, { runId: "run" }).elements.flatMap((element) => {
      const layout = readLayout(result.deck.register, element.node as never)
      return layout === null ? [] : [layout]
    })
    const banded = (layout: (typeof layouts)[number]) =>
      layout.children.every((child) => readLayout(result.deck.register, child.node as never)?.flow === "horizontal")
    const grid = layouts.find((layout) => layout.flow === "vertical" && banded(layout))
    const quadrant = readLayout(result.deck.register, grid!.children[0]!.node as never)?.children[0]?.box
    expect(grid!.box.y + grid!.box.cy).toBeGreaterThan(110 * point + 340 * point)
    expect(grid!.box.x + grid!.box.cx).toBeGreaterThan((64 + 832) * point - 2 * point)
    expect(quadrant!.cx * 2).toBeLessThan(grid!.box.cx)
    expect(quadrant!.cy * 2).toBeLessThan(grid!.box.cy)
    const stored = JSON.stringify(result.deck.register)
    expect(stored).toContain("Impact")
    expect(stored).toContain("vert270")
  })

  it("refuses axis titles on a pattern that has no axes", () => {
    const result = edit(blank(), {
      op: "diagram",
      slide: "258",
      pattern: "cards",
      box: big,
      labels: ["Impact", "Effort"],
      items: [{ title: "One" }, { title: "Two" }],
    })
    expect(result.ok).toBe(false)
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
    const box = pattern === "matrix" ? big : area
    const result = edit(blank(), { op: "diagram", slide: "258", pattern, box, items })
    if (!result.ok) throw new Error(result.refusal)
    const { index, ...stored } = result.deck.register
    expect(readRegister(JSON.parse(JSON.stringify(stored)), JSON.parse(JSON.stringify(index)))).toMatchObject({
      ok: true,
    })
  })
})
