import { describe, expect, it } from "vitest"
import { valueAxis } from "./chart-value-axis.js"
import { defaultTheme } from "./default-theme-art.js"
import { type Box, type Chart, type Resolved, deriveChart, nodeId } from "./index.js"
import { chartKinds, chartOfCase, chromiumCases, compactCases, operatingCost, revenue } from "./testing/chart-cases.js"
import { spot } from "./testing/doom-fixtures-art.js"
import { interMeasure } from "./testing/inter-measure.js"

const frame = nodeId("t:9")
const derive = (chart: Chart, w: number, h: number) =>
  deriveChart(frame, chart, spot(0, 0, w, h), defaultTheme, interMeasure)

const textOf = (part: Resolved) => part.text?.lines.map((line) => line.runs.map((run) => run.text).join("")).join("")

const lineBoxes = (parts: readonly Resolved[]) =>
  parts.flatMap((part) =>
    part.text === null
      ? []
      : part.text.lines.map((line) => {
          const box: Box = {
            ...part.box,
            x: part.box.x + line.x,
            y: part.box.y + line.y,
            w: line.w,
            h: line.h,
          }
          return { id: part.id, box }
        }),
  )

const crossing = (a: Box, b: Box) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01

const clashes = (parts: readonly Resolved[]) => {
  const all = lineBoxes(parts)
  return all.flatMap((a, at) =>
    all
      .slice(at + 1)
      .filter((b) => crossing(a.box, b.box))
      .map((b) => `${a.id} | ${b.id}`),
  )
}

const named = (parts: readonly Resolved[], kind: string) =>
  parts.filter((part) => part.id.startsWith(`${frame}#~${kind}:`)).map(textOf)

const ticksOf = (parts: readonly Resolved[]) =>
  parts.filter((part) => part.id.startsWith(`${frame}#~tick:`)).map((part) => Number(part.id.split(":").at(-1)))

const marksOf = (parts: readonly Resolved[]) =>
  parts.filter((part) => part.id.startsWith(`${frame}#`) && !part.id.includes("~") && part.text === null)

const spanOf = (boxes: readonly Box[], axis: "x" | "y") => {
  const size = axis === "x" ? "w" : "h"
  return Math.max(...boxes.map((box) => box[axis] + box[size])) - Math.min(...boxes.map((box) => box[axis]))
}

describe("a compact chart shares its room between the legend and the plot", () => {
  for (const one of compactCases)
    for (const kind of chartKinds)
      it(`${kind} ${one.name} ${String(one.w)}x${String(one.h)}`, () => {
        const chart = chartOfCase(kind, one)
        const parts = derive(chart, one.w, one.h)
        expect(clashes(parts)).toEqual([])
        for (const { id, box } of lineBoxes(parts)) {
          expect(box.x, id).toBeGreaterThanOrEqual(-0.5)
          expect(box.y, id).toBeGreaterThanOrEqual(-0.5)
          expect(box.x + box.w, id).toBeLessThanOrEqual(one.w + 0.5)
          expect(box.y + box.h, id).toBeLessThanOrEqual(one.h + 0.5)
        }
        const names = kind === "pie" ? chart.categories : chart.series.length > 1 ? chart.series.map((s) => s.name) : []
        expect(named(parts, "legend")).toEqual(names)
        const marks = marksOf(parts)
        for (const mark of marks) {
          expect(mark.box.w, mark.id).toBeGreaterThanOrEqual(1)
          expect(mark.box.h, mark.id).toBeGreaterThanOrEqual(1)
          expect(mark.box.y + mark.box.h, mark.id).toBeLessThanOrEqual(one.h + 0.5)
        }
        if (kind === "pie") {
          const pie = marks[0]!.box
          expect(pie.w).toBeGreaterThanOrEqual(Math.min(one.w, one.h) * 0.4)
          const keys = lineBoxes(parts.filter((part) => !part.id.includes("#~value:")))
          expect(keys.filter(({ box }) => crossing(box, pie)).map(({ id }) => id)).toEqual([])
          return
        }
        const dots = marks.filter((mark) => mark.geometry?.kind !== "path")
        expect(dots.length).toBe(chart.series.length * chart.categories.length)
        if (kind === "bar")
          expect(
            spanOf(
              dots.map((mark) => mark.box),
              "x",
            ),
          ).toBeGreaterThanOrEqual(one.w / 4)
        else
          expect(
            spanOf(
              dots.map((mark) => mark.box),
              "y",
            ),
          ).toBeGreaterThanOrEqual(one.h / 4)
        const axis = valueAxis(chart)
        const ends = [0, axis.ticks.length - 1, axis.ticks.indexOf(0)].filter((index) => index >= 0)
        expect(ticksOf(parts)).toEqual(expect.arrayContaining(ends))
        const legend = lineBoxes(parts.filter((part) => part.id.includes("#~legend:"))).map(({ box }) => box)
        for (const mark of dots)
          expect(
            legend.filter((box) => crossing(box, mark.box)),
            mark.id,
          ).toEqual([])
      })
})

