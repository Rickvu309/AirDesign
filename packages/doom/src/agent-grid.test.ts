import { describe, expect, it } from "vitest"
import type { AgentChange } from "./agent-change.js"
import { bottomLimitOf, gapFor } from "./agent-place.js"
import { agentDeck, build, lastChild, minter } from "./agent-fixtures.js"
import { defaultTheme } from "./theme.js"
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
    new Set(childrenOf(doom, root).flatMap((cell) => propOf(cell, "text")?.style ?? []))
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
    return childrenOf(doom, root.id).flatMap((cell) =>
      propOf(cell, "text") === undefined
        ? []
        : [
            {
              cell: propOf(cell, "cell")!,
              label: propOf(cell, "text")!.chars,
              bold: boldOf(doom, cell.id),
            },
          ],
    )
  }

  it.each([4, 11])("sets headers and row labels semibold and every value regular, in a %i row grid", (count) => {
    for (const { cell, label, bold } of weights(count))
      expect(bold, `${label} at ${cell.row},${cell.col}`).toBe(cell.row === 0 || cell.col === 0)
  })

  it("keeps rows at the height of their words, from the top of the band", () => {
    const { doom, root, box } = gridOf(4)
    const kpi = build(agentDeck(), add({ kind: "kpi", items: kpiItems }))
    expect(box.y).toBe(propOf(made(kpi), "box")!.y)
    expect(propOf(root, "layout")).toMatchObject({ rows: ["hug", "hug", "hug", "hug"], gap: 0 })
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
    const cells = childrenOf(doom, made(doom).id).flatMap((cell) => propOf(cell, "text") ?? [])
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
    const column = (width - layout.gap * (layout.columns.length - 1)) / layout.columns.length
    return childrenOf(doom, root)
      .flatMap((cell) => propOf(cell, "text") ?? [])
      .filter(
        (text) =>
          widestWord(
            [text.chars],
            defaultTheme,
            text.style,
            text.spans.some((span) => span.bold),
          ) >
          column - (text.padding?.l ?? 0) - (text.padding?.r ?? 0),
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

describe("a grid of words is set as a consulting table", () => {
  const segments = [
    ["", "Q3 FY25", "Q3 FY26", "Note"],
    ["Enterprise", "15.2", "$18.6M", "Grew"],
    ["Mid-market", "(13.1)", "−14.9", "Flat"],
    ["SMB", "7.9", "n/a", "Fell"],
    ["Total", "37.6", "43.4", ""],
  ]
  const tableOf = (rows: readonly (readonly string[])[]) => {
    const doom = build(agentDeck(), add({ kind: "frame", rows }))
    const root = made(doom)
    const children = childrenOf(doom, root.id)
    const words = new Map(
      children.flatMap((cell) => {
        const { row, col } = propOf(cell, "cell")!
        return propOf(cell, "text") === undefined ? [] : [[`${String(row)},${String(col)}`, cell] as const]
      }),
    )
    const at = (row: number, col: number) => words.get(`${String(row)},${String(col)}`)
    const rules = children.filter((node) => propOf(node, "text") === undefined)
    const ruleAt = (row: number) => {
      const rule = rules.find((node) => propOf(node, "cell")!.row === row)
      if (rule === undefined) return undefined
      const paint = propOf(rule, "strokes")?.[0]
      return {
        cell: propOf(rule, "cell"),
        sides: propOf(rule, "stroke")?.sides,
        color: paint?.kind === "solid" ? paint.color : undefined,
      }
    }
    return { doom, root, children, words, at, rules, ruleAt }
  }

  it("rules the header in dark ink and each row in a thin light line across the whole grid", () => {
    const { ruleAt, rules, root } = tableOf(segments.slice(0, 4))
    expect(propOf(root, "layout")).toMatchObject({ gap: 0 })
    expect(ruleAt(0)).toEqual({ cell: { row: 0, col: 0, colSpan: 4 }, sides: { b: 2 }, color: { var: "text" } })
    for (const row of [1, 2])
      expect(ruleAt(row), `row ${String(row)}`).toEqual({
        cell: { row, col: 0, colSpan: 4 },
        sides: { b: 1 },
        color: { var: "text", tint: 0.8 },
      })
    expect(ruleAt(3)).toBeUndefined()
    expect(rules).toHaveLength(3)
  })

  it("keeps the cells free of fills and outlines, each filling its column", () => {
    const { words } = tableOf(segments)
    for (const cell of words.values()) {
      expect(propOf(cell, "fills") ?? []).toEqual([])
      expect(propOf(cell, "strokes") ?? []).toEqual([])
      expect(propOf(cell, "sizing")).toEqual({ w: "fill", h: "fill" })
    }
  })

  it("paints each rule under the words of its row", () => {
    const { children } = tableOf(segments.slice(0, 4))
    const firstText = children.findIndex((node) => propOf(node, "text") !== undefined)
    expect(propOf(children[0]!, "text")).toBeUndefined()
    expect(firstText).toBe(1)
  })

  it("keeps each row's words one theme gap from the next, the rules halfway between", () => {
    const { at } = tableOf(segments.slice(0, 4))
    const gap = gapFor(1920)
    const padding = (row: number, col: number) => propOf(at(row, col), "text")!.padding
    expect(padding(0, 1)).toEqual({ t: 0, r: Math.floor(gap / 2), b: gap - Math.floor(gap / 2), l: Math.ceil(gap / 2) })
    expect(padding(1, 0)).toMatchObject({ t: Math.floor(gap / 2), b: gap - Math.floor(gap / 2), l: 0 })
    expect(padding(3, 3)).toMatchObject({ b: 0, r: 0 })
  })

  it("right-aligns a column of numbers, its header included, in tabular figures", () => {
    const { at } = tableOf(segments)
    const text = (row: number, col: number) => propOf(at(row, col), "text")!
    for (const col of [1, 2])
      for (const row of [0, 1, 2, 3, 4])
        expect(text(row, col).paras[0]!.align, `${String(row)},${String(col)}`).toBe("right")
    for (const row of [1, 2, 4]) expect(text(row, 1).spans.every((span) => span.figures === "tabular")).toBe(true)
    for (const row of [1, 2, 3, 4]) expect(text(row, 0).paras[0]!.align ?? "left").toBe("left")
    for (const row of [0, 1, 2, 3]) expect(text(row, 3).paras[0]!.align ?? "left").toBe("left")
    expect(text(1, 3).spans.some((span) => span.figures !== undefined)).toBe(false)
  })

  it("reads a number through its markdown and its unit when it aligns a column", () => {
    const { at } = tableOf([
      ["KPI", "Q3 FY26", "vs target"],
      ["ARR ($M)", "**158.4**", "−1.0%"],
      ["CAC payback", "**24**", "+4 mo"],
    ])
    for (const col of [1, 2])
      for (const row of [0, 1, 2])
        expect(propOf(at(row, col), "text")!.paras[0]!.align, `${String(row)},${String(col)}`).toBe("right")
    expect(propOf(at(1, 1), "text")!.spans.every((span) => span.figures === "tabular" && span.bold === true)).toBe(true)
  })

  it("sets a last Total row bold under a dark rule, with no light rule above it", () => {
    const { at, ruleAt } = tableOf(segments)
    const bold = (row: number, col: number) => propOf(at(row, col), "text")!.spans.every((span) => span.bold === true)
    for (const col of [0, 1, 2]) expect(bold(4, col), `total ${String(col)}`).toBe(true)
    expect(ruleAt(4)).toEqual({ cell: { row: 4, col: 0, colSpan: 4 }, sides: { t: 2 }, color: { var: "text" } })
    expect(ruleAt(3)).toBeUndefined()
    expect(bold(1, 1)).toBe(false)
  })

  it("reads a Total label through its markdown", () => {
    const { at, ruleAt } = tableOf([...segments.slice(0, 4), ["**Total**", "37.6", "43.4", ""]])
    expect(propOf(at(4, 1), "text")!.spans.every((span) => span.bold === true)).toBe(true)
    expect(ruleAt(4)).toMatchObject({ sides: { t: 2 } })
  })

  describe("an agent's edit of a cell's words", () => {
    const edited = (row: number, col: number, change: Record<string, unknown>) => {
      const { doom, at } = tableOf(segments)
      const target = at(row, col)!.id
      return propOf(build(doom, { op: "set", target, ...change } as AgentChange).nodes.get(target), "text")!
    }
    const look = (text: ReturnType<typeof edited>) => ({
      bold: text.spans.every((span) => span.bold === true),
      tabular: text.spans.every((span) => span.figures === "tabular"),
      align: text.paras.map((para) => para.align),
    })

    it("keeps a Total's weight, tabular figures and right alignment", () => {
      expect(look(edited(4, 2, { text: "43.1" }))).toEqual({ bold: true, tabular: true, align: ["right"] })
      expect(look(edited(4, 0, { text: "Total revenue" }))).toMatchObject({ bold: true })
    })

    it("keeps a body number's tabular figures and right alignment in the body's weight", () => {
      expect(look(edited(1, 1, { text: "15.3" }))).toEqual({ bold: false, tabular: true, align: ["right"] })
      expect(look(edited(1, 1, { text: "15.3", textStyle: "caption" }))).toMatchObject({ tabular: true })
    })

    it("takes the weight the agent sets over the cell's own", () => {
      expect(look(edited(4, 2, { text: "43.1", weight: "regular" }))).toMatchObject({ bold: false, tabular: true })
      expect(look(edited(1, 1, { text: "**15.3**" }))).toMatchObject({ bold: true, tabular: true })
    })
  })

  it("leaves a last row that is not a total in the body's weight", () => {
    const { at } = tableOf(segments.slice(0, 4))
    expect(propOf(at(3, 1), "text")!.spans.every((span) => span.bold === true)).toBe(false)
  })
})
