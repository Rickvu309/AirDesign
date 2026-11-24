import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { bottomLimitOf, gapFor, padFor } from "./agent-place.js"
import { agentDeck, build, lastChild, minter, started } from "./agent-fixtures.js"
import { doomFromTree } from "./doom-tree.js"
import { defaultTheme } from "./default-theme-art.js"
import { childrenOf, descendantsOf, propOf, slidesOf } from "./doom-walk.js"
import { ladderOf } from "./pattern-parts.js"
import { titleOnlyWrites } from "./slide-placeholders.js"
import { textStyleNames } from "./text.js"
import { widestLine } from "./text-estimate.js"
import { applyEdit, isRefusal, rev, type Doom, type NodeId } from "./index.js"
import { ids, land } from "./sample-deck.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const texts = (doom: Doom, root: NodeId) =>
  descendantsOf(doom, root).filter((node) => propOf(node, "text") !== undefined)
const made = (doom: Doom) => lastChild(doom, slide)
const styled = (doom: Doom, root: NodeId) => texts(doom, root).map((node) => propOf(node, "text")!.style)

const kpiItems = [
  { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
  { title: "Margin", value: "31%", note: "+2 pts" },
  { title: "Cash", value: "$9.1M" },
]
const numberStyles = (doom: Doom, row: NodeId) =>
  childrenOf(doom, row).map((card) => propOf(childrenOf(doom, card.id)[1]!, "text")!.style)

describe.each([
  ["kpi", { items: kpiItems }],
  [
    "cards",
    {
      items: [
        { title: "Grow", points: ["Enter two markets", "Hire sales"], icon: "trending-up" },
        { title: "Protect", points: ["Cut cost"], icon: "shield" },
        { title: "Build", points: ["Ship v2"], icon: "hammer" },
      ],
    },
  ],
  [
    "compare",
    {
      items: [
        { title: "Build", points: ["Slow", "Ours"] },
        { title: "Buy", points: ["Fast", "Costly"] },
      ],
    },
  ],
  [
    "matrix",
    {
      items: [
        { title: "Quick wins", points: ["a"] },
        { title: "Big bets", points: ["b"] },
        { title: "Fill-ins", points: ["c"] },
        { title: "Avoid", points: ["d"] },
      ],
      axes: ["Effort", "Impact"],
    },
  ],
  [
    "timeline",
    {
      items: [
        { value: "Q1", title: "Plan", note: "Scope" },
        { value: "Q2", title: "Build" },
        { value: "Q3", title: "Launch", note: "Go live" },
      ],
    },
  ],
  ["flow", { items: [{ title: "Sign up", note: "Email" }, { title: "Verify" }, { title: "Pay", note: "Card" }] }],
] as const)("add %s", (kind, look) => {
  const doom = build(agentDeck(), add({ kind, ...look }))
  const root = made(doom)

  it("lands as a frame tree the doom accepts, inside the slide and clear of what was there", () => {
    expect(root.type).toBe("frame")
    const box = propOf(root, "box")!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(1920)
    expect(box.y).toBeGreaterThanOrEqual(100)
    expect(box.y + box.h).toBeLessThanOrEqual(1080)
    expect(descendantsOf(doom, root.id).length).toBeGreaterThan(3)
  })

  it("writes every text in a named style of the deck, and no size, font, tracking or case of its own", () => {
    expect(texts(doom, root.id).length).toBeGreaterThan(0)
    for (const node of texts(doom, root.id)) {
      const text = propOf(node, "text")!
      expect(textStyleNames).toContain(text.style)
      for (const span of text.spans)
        expect(Object.keys(span).filter((key) => !["end", "bold", "italic", "link", "color"].includes(key))).toEqual([])
    }
  })

  it("never writes a box for a child a layout places, except the fixed ones", () => {
    for (const node of descendantsOf(doom, root.id)) {
      const sizing = propOf(node, "sizing")
      if (sizing?.w === "fill" && sizing.h === "hug") expect(propOf(node, "box")).toBeUndefined()
    }
  })

  it("refuses an empty item list, naming the field", () => {
    expect(compileAgentChange(agentDeck(), add({ kind }), minter())).toMatchObject({
      refused: "shape",
      field: "items",
      change: `add ${kind}`,
    })
  })
})

describe("kpi", () => {
  const doom = build(agentDeck(), add({ kind: "kpi", items: kpiItems }))
  const root = made(doom)

  it("is a row of top-aligned cards, each a column of label, number and note in bigNumber", () => {
    expect(propOf(root, "name")).toBe("KPI")
    expect(propOf(root, "layout")).toMatchObject({ mode: "row" })
    const cards = childrenOf(doom, root.id)
    expect(cards).toHaveLength(3)
    expect(propOf(cards[0]!, "layout")).toMatchObject({ mode: "column" })
    expect(propOf(cards[0]!, "fills")).toEqual([{ kind: "solid", color: { var: "background2" } }])
    expect(childrenOf(doom, cards[0]!.id).map((node) => propOf(node, "text")!.style)).toEqual([
      "label",
      "bigNumber",
      "caption",
    ])
    expect(childrenOf(doom, cards[2]!.id).map((node) => propOf(node, "text")!.style)).toEqual(["label", "bigNumber"])
    for (const card of cards) expect(propOf(card, "layout")).toMatchObject({ align: "top-left" })
  })

  it("keeps the row at the height its words need and gives the area below to the next add", () => {
    const next = build(doom, add({ kind: "cards", items: [{ title: "A", points: ["b"] }] }), minter("b"))
    const row = childrenOf(next, slide).find((node) => propOf(node, "name") === "KPI")!
    const rowBox = propOf(row, "box")!
    const card = propOf(made(next), "box")!
    expect(rowBox.h).toBe(propOf(root, "box")!.h)
    expect(card.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.h)
    expect(rowBox.y + rowBox.h).toBeLessThan(bottomLimitOf(1080))
    expect(card.y + card.h).toBeLessThanOrEqual(bottomLimitOf(1080))
  })

  it("uses one number style on two KPI slides when the values are the same width", () => {
    const mint = minter("s")
    const opened = build(build(agentDeck(), { op: "slide", add: {} }, mint), { op: "slide", add: {} }, mint)
    const slides = slidesOf(opened).slice(-2)
    const notes = [
      kpiItems,
      kpiItems.map((item, at) =>
        at === 1 ? { ...item, note: "up 3 points since the cost programme started in the first quarter" } : item,
      ),
    ]
    let doom = opened
    slides.forEach((each, at) => {
      doom = build(doom, { op: "add", kind: "kpi", slide: each.id, items: notes[at] } as AgentChange, minter(`k${at}`))
    })
    const styles = slides.flatMap((each) => numberStyles(doom, lastChild(doom, each.id).id))
    expect(new Set(styles)).toEqual(new Set(["bigNumber"]))
  })

  it("keeps wide values on one line at 4:3, in the one largest style that fits the row", () => {
    const wide = [
      { title: "Revenue", value: "$1,234,567.89", note: "Q3" },
      { title: "Costs", value: "$987,654.32", note: "Q3" },
      { title: "Profit", value: "$246,913.57", note: "Q3" },
    ]
    const resized = land(agentDeck(), [{ node: ids.deck, prop: "size", value: { w: 1440, h: 1080 } }])
    const opened = build(resized, { op: "slide", add: {} }, minter("s"))
    const on = slidesOf(opened).at(-1)!.id
    const titled = build(
      opened,
      {
        op: "add",
        kind: "text",
        slide: on,
        text: "Profit holds at a quarter of revenue",
        textStyle: "title",
      } as AgentChange,
      minter("u"),
    )
    const doom = build(titled, { op: "add", kind: "kpi", slide: on, items: wide } as AgentChange, minter("k"))
    const row = lastChild(doom, on)
    const styles = numberStyles(doom, row.id)
    const theme = propOf(doom.nodes.get(ids.deck)!, "theme")!
    const box = propOf(row, "box")!
    const gap = gapFor(1440)
    const room = Math.floor((box.w - gap * (wide.length - 1)) / wide.length) - padFor(1440) * 2
    const values = wide.map((item) => item.value)
    const fitting = ladderOf(theme).find((style) => widestLine(values, theme, style) <= room)
    expect(new Set(styles)).toEqual(new Set([fitting]))
    expect(widestLine(values, theme, styles[0]!)).toBeLessThanOrEqual(room)
    expect(styles[0]).not.toBe("bigNumber")
  })

  it("keeps the explicit box's corner and width", () => {
    const boxed = build(agentDeck(), add({ kind: "kpi", box: { x: 40, y: 50, w: 1000, h: 400 }, items: kpiItems }))
    expect(propOf(made(boxed), "box")).toMatchObject({ x: 40, y: 50, w: 1000 })
  })

  it("says limit, naming the items, when no named size fits the area, or when there are too many", () => {
    expect(
      compileAgentChange(
        agentDeck(),
        add({ kind: "kpi", box: { x: 0, y: 0, w: 900, h: 60 }, items: kpiItems }),
        minter(),
      ),
    ).toEqual({ refused: "limit", field: "items", change: "add kpi" })
    expect(
      compileAgentChange(
        agentDeck(),
        add({ kind: "kpi", items: Array.from({ length: 7 }, () => kpiItems[0]) }),
        minter(),
      ),
    ).toMatchObject({ refused: "limit", field: "items" })
  })
})

describe("a pattern under a title", () => {
  const person = { kind: "person", id: "test" } as const
  const titled = () => {
    const grown = doomFromTree({ theme: defaultTheme, slides: [{ children: [] }] })
    const on = grown.slides[0]!
    const next = applyEdit(grown.doom, {
      once: "title",
      author: person,
      writes: titleOnlyWrites(on, minter("t"), { w: 1920, h: 1080 }),
      rev: rev(grown.doom.rev + 1),
    })
    if (isRefusal(next)) throw new Error(JSON.stringify(next))
    return { doom: started(next), on }
  }

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

  it.each(["timeline", "flow", "matrix"] as const)("fills the band down to the bottom margin for %s", (kind) => {
    const { doom: start, on } = titled()
    const items =
      kind === "matrix"
        ? [{ title: "Quick wins" }, { title: "Big bets" }, { title: "Fill-ins" }, { title: "Avoid" }]
        : kind === "timeline"
          ? [
              { value: "Q1", title: "Plan" },
              { value: "Q2", title: "Build" },
              { value: "Q3", title: "Launch" },
            ]
          : [{ title: "Sign up" }, { title: "Verify" }, { title: "Pay" }]
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

  it("fills a lone chart down to the bottom margin", () => {
    const { doom: start, on } = titled()
    const doom = build(
      start,
      {
        op: "add",
        slide: on,
        kind: "chart",
        chart: { kind: "bar", categories: ["Q1", "Q2"], series: [{ name: "Plan", values: [3, 4] }] },
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

describe("cards and compare", () => {
  it("puts an icon, a heading and bullet points in each card, filling the area's height", () => {
    const doom = build(
      agentDeck(),
      add({
        kind: "cards",
        box: { x: 0, y: 0, w: 1800, h: 500 },
        items: [{ title: "Grow", points: ["One", "Two"], icon: "star" }, { title: "Hold" }],
      }),
    )
    const root = made(doom)
    expect(propOf(root, "box")).toMatchObject({ h: 500 })
    const first = childrenOf(doom, childrenOf(doom, root.id)[0]!.id)
    expect(first.map((node) => propOf(node, "geometry")?.kind)).toEqual(["icon", "rect", "rect"])
    expect(propOf(first[0]!, "geometry")).toEqual({ kind: "icon", name: "lucide/star" })
    expect(propOf(first[2]!, "text")).toMatchObject({
      chars: "One\nTwo",
      style: "body",
      paras: [{ list: "bullet" }, { list: "bullet" }],
    })
  })

  it("fills the box it was given", () => {
    const items = [
      { title: "Grow", points: ["One"] },
      { title: "Hold", points: ["Two"] },
    ]
    const filling = propOf(
      made(build(agentDeck(), add({ kind: "cards", items, box: { x: 0, y: 0, w: 1000, h: 700 } }))),
      "box",
    )!
    expect(filling.h).toBe(700)
  })

  it("steps the bullets down from body to caption as the area shrinks, never lower, then refuses", () => {
    const points = Array.from({ length: 7 }, (_, at) => `A fairly long line of explanation number ${at}`)
    const seen: string[] = []
    for (let high = 900; high >= 150; high -= 10) {
      const result = compileAgentChange(
        agentDeck(),
        add({ kind: "cards", box: { x: 0, y: 0, w: 900, h: high }, items: [{ title: "Plan", points }] }),
        minter(),
      )
      if ("refused" in result) {
        expect(result).toEqual({ refused: "limit", field: "items", change: "add cards" })
        seen.push("refused")
        break
      }
      const doom = build(
        agentDeck(),
        add({ kind: "cards", box: { x: 0, y: 0, w: 900, h: high }, items: [{ title: "Plan", points }] }),
      )
      const body = styled(doom, made(doom).id).at(-1)!
      if (seen.at(-1) !== body) seen.push(body)
    }
    expect(seen).toEqual(["body", "body2", "caption", "refused"])
  })

  it("sets compare headings in the first accent and spaces its cards wider", () => {
    const doom = build(
      agentDeck(),
      add({
        kind: "compare",
        items: [
          { title: "Build", points: ["a"] },
          { title: "Buy", points: ["b"] },
        ],
      }),
    )
    const root = made(doom)
    const heading = childrenOf(doom, childrenOf(doom, root.id)[0]!.id)[0]!
    expect(propOf(heading, "text")!.spans).toEqual([{ end: 5, color: { var: "accent1" } }])
    const cards = cardsGap(doom)
    expect(cards).toBeGreaterThan(40)
    expect(
      compileAgentChange(agentDeck(), add({ kind: "compare", items: [{ title: "Only" }] }), minter()),
    ).toMatchObject({ refused: "shape", field: "items" })
  })
})

const cardsGap = (doom: Doom) => {
  const layout = propOf(made(doom), "layout")
  return layout?.mode === "row" ? layout.gap : 0
}

describe("matrix", () => {
  const doom = build(
    agentDeck(),
    add({
      kind: "matrix",
      axes: ["Effort", "Impact"],
      items: [{ title: "Quick wins" }, { title: "Big bets" }, { title: "Fill-ins" }, { title: "Avoid" }],
    }),
  )
  const root = made(doom)
  const parts = childrenOf(doom, root.id)

  it("is a two by two grid of cards with the top right one in the first accent", () => {
    const grid = parts[0]!
    expect(propOf(grid, "layout")).toMatchObject({
      mode: "grid",
      columns: [{ fr: 1 }, { fr: 1 }],
      rows: [{ fr: 1 }, { fr: 1 }],
    })
    const cells = childrenOf(doom, grid.id)
    expect(cells.map((cell) => propOf(cell, "cell"))).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ])
    expect(propOf(cells[1]!, "fills")).toEqual([{ kind: "solid", color: { var: "accent1" } }])
    expect(propOf(childrenOf(doom, cells[1]!.id)[0]!, "text")!.spans[0]).toMatchObject({ color: { var: "background" } })
  })

  it("labels the axes, the one up the side turned a quarter", () => {
    expect(parts).toHaveLength(3)
    expect(propOf(parts[1]!, "text")).toMatchObject({
      chars: "Effort",
      style: "label",
      resize: "fixed",
      alignV: "center",
    })
    expect(propOf(parts[2]!, "box")).toMatchObject({ rotation: 270 })
    expect(propOf(parts[2]!, "text")!.chars).toBe("Impact")
  })

  it("is the grid alone when it has no axes, and keeps empty cards for missing items", () => {
    const bare = build(agentDeck(), add({ kind: "matrix", items: [{ title: "Only" }] }))
    expect(propOf(made(bare), "layout")).toMatchObject({ mode: "grid" })
    expect(childrenOf(bare, made(bare).id)).toHaveLength(4)
  })
})

describe("timeline", () => {
  const doom = build(
    agentDeck(),
    add({
      kind: "timeline",
      items: [
        { value: "Q1", title: "Plan" },
        { value: "Q2", title: "Build" },
        { value: "Q3", title: "Launch" },
      ],
    }),
  )
  const root = made(doom)

  it("draws a line from the first marker to the last, down a column of steps, each led by a marker", () => {
    const [line, lane] = childrenOf(doom, root.id)
    expect(propOf(lane!, "layout")).toMatchObject({ mode: "column" })
    const markers = childrenOf(doom, lane!.id).map((step) => childrenOf(doom, step.id)[0]!)
    expect(markers.map((marker) => propOf(marker, "geometry")?.kind)).toEqual(["ellipse", "ellipse", "ellipse"])
    expect(propOf(line!, "geometry")).toMatchObject({
      kind: "line",
      start: { node: markers[0]!.id, site: "c" },
      end: { node: markers[2]!.id, site: "c" },
    })
    const words = childrenOf(doom, childrenOf(doom, childrenOf(doom, lane!.id)[0]!.id)[1]!.id)
    expect(words.map((node) => propOf(node, "text")?.style)).toEqual(["label", "heading"])
  })
})

describe("flow", () => {
  const doom = build(
    agentDeck(),
    add({ kind: "flow", items: [{ title: "Sign up" }, { title: "Verify" }, { title: "Pay" }] }),
  )
  const root = made(doom)

  it("joins each step to the next by an arrow from its bottom to the next one's top", () => {
    const [lane, ...arrows] = childrenOf(doom, root.id)
    expect(propOf(lane!, "layout")).toMatchObject({ mode: "column" })
    const steps = childrenOf(doom, lane!.id)
    expect(steps).toHaveLength(3)
    expect(arrows).toHaveLength(2)
    expect(propOf(arrows[0]!, "geometry")).toMatchObject({
      kind: "line",
      start: { node: steps[0]!.id, site: "b" },
      end: { node: steps[1]!.id, site: "t" },
      arrows: ["none", "arrow"],
    })
    expect(propOf(arrows[1]!, "geometry")).toMatchObject({ start: { node: steps[1]!.id }, end: { node: steps[2]!.id } })
  })
})

describe("a grid of words", () => {
  const rows = [
    ["", "Q1", "Q2", "Q3"],
    ["Product", "Beta", "Launch", "Scale"],
    ["Sales", "Pilot", "Roll out", "Expand"],
  ]
  const doom = build(agentDeck(), add({ kind: "frame", rows, name: "Roadmap" }))
  const root = made(doom)

  it("is a grid frame with a cell of text for each word, the first row a header", () => {
    expect(propOf(root, "name")).toBe("Roadmap")
    expect(propOf(root, "layout")).toMatchObject({
      mode: "grid",
      columns: [{ fr: 1 }, { fr: 1 }, { fr: 1 }, { fr: 1 }],
      rows: ["hug", "hug", "hug"],
      gap: gapFor(1920),
    })
    const cells = childrenOf(doom, root.id)
    expect(propOf(cells[0]!, "cell")).toEqual({ row: 0, col: 1 })
    expect(propOf(cells[0]!, "text")).toMatchObject({ chars: "Q1", style: "body" })
    expect(propOf(cells[4]!, "text")).toMatchObject({ chars: "Beta", style: "body" })
    expect(propOf(cells[10]!, "cell")).toEqual({ row: 2, col: 3 })
  })

  it("leaves an empty word out, so the grid keeps a hole instead of an empty text", () => {
    const cells = childrenOf(doom, root.id)
    expect(cells.map((cell) => propOf(cell, "cell"))).not.toContainEqual({ row: 0, col: 0 })
    expect(cells).toHaveLength(11)
  })

  it("takes markdown in a cell and pads a short row by leaving the cell out", () => {
    const ragged = build(agentDeck(), add({ kind: "frame", rows: [["a", "b"], ["**c**"]] }))
    const cells = childrenOf(ragged, made(ragged).id)
    expect(cells).toHaveLength(3)
    expect(propOf(cells[2]!, "text")!.spans[0]).toMatchObject({ bold: true })
  })

  it("steps down to fit, refuses when it cannot, and refuses a layout beside the rows", () => {
    const long = Array.from({ length: 12 }, (_, at) => [
      `Row ${at}`,
      "words that run to a few lines of text in a narrow column of the grid",
    ])
    expect(
      compileAgentChange(
        agentDeck(),
        add({ kind: "frame", box: { x: 0, y: 0, w: 500, h: 200 }, rows: long }),
        minter(),
      ),
    ).toMatchObject({ refused: "limit", field: "items" })
    expect(compileAgentChange(agentDeck(), add({ kind: "frame", rows, layout: "row" }), minter())).toMatchObject({
      refused: "shape",
      field: "layout",
    })
    expect(compileAgentChange(agentDeck(), add({ kind: "frame", rows: [] }), minter())).toMatchObject({
      refused: "shape",
      field: "rows",
    })
    expect(compileAgentChange(agentDeck(), add({ kind: "frame", rows: [[]] }), minter())).toMatchObject({
      refused: "shape",
      field: "rows",
    })
  })
})