describe("a chart keeps what a reader needs, with no text over text", () => {
  for (const one of chromiumCases)
    for (const kind of chartKinds)
      it(`${kind} ${one.name} ${String(one.w)}x${String(one.h)} unit ${JSON.stringify(one.unit ?? null)}`, () => {
        const chart = chartOfCase(kind, one)
        const parts = derive(chart, one.w, one.h)
        expect(clashes(parts)).toEqual([])
        for (const { id, box } of lineBoxes(parts)) {
          expect(box.x, id).toBeGreaterThanOrEqual(-0.5)
          expect(box.y, id).toBeGreaterThanOrEqual(-0.5)
          expect(box.x + box.w, id).toBeLessThanOrEqual(one.w + 0.5)
          expect(box.y + box.h, id).toBeLessThanOrEqual(one.h + 0.5)
        }
        const names = kind === "pie" ? chart.categories : chart.series.length > 1 ? chart.series.map((s) => s.name) : []
        expect(named(parts, "legend")).toEqual(names)
        if (kind !== "pie") {
          const axis = valueAxis(chart)
          const ends = [0, axis.ticks.length - 1, axis.ticks.indexOf(0)].filter((index) => index >= 0)
          expect(ticksOf(parts)).toEqual(expect.arrayContaining(ends))
        }
      })
})

describe("a word unit is printed once, at the value axis", () => {
  it("keeps the scale and the values of a compact stacked revenue chart in thousand USD", () => {
    const parts = derive(
      { kind: "stacked", labels: true, categories: ["Q1", "Q2", "Q3", "Q4"], series: revenue, unit: "thousand USD" },
      640,
      400,
    )
    const ticks = parts.filter((part) => part.id.includes("#~tick:")).map(textOf)
    expect(ticks).toEqual(expect.arrayContaining(["0", "2,000"]))
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(parts.filter((part) => part.id.includes("#~value:")).length).toBeGreaterThanOrEqual(4)
    const said = parts.map(textOf).filter((text) => text?.includes("thousand USD"))
    expect(said).toEqual(["thousand USD"])
    expect(parts.find((part) => part.id === `${frame}#~unit`)).toBeDefined()
  })

  it("keeps a short attached unit on the numbers and draws no unit label", () => {
    const parts = derive(
      { kind: "column", labels: true, categories: ["Q1", "Q2", "Q3", "Q4"], series: revenue, unit: "$M" },
      900,
      460,
    )
    expect(parts.map(textOf)).toEqual(expect.arrayContaining(["$0M", "$1,550M"]))
    expect(parts.find((part) => part.id === `${frame}#~unit`)).toBeUndefined()
  })

  for (const unit of [undefined, "thousand USD", "دولار", "$M"])
    it(`names all five operating cost series at 900x460, unit ${JSON.stringify(unit ?? null)}`, () => {
      const parts = derive(
        {
          kind: "stacked",
          labels: true,
          categories: ["Q1", "Q2", "Q3", "Q4"],
          series: operatingCost,
          ...(unit === undefined ? {} : { unit }),
        },
        900,
        460,
      )
      expect(named(parts, "legend")).toEqual(operatingCost.map((series) => series.name))
      expect(clashes(parts)).toEqual([])
    })
})

