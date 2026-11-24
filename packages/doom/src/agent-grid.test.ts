import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { bottomLimitOf, gapFor } from "./agent-place.js"
import { agentDeck, build, lastChild, minter } from "./agent-fixtures.js"
import { defaultTheme } from "./default-theme-art.js"
import { childrenOf, propOf, slidesOf } from "./doom-walk.js"
import { ladderOf } from "./pattern-parts.js"
import { type Doom, type NodeId } from "./index.js"
import { widestWord } from "./text-estimate.js"
import { ids, land } from "./sample-deck.js"

const slide = ids.slide
const add = (value: Record<string, unknown>) => ({ op: "add", slide, ...value }) as AgentChange
const made = (doom: Doom) => lastChild(doom, slide)
const kpiItems = [
  { title: "Revenue", value: "$4.2M", note: "+12% YoY" },
  { title: "Margin", value: "31%", note: "+2 pts" },
  { title: "Cash", value: "$9.1M" },
]

describe("a grid of words fills the band with its text size", () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, at) => (at === 0 ? ["", "Q1", "Q2", "Q3"] : [`Line ${at}`, "3.0", "3.4", "3.8"]))
  const gridOf = (count: number) => {
    const doom = build(agentDeck(), add({ kind: "frame", rows: rows(count) }))
    return { doom, root: made(doom), box: propOf(made(doom), "box")! }
  }
  const styleOf = (doom: Doom, root: NodeId) =>
    new Set(childrenOf(doom, root).map((cell) => propOf(cell, "text")!.style))
  const sizeOfStyle = (name: string) => ladderOf(defaultTheme).indexOf(name as never)

  it("sets header and body in one style, the largest the heading allows when the rows are few", () => {
    const { doom, root } = gridOf(4)
    expect([...styleOf(doom, root.id)]).toEqual(["heading"])
  })

  it("steps down to the one style that keeps every row above the bottom margin", () => {
    const small = gridOf(4)
    const tall = gridOf(11)
    const tallStyles = [...styleOf(tall.doom, tall.root.id)]
    expect(tallStyles).toHaveLength(1)
    expect(sizeOfStyle(tallStyles[0]!)).toBeGreaterThan(sizeOfStyle("heading"))
    expect(tall.box.y + tall.box.h).toBeLessThanOrEqual(bottomLimitOf(1080))
    expect(small.box.y + small.box.h).toBeLessThan(bottomLimitOf(1080))
  })

  const boldOf = (doom: Doom, cell: NodeId) => {
    const text = propOf(doom.nodes.get(cell)!, "text")!
    const style = defaultTheme.textStyles[text.style]
    return text.spans.length === 0 ? style.weight >= 600 : text.spans.every((span) => span.bold ?? style.weight >= 600)
  }
  const weights = (count: number) => {
    const { doom, root } = gridOf(count)
    return childrenOf(doom, root.id).map((cell) => ({
      cell: propOf(cell, "cell")!,
      label: propOf(cell, "text")!.chars,
      bold: boldOf(doom, cell.id),
    }))
  }

  it.each([4, 11])("sets headers and row labels semibold and every value regular, in a %i row grid", (count) => {
    for (const { cell, label, bold } of weights(count))
      expect(bold, `${label} at ${cell.row},${cell.col}`).toBe(cell.row === 0 || cell.col === 0)
  })

  it("keeps rows at the height of their words, the theme gap between them, from the top of the band", () => {
    const { doom, root, box } = gridOf(4)
    const kpi = build(agentDeck(), add({ kind: "kpi", items: kpiItems }))
    expect(box.y).toBe(propOf(made(kpi), "box")!.y)
    expect(propOf(root, "layout")).toMatchObject({ rows: ["hug", "hug", "hug", "hug"], gap: gapFor(1920) })
    expect(childrenOf(doom, root.id).length).toBeGreaterThan(0)
  })
})

describe("a grid sets its values in the body face and keeps every word whole", () => {
  const namedWeight = { ...defaultTheme, fonts: { heading: "Inter SemiBold", body: "Inter" } }

  it("paints every cell in the body font when the heading font is a single named weight", () => {
    const themed = land(agentDeck(), [{ node: ids.deck, prop: "theme", value: namedWeight }])
    const rows = [
      ["", "Q1", "Q2"],
      ["Revenue", "3.0", "3.4"],
    ]
    const doom = build(themed, add({ kind: "frame", rows }))
    const cells = childrenOf(doom, made(doom).id).map((cell) => propOf(cell, "text")!)
    expect(cells.length).toBeGreaterThan(0)
    for (const text of cells)
      expect(
        text.spans.every((span) => span.font === namedWeight.fonts.body),
        text.chars,
      ).toBe(true)
  })

  const longWords = [
    ["", "Implementation", "Transformation", "Commercialisation"],
    ["North America", "Reconciliation", "Standardisation", "Consolidation"],
  ]
  const narrow = () => {
    const resized = land(agentDeck(), [{ node: ids.deck, prop: "size", value: { w: 1440, h: 1080 } }])
    return build(resized, { op: "slide", add: {} }, minter("s"))
  }
  const splitCells = (doom: Doom, root: NodeId) => {
    const layout = propOf(doom.nodes.get(root)!, "layout")!
    const width = propOf(doom.nodes.get(root)!, "box")!.w
    if (layout.mode !== "grid") throw new Error("grid")
    const room = (width - layout.gap * (layout.columns.length - 1)) / layout.columns.length
    return childrenOf(doom, root)
      .map((cell) => propOf(cell, "text")!)
      .filter(
        (text) =>
          widestWord(
            [text.chars],
            defaultTheme,
            text.style,
            text.spans.some((span) => span.bold),
          ) > room,
      )
      .map((text) => text.chars)
  }

  it("steps a four-column 4:3 grid down until its widest word fits a column", () => {
    const deck = narrow()
    const on = slidesOf(deck).at(-1)!.id
    const doom = build(deck, { op: "add", slide: on, kind: "frame", rows: longWords } as AgentChange)
    expect(splitCells(doom, lastChild(doom, on).id)).toEqual([])
  })

  it("refuses a grid whose widest word fits no step", () => {
    const rows = [
      ["", "Pneumonoultramicroscopicsilicovolcanoconiosis", "B", "C", "D"],
      ["A", "1", "2", "3", "4"],
    ]
    expect(() => build(agentDeck(), add({ kind: "frame", rows }))).toThrow(
      /shorter labels, fewer columns or fewer rows/,
    )
  })
})
