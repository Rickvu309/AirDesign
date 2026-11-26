import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { agentDeck, apply, build, lastChild, minter, started, titledSlide } from "./agent-fixtures.js"
import { bottomLimitOf, contentAreaOf } from "./agent-place.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { doomFromTree } from "./doom-tree.js"
import type { Doom, NodeId } from "./index.js"
import { solveLayout } from "./solve-layout.js"
import { themeLibrary } from "./theme.js"
import { measure } from "./testing/doom-fixtures-art.js"
import { ids } from "./sample-deck.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const made = (doom: Doom) => lastChild(doom, slide)

const kpiItems = [
  { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
  { title: "Margin", value: "31%", note: "+2 pts" },
  { title: "Cash", value: "$9.1M" },
]

describe("a pattern under a title", () => {
  const titled = () => titledSlide()

  it.each(["kpi", "cards"] as const)(
    "keeps %s at content height under the title, short of the bottom margin",
    (kind) => {
      const { doom: start, on } = titled()
      const items =
        kind === "kpi"
          ? kpiItems
          : [
              { title: "Grow", icon: "trending-up", points: ["Enter two markets", "Double the sales team"] },
              { title: "Protect", icon: "shield", points: ["Cut cost to serve", "Raise retention"] },
              { title: "Build", icon: "hammer", points: ["Ship the platform", "Open the API"] },
            ]
      const doom = build(start, { op: "add", slide: on, kind, items } as AgentChange, minter("p"))
      const title = childrenOf(start, on).find((node) => propOf(node, "role") === "title")!
      const titleBox = propOf(title, "box")!
      const box = propOf(lastChild(doom, on), "box")!
      expect(box.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.h)
      expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
    },
  )

  it.each([
    ["kpi", kpiItems],
    [
      "cards",
      [
        { title: "Grow", icon: "trending-up", points: ["Enter two markets"] },
        { title: "Protect", icon: "shield", points: ["Cut cost to serve", "Raise retention"] },
      ],
    ],
    [
      "compare",
      [
        { title: "Build", points: ["Slower", "Ours to keep"] },
        { title: "Buy", points: ["Faster"] },
      ],
    ],
  ] as const)("keeps %s cards at their words' height at the top of a taller box", (kind, items) => {
    const { doom: start, on } = titled()
    const given = { x: 160, y: 280, w: 1600, h: 660 }
    const doom = build(start, { op: "add", slide: on, kind, items, box: given } as AgentChange, minter("p"))
    const row = lastChild(doom, on)
    const box = propOf(row, "box")!
    expect(box).toMatchObject({ x: given.x, y: given.y, w: given.w })
    expect(box.h).toBeLessThan(given.h / 2)
    expect(propOf(row, "sizing")).toEqual({ w: "fixed", h: "hug" })
    for (const card of childrenOf(doom, row.id)) expect(propOf(card, "sizing")).toEqual({ w: "fill", h: "fill" })
  })

  it.each(["timeline", "flow", "matrix"] as const)("fills the band down to the bottom margin for %s", (kind) => {
    const { doom: start, on } = titled()
    const items =
      kind === "matrix"
        ? [{ title: "Quick wins" }, { title: "Big bets" }, { title: "Fill-ins" }, { title: "Avoid" }]
        : kind === "timeline"
          ? [
              { value: "Q1", title: "Antidisestablishmentarianism", note: "One word" },
              { value: "Q2", title: "Build", note: "Core platform" },
              { value: "Q3", title: "Pilot", note: "Ten customers" },
            ]
          : [
              { title: "Collect the customer order" },
              { title: "Check stock in every warehouse" },
              { title: "Pack and label the parcels" },
            ]
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind,
        items,
        ...(kind === "matrix" ? { axes: ["Effort", "Impact"] } : {}),
      } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeGreaterThan(bottomLimitOf(1080) - items.length)
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })

  it("keeps a timeline that runs across at content height, short of the bottom margin", () => {
    const { doom: start, on } = titled()
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind: "timeline",
        items: [
          { value: "Q1", title: "Plan" },
          { value: "Q2", title: "Build" },
          { value: "Q3", title: "Launch" },
        ],
      } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
  })

  it("keeps a flow that runs across at content height, short of the bottom margin", () => {
    const { doom: start, on } = titled()
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind: "flow",
        items: [{ title: "Sign up" }, { title: "Verify" }, { title: "Pay" }],
      } as AgentChange,
      minter("p"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
  })

  it("fills a lone chart down to the bottom margin", () => {
    const { doom: start, on } = titled()
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind: "component",
        component: "column",
        box: contentAreaOf(start, on)!,
      } as AgentChange,
      minter("c"),
    )
    const box = propOf(lastChild(doom, on), "box")!
    expect(box.y + box.h).toBe(bottomLimitOf(1080))
  })
})

