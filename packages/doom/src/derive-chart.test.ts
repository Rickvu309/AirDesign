import { describe, expect, it } from "vitest"
import { type Chart, type Resolved, deriveChart, nodeId } from "./index.js"
import { defaultTheme } from "./default-theme-art.js"
import { measure, plainTheme, spot, swatches } from "./testing/doom-fixtures-art.js"

const frame = nodeId("t:9")
const area = spot(0, 0, 800, 400)
const column: Chart = {
  kind: "column",
  categories: ["Q1", "Q2", "Q3"],
  series: [
    { name: "Revenue", values: [10, 20, 30] },
    { name: "Cost", values: [5, 8, 12] },
  ],
}
const derive = (chart: Chart, box = area) => deriveChart(frame, chart, box, plainTheme, measure)
const byId = (parts: readonly Resolved[], id: string) => {
  const found = parts.find((part) => part.id === id)
  if (found === undefined) throw new Error(`no ${id} in ${parts.map((part) => part.id).join(", ")}`)
  return found
}
const wordsOf = (parts: readonly Resolved[]) =>
  parts.flatMap((part) =>
    part.text === null ? [] : [part.text.lines.map((line) => line.runs.map((run) => run.text).join("")).join("\n")],
  )
const numbersIn = (value: unknown): number[] =>
  typeof value === "number"
    ? [value]
    : typeof value === "object" && value !== null
      ? Object.values(value).flatMap(numbersIn)
      : []
const fillOf = (part: Resolved) => (part.fills[0]?.kind === "solid" ? part.fills[0].color : null)