const partText = (parts: readonly Resolved[], id: string) =>
  textOf(parts.find((part) => part.id === `${frame}#~${id}`)!)

describe("a value axis reads at a glance", () => {
  it("prints a billion-scale axis in one compact scale and keeps the precise value labels that fit", () => {
    const huge = [-2.5, 0, 987654321012.34, 0.004, 324000000000.25]
    for (const kind of ["line", "column", "bar"] as const) {
      const parts = derive(
        {
          kind,
          labels: true,
          categories: ["Loss", "Zero", "Huge", "Tiny", "Major"],
          series: [{ name: "Sales", values: huge }],
        },
        900,
        460,
      )
      const ticks = parts.filter((part) => part.id.includes("#~tick:")).map(textOf)
      expect(ticks, kind).toEqual(["0", "0.2T", "0.4T", "0.6T", "0.8T", "1.0T"].filter((tick) => ticks.includes(tick)))
      expect(ticks, kind).toEqual(expect.arrayContaining(["0", "1.0T"]))
      expect(partText(parts, "value:0:2"), kind).toBe("987,654,321,012.34")
    }
  })

  it("takes decimals from the tick step, so a whole step prints whole ticks", () => {
    const parts = derive(
      {
        kind: "column",
        labels: true,
        categories: ["A", "B", "C"],
        series: [{ name: "Sales", values: [0.004, 120.5, 450.25] }],
      },
      640,
      400,
    )
    const ticks = parts.filter((part) => part.id.includes("#~tick:")).map(textOf)
    expect(ticks).toEqual(expect.arrayContaining(["0", "500"]))
    expect(ticks.filter((tick) => tick?.includes("."))).toEqual([])
    expect(partText(parts, "value:0:2")).toBe("450.25")
  })

  it("sets a rupee on every tick and value and draws no separate unit", () => {
    for (const kind of ["line", "column", "bar", "stacked"] as const) {
      const parts = derive(
        {
          kind,
          labels: true,
          categories: ["Q1", "Q2", "Q3", "Q4"],
          series: [{ name: "Revenue", values: [10, 20, 30, 40] }],
          unit: "₹",
        },
        640,
        400,
      )
      const ticks = parts.filter((part) => part.id.includes("#~tick:")).map(textOf)
      expect(ticks, kind).toEqual(expect.arrayContaining(["₹0", "₹40"]))
      expect(partText(parts, "value:0:3"), kind).toBe("₹40")
      expect(
        parts.find((part) => part.id === `${frame}#~unit`),
        kind,
      ).toBeUndefined()
    }
  })
})

describe("a word unit sits with the scale it names", () => {
  for (const kind of ["line", "column", "stacked"] as const)
    it(`right-aligns the ${kind} caption under the tick column`, () => {
      const parts = derive(
        { kind, labels: true, categories: ["Q1", "Q2", "Q3", "Q4"], series: revenue, unit: "thousand USD" },
        640,
        400,
      )
      const unit = lineBoxes(parts.filter((part) => part.id === `${frame}#~unit`))[0]!.box
      const ticks = lineBoxes(parts.filter((part) => part.id.includes("#~tick:"))).map(({ box }) => box)
      const column = Math.max(...ticks.map((box) => box.x + box.w))
      const lowest = Math.max(...ticks.map((box) => box.y + box.h))
      expect(unit.x + unit.w).toBeCloseTo(column, 0)
      expect(unit.y).toBeGreaterThanOrEqual(lowest)
      expect(unit.y - lowest).toBeLessThan(40)
    })

  it("keeps a pie's unit heading when value labels are off", () => {
    const parts = derive(
      {
        kind: "pie",
        labels: false,
        categories: ["Q1", "Q2", "Q3", "Q4"],
        series: [{ name: "Recycling", values: [10, 20, 30, 40] }],
        unit: "kg",
      },
      640,
      400,
    )
    expect(partText(parts, "unit")).toBe("kg")
    expect(parts.filter((part) => part.id.includes("#~value:"))).toEqual([])
  })
})