describe("cards sized to their words", () => {
  const shortCards = [
    { title: "Grow", icon: "trending-up", points: ["Enter two markets", "Double the sales team"] },
    { title: "Protect", icon: "shield", points: ["Cut cost to serve", "Raise retention"] },
    { title: "Build", icon: "hammer", points: ["Ship the platform", "Open the API"] },
  ]
  const row = (items: unknown) => made(build(agentDeck(), add({ kind: "cards", items })))

  it("keeps three short cards at content height, short of the bottom margin", () => {
    const doom = build(agentDeck(), add({ kind: "cards", items: shortCards }))
    const box = propOf(made(doom), "box")!
    expect(box.y + box.h).toBeLessThan(bottomLimitOf(1080))
    expect(box.h).toBeLessThan(0.55 * (1080 - box.y))
  })

  it("keeps a KPI row and a single card at the height of their words", () => {
    const kpis = build(agentDeck(), add({ kind: "kpi", items: kpiItems }))
    const box = propOf(made(kpis), "box")!
    expect(box.h).toBeLessThan(0.55 * (1080 - box.y))
    const one = build(agentDeck(), add({ kind: "cards", items: [shortCards[0]] }))
    expect(propOf(made(one), "box")!.h).toBeLessThan(0.4 * (1080 - propOf(made(one), "box")!.y))
  })

  it("keeps every card in the row as tall as the row", () => {
    const doom = build(agentDeck(), add({ kind: "cards", items: shortCards }))
    for (const card of childrenOf(doom, made(doom).id)) expect(propOf(card, "sizing")).toMatchObject({ h: "fill" })
  })

  it("grows a row to the height its words need, short of the bottom margin", () => {
    const tall = [
      shortCards[0]!,
      { title: "Long", points: Array.from({ length: 14 }, (_, at) => `A line of words ${at}`) },
    ]
    const box = propOf(row(tall), "box")!
    const short = propOf(row(shortCards), "box")!
    expect(box.h).toBeGreaterThan(short.h)
    expect(box.y + box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })
})

describe("a card row in a box shorter than its words", () => {
  type Given = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  const placed = (start: Doom, on: NodeId, kind: string, items: unknown, given: Given) => {
    const change = { op: "add", slide: on, kind, items, box: given } as AgentChange
    const writes = compileAgentChange(start, change, minter("p"), { measure })
    if ("refused" in writes) return writes
    const doom = apply(start, writes)
    const row = lastChild(doom, on)
    return { row, painted: solveLayout(doom, on, measure).get(row.id)! }
  }
  const same = (words: string, count: number) =>
    Array.from({ length: count }, () => ({ title: words, value: "$4.2M", note: words }))

  it("keeps three measured KPI cards inside a 275 px box by stepping the words down", () => {
    const { doom: start, on } = titledSlide()
    const given = { x: 160, y: 280, w: 1600, h: 275 }
    const got = placed(start, on, "kpi", same("Customer financial results for the year", 3), given)
    if ("refused" in got) throw new Error(JSON.stringify(got))
    expect(got.painted.y).toBe(given.y)
    expect(got.painted.h).toBeLessThanOrEqual(given.h)
  })

  it("refuses five KPI cards whose measured words cannot step down into a 316 px box", () => {
    const { doom: start, on } = titledSlide()
    const given = { x: 160, y: 280, w: 1600, h: 316 }
    const got = placed(start, on, "kpi", same("Customer financial results for the year", 5), given)
    expect(got).toMatchObject({ refused: "limit", field: "items" })
  })

  const long = "Customer financial results for the year, after every adjustment the auditors asked for"
  const rows = {
    kpi: (count: number) => same(long, count),
    cards: (count: number) =>
      Array.from({ length: count }, () => ({ title: long, icon: "star", points: [long, long] })),
    compare: (count: number) => Array.from({ length: count }, () => ({ title: long, points: [long, long] })),
  }
  it.each(Object.keys(themeLibrary))("never paints a card row past its box in the %s theme", (name) => {
    const grown = doomFromTree({ theme: themeLibrary[name]!.theme, slides: [{ children: [] }] })
    const start = started(grown.doom)
    const on = grown.slides[0]!
    for (const [kind, items] of Object.entries(rows))
      for (const count of kind === "compare" ? [2, 3] : [2, 3, 4, 5])
        for (const high of [240, 320, 420, 560]) {
          const given = { x: 160, y: 280, w: 1600, h: high }
          const got = placed(start, on, kind, items(count), given)
          if ("refused" in got) continue
          expect(got.painted.h, `${kind} ${String(count)} in ${String(high)}`).toBeLessThanOrEqual(high)
        }
  })
})
