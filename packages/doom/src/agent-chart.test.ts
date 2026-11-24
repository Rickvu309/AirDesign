import { describe, expect, it } from "vitest"
import { readAgentChange, type AgentChange } from "./agent-change.js"
import { compileAgentChange } from "./agent-compile.js"
import { build, minter } from "./agent-fixtures.js"
import { more, richDeck } from "./testing/rich-deck.js"
import { type Doom, defaultTheme, deriveChart, measureWith } from "./index.js"
import { box } from "./sample-deck.js"
import { propOf } from "./doom-walk.js"
import { swatches } from "./testing/doom-fixtures-art.js"

const set = (target: string, look: Record<string, unknown>): AgentChange =>
  ({ op: "set", target, ...look }) as AgentChange
const refusal = (doom = richDeck(), change: AgentChange) => compileAgentChange(doom, change, minter())

describe("a chart's point colours, set by an agent", () => {
  const pointsOf = (doom: Doom) =>
    propOf(doom.nodes.get(more.chart)!, "chart")?.series.map((series) => series.points ?? [])

  it("colours one bar by its series and category names, at its places, and clears it with none", () => {
    let doom = build(richDeck(), set(`${more.chart}#Actual:Q2`, { fill: "accent3" }))
    expect(pointsOf(doom)).toEqual([[], [{ at: 1, color: { var: "accent3" } }]])
    doom = build(doom, set(`${more.chart}#Actual:Q2`, { fill: "none" }))
    expect(pointsOf(doom)).toEqual([[], []])
  })

  it("colours South Coast without South-Coast, and a bar whose category is 200 characters long", () => {
    const long = "x".repeat(200)
    const charted = build(
      richDeck(),
      set(more.chart, {
        chart: {
          kind: "pie",
          categories: ["South Coast", "South-Coast", long],
          series: [{ name: "Net revenue", values: [3, 4, 5] }],
        },
      }),
    )
    const doom = build(
      build(charted, set(`${more.chart}#Net revenue:South Coast`, { fill: "accent3" })),
      set(`${more.chart}#Net revenue:${long}`, { fill: swatches.custom }),
    )
    expect(pointsOf(doom)).toEqual([
      [
        { at: 0, color: { var: "accent3" } },
        { at: 2, color: swatches.custom },
      ],
    ])
    const painted = deriveChart(
      more.chart,
      propOf(doom.nodes.get(more.chart)!, "chart")!,
      box(0, 0, 800, 400),
      defaultTheme,
      measureWith({}),
    )
    const fill = (id: string) => painted.find((part) => part.id === id)?.fills[0]
    expect(fill(`${more.chart}#0:0`)).toMatchObject({ color: defaultTheme.colors.accent3 })
    expect(fill(`${more.chart}#0:1`)).toMatchObject({ color: defaultTheme.colors.accent2 })
    expect(fill(`${more.chart}#0:2`)).toMatchObject({ color: swatches.custom })
  })

  it("refuses names that two bars share, and colours either by its place in the chart's points", () => {
    const twice = build(
      richDeck(),
      set(more.chart, {
        chart: { kind: "column", categories: ["Q1", "Q1"], series: [{ name: "Plan", values: [1, 2] }] },
      }),
    )
    expect(refusal(twice, set(`${more.chart}#Plan:Q1`, { fill: "accent3" }))).toMatchObject({
      refused: "shape",
      field: "target",
    })
    const placed = build(
      twice,
      set(more.chart, {
        chart: {
          kind: "column",
          categories: ["Q1", "Q1"],
          series: [{ name: "Plan", values: [1, 2], points: [{ at: 1, color: "accent3" }] }],
        },
      }),
    )
    expect(pointsOf(placed)).toEqual([[{ at: 1, color: { var: "accent3" } }]])
  })

  it("refuses a series colour on a pie, which colours each slice, and keeps the slice colours it is given", () => {
    const pie = (series: Record<string, unknown>) =>
      set(more.chart, {
        chart: { kind: "pie", categories: ["A", "B"], series: [{ name: "Share", values: [1, 2], ...series }] },
      })
    expect(readAgentChange(pie({ color: "accent3" }))).toMatchObject({
      refused: "shape",
      field: "chart.color",
      form: expect.stringContaining("slice"),
    })
    const sliced = build(richDeck(), readAgentChange(pie({ points: [{ at: 1, color: "accent3" }] })) as AgentChange)
    expect(pointsOf(sliced)).toEqual([[{ at: 1, color: { var: "accent3" } }]])
    expect(propOf(sliced.nodes.get(more.chart)!, "chart")?.series[0]?.color).toBeUndefined()
  })

  it("colours a bar by name when its series and category names are each 200 characters long", () => {
    const series = "s".repeat(200)
    const category = "c".repeat(200)
    const charted = build(
      richDeck(),
      set(more.chart, { chart: { kind: "column", categories: [category], series: [{ name: series, values: [1] }] } }),
    )
    const read = readAgentChange(set(`${more.chart}#${series}:${category}`, { fill: "accent3" }))
    expect(read).not.toHaveProperty("refused")
    const painted = build(charted, read as AgentChange)
    expect(pointsOf(painted)).toEqual([[{ at: 0, color: { var: "accent3" } }]])
  })

  it("keeps every point colour when an agent changes a series colour, as the chart data the agent read", () => {
    const pointed = build(richDeck(), set(`${more.chart}#Plan:Q2`, { fill: "accent3" }))
    const recoloured = build(
      pointed,
      set(more.chart, {
        chart: {
          kind: "bar",
          categories: ["Q1", "Q2"],
          series: [
            { name: "Plan", values: [3, 4], color: "accent5" },
            { name: "Actual", values: [2, 5] },
          ],
        },
      }),
    )
    expect(propOf(recoloured.nodes.get(more.chart)!, "chart")?.series[0]).toEqual({
      name: "Plan",
      values: [3, 4],
      color: { var: "accent5" },
      points: [{ at: 1, color: { var: "accent3" } }],
    })
    const shorter = build(
      recoloured,
      set(more.chart, { chart: { kind: "bar", categories: ["Q1"], series: [{ name: "Plan", values: [3] }] } }),
    )
    expect(pointsOf(shorter)).toEqual([[]])
    const cleared = build(
      recoloured,
      set(more.chart, {
        chart: {
          kind: "bar",
          categories: ["Q1", "Q2"],
          series: [
            { name: "Plan", values: [3, 4], points: [] },
            { name: "Actual", values: [2, 5] },
          ],
        },
      }),
    )
    expect(pointsOf(cleared)).toEqual([[], []])
  })
})