describe("deriveChart", () => {
  it("names every bar by its frame and its series and category places, the same on every derivation", () => {
    const first = derive(column)
    expect(byId(first, "t:9#0:0").derived).toBe(true)
    expect(byId(first, "t:9#1:2")).toBeDefined()
    expect(derive(column).map((part) => part.id)).toEqual(first.map((part) => part.id))
    expect(new Set(first.map((part) => part.id)).size).toBe(first.length)
  })

  it("gives categories whose names differ only by a space or a dash their own marks and their own colours", () => {
    const coasts: Chart = {
      kind: "column",
      categories: ["South Coast", "South-Coast"],
      series: [{ name: "Net revenue", values: [1, 2], points: [{ at: 0, color: { var: "accent5" } }] }],
    }
    const parts = derive({ ...coasts, labels: true })
    expect(new Set(parts.map((part) => part.id)).size).toBe(parts.length)
    expect(fillOf(byId(parts, "t:9#0:0"))).toBe(plainTheme.colors.accent5)
    expect(fillOf(byId(parts, "t:9#0:1"))).toBe(plainTheme.colors.accent1)
    const pie = derive({ ...coasts, kind: "pie", labels: true })
    expect(new Set(pie.map((part) => part.id)).size).toBe(pie.length)
    expect([fillOf(byId(pie, "t:9#0:0")), fillOf(byId(pie, "t:9#0:1"))]).toEqual([
      plainTheme.colors.accent5,
      plainTheme.colors.accent2,
    ])
  })

  it("starts the value axis of columns at zero, so a bar's height is its value", () => {
    const parts = derive(column)
    const q1 = byId(parts, "t:9#0:0").box
    const q3 = byId(parts, "t:9#0:2").box
    expect(q3.h / q1.h).toBeCloseTo(3)
    expect(q1.y + q1.h).toBeCloseTo(q3.y + q3.h)
    expect(wordsOf(parts)).toContain("0")
    const small = derive({ ...column, series: [{ name: "Revenue", values: [100, 101, 102] }] })
    const first = byId(small, "t:9#0:0").box
    const last = byId(small, "t:9#0:2").box
    expect(last.h / first.h).toBeCloseTo(102 / 100)
  })

  it("starts the value axis of horizontal bars at zero too", () => {
    const parts = derive({ ...column, kind: "bar", series: [{ name: "Revenue", values: [10, 20, 30] }] })
    const q1 = byId(parts, "t:9#0:0").box
    const q3 = byId(parts, "t:9#0:2").box
    expect(q3.w / q1.w).toBeCloseTo(3)
    expect(q1.x).toBeCloseTo(q3.x)
    expect(q3.y).toBeGreaterThan(q1.y)
  })

  it("grows a negative bar down from the same baseline and extends the axis below it", () => {
    const parts = derive({ ...column, series: [{ name: "Net", values: [20, -10, 30] }] })
    const up = byId(parts, "t:9#0:0").box
    const down = byId(parts, "t:9#0:1").box
    expect(down.y).toBeCloseTo(up.y + up.h)
    expect(down.h).toBeCloseTo(up.h / 2)
    expect(wordsOf(parts).some((word) => word.startsWith("-"))).toBe(true)
  })

  it("colours the series from the theme in order, a series' own colour first, and a point's colour before both", () => {
    const parts = derive(column)
    expect(fillOf(byId(parts, "t:9#0:0"))).toBe(plainTheme.colors.accent1)
    expect(fillOf(byId(parts, "t:9#1:0"))).toBe(plainTheme.colors.accent2)
    const own = derive({ ...column, series: [{ ...column.series[0]!, color: swatches.custom }, column.series[1]!] })
    expect(fillOf(byId(own, "t:9#0:1"))).toBe(swatches.custom)
    const point = derive({
      ...column,
      series: [{ ...column.series[0]!, points: [{ at: 1, color: { var: "accent5" } }] }, column.series[1]!],
    })
    expect(fillOf(byId(point, "t:9#0:1"))).toBe(plainTheme.colors.accent5)
    expect(fillOf(byId(point, "t:9#0:0"))).toBe(plainTheme.colors.accent1)
  })

  it("gives a series with no colour the next accent that no other series holds", () => {
    const named = (color: string) =>
      derive({ ...column, series: [{ ...column.series[0]!, color: { var: color } as never }, column.series[1]!] })
    const taken = named("accent2")
    expect(fillOf(byId(taken, "t:9#0:0"))).toBe(plainTheme.colors.accent2)
    expect(fillOf(byId(taken, "t:9#1:0"))).toBe(plainTheme.colors.accent1)
    const first = named("accent1")
    expect(fillOf(byId(first, "t:9#1:0"))).toBe(plainTheme.colors.accent2)
    const hexed = derive({
      ...column,
      series: [{ ...column.series[0]!, color: plainTheme.colors.accent1 }, column.series[1]!],
    })
    expect(fillOf(byId(hexed, "t:9#1:0"))).toBe(plainTheme.colors.accent2)
    const three = derive({
      ...column,
      series: [
        { ...column.series[0]!, color: { var: "accent2" } },
        column.series[1]!,
        { name: "Tax", values: [1, 2, 3] },
      ],
    })
    expect(fillOf(byId(three, "t:9#1:0"))).toBe(plainTheme.colors.accent1)
    expect(fillOf(byId(three, "t:9#2:0"))).toBe(plainTheme.colors.accent3)
    const legend = three.filter((part) => part.id.includes("~legend") && part.fills[0]?.kind === "solid")
    expect(new Set(legend.map(fillOf)).size).toBe(legend.length)
  })

  it("draws axis labels, gridlines and a legend from the theme, and a legend only for more than one series", () => {
    const parts = derive(column)
    const words = wordsOf(parts)
    for (const expected of ["Q1", "Q2", "Q3", "Revenue", "Cost", "0"]) expect(words).toContain(expected)
    expect(parts.filter((part) => part.geometry?.kind === "line").length).toBeGreaterThanOrEqual(4)
    expect(wordsOf(derive({ ...column, series: [column.series[0]!] }))).not.toContain("Revenue")
  })

  it("labels each bar with its value only when asked", () => {
    const odd: Chart = { ...column, series: [{ name: "Revenue", values: [12, 23, 37] }] }
    expect(wordsOf(derive(odd))).not.toContain("37")
    expect(wordsOf(derive({ ...odd, labels: true })).filter((word) => word === "37")).toHaveLength(1)
  })

  it("keeps everything it derives inside the box it was given", () => {
    for (const chart of [
      column,
      { ...column, kind: "bar" as const },
      { ...column, kind: "line" as const },
      { ...column, kind: "stacked" as const },
      { ...column, kind: "pie" as const, series: [column.series[0]!] },
    ]) {
      for (const part of derive({ ...chart, labels: true })) {
        expect(part.box.x).toBeGreaterThanOrEqual(-0.5)
        expect(part.box.y).toBeGreaterThanOrEqual(-0.5)
        expect(part.box.x + part.box.w).toBeLessThanOrEqual(800.5)
        expect(part.box.y + part.box.h).toBeLessThanOrEqual(400.5)
      }
    }
  })

  it("stacks each category's series on top of one another", () => {
    const parts = derive({ ...column, kind: "stacked" })
    const lower = byId(parts, "t:9#0:1").box
    const upper = byId(parts, "t:9#1:1").box
    expect(upper.y + upper.h).toBeCloseTo(lower.y)
    expect(lower.h / upper.h).toBeCloseTo(20 / 8)
    expect(lower.x).toBeCloseTo(upper.x)
  })

  it("draws a line chart as one path per series with a marker on each point", () => {
    const parts = derive({ ...column, kind: "line" })
    expect(byId(parts, "t:9#0").geometry).toMatchObject({ kind: "path" })
    expect(byId(parts, "t:9#0").fills).toEqual([])
    const low = byId(parts, "t:9#0:0").box
    const high = byId(parts, "t:9#0:2").box
    expect(high.x).toBeGreaterThan(low.x)
    expect(high.y).toBeLessThan(low.y)
    expect(low.w).toBe(low.h)
  })

  it("draws a pie as one slice per category, each as big as its share, and names the categories", () => {
    const pie: Chart = { kind: "pie", categories: ["A", "B", "C"], series: [{ name: "Share", values: [50, 30, 20] }] }
    const parts = derive(pie)
    const slices = [0, 1, 2].map((at) => byId(parts, `t:9#0:${String(at)}`))
    expect(slices.map(fillOf)).toEqual([
      plainTheme.colors.accent1,
      plainTheme.colors.accent2,
      plainTheme.colors.accent3,
    ])
    expect(wordsOf(parts)).toEqual(expect.arrayContaining(["A", "B", "C"]))
    expect(slices.every((slice) => slice.geometry?.kind === "path")).toBe(true)
    const whole = derive({ ...pie, categories: ["A"], series: [{ name: "Share", values: [5] }] })
    expect(byId(whole, "t:9#0:0").geometry).toMatchObject({ kind: "ellipse" })
  })

  it("paints a pie slice its own point colour first, else the accent of its category", () => {
    const pie: Chart = {
      kind: "pie",
      categories: ["A", "B", "C"],
      series: [
        {
          name: "Share",
          values: [50, 30, 20],
          color: { var: "accent5" },
          points: [{ at: 2, color: { var: "accent4" } }],
        },
      ],
    }
    const parts = derive(pie)
    expect([0, 1, 2].map((at) => fillOf(byId(parts, `t:9#0:${String(at)}`)))).toEqual([
      plainTheme.colors.accent1,
      plainTheme.colors.accent2,
      plainTheme.colors.accent4,
    ])
  })

  it("does not fail on no data: no NaN anywhere", () => {
    for (const chart of [
      { ...column, series: [{ name: "Revenue", values: [0, 0, 0] }] },
      { ...column, categories: [], series: [{ name: "Revenue", values: [] }] },
      { ...column, kind: "pie" as const, series: [{ name: "Revenue", values: [0, 0, 0] }] },
    ])
      expect(numbersIn(derive(chart)).filter((value) => !Number.isFinite(value))).toEqual([])
  })

  it("sizes the legend swatches and line markers with the chart's words, 16 px or more on the slide type scale", () => {
    const scaled = (chart: Chart) => deriveChart(frame, chart, spot(0, 0, 1600, 700), defaultTheme, measure)
    const sides = (parts: readonly Resolved[], marker: string) =>
      parts.filter((part) => part.id.includes(marker)).map((part) => part.box.w)
    const legend = sides(scaled(column), "~swatch")
    expect(legend.length).toBeGreaterThan(0)
    for (const side of legend) expect(side).toBeGreaterThanOrEqual(16)
    const dots = scaled({ ...column, kind: "line" }).filter((part) => part.geometry?.kind === "ellipse")
    expect(dots.length).toBeGreaterThan(0)
    for (const dot of dots) expect(dot.box.w).toBeGreaterThanOrEqual(16)
  })
})
