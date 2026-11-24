import { describe, expect, it } from "vitest"
import { readAgentChange } from "./agent-change.js"
import { build } from "./agent-fixtures.js"
import { richDeck } from "./testing/rich-deck.js"
import { axisUnitBytes, fitAxisUnit, readChart } from "./chart.js"
import { bytesOf } from "./limits.js"
import { axisUnit, formatCompact, formatValue, niceAxis, scaledTicks } from "./chart-axis.js"
import { type Chart, type Resolved, deriveChart, nodeId, propOf, readForAgent } from "./index.js"
import { ids } from "./sample-deck.js"
import { measure, plainTheme, spot } from "./testing/doom-fixtures-art.js"

const frame = nodeId("t:9")
const area = spot(0, 0, 800, 400)
const derive = (chart: Chart) => deriveChart(frame, chart, area, plainTheme, measure)
const wordsOf = (parts: readonly Resolved[]) =>
  parts.flatMap((part) =>
    part.text === null ? [] : [part.text.lines.map((line) => line.runs.map((run) => run.text).join("")).join("\n")],
  )

const revenue = {
  kind: "column" as const,
  categories: ["Prior", "This"],
  series: [{ name: "Revenue", values: [43, 48.2] }],
  labels: true,
  unit: "$M",
}

describe("a unit beside a number", () => {
  it("sets a currency symbol before its number, with the rest of the unit after it", () => {
    expect(formatValue(1000, 0, "$")).toBe("$1,000")
    expect(formatValue(43.2, 1, "$M")).toBe("$43.2M")
    expect(formatValue(88, 0, "£")).toBe("£88")
    expect(formatValue(-2.5, 1, "€")).toBe("-€2.5")
    expect(formatValue(7, 0, "¥")).toBe("¥7")
  })

  it("sets any currency symbol, or a currency code, before its number", () => {
    expect(formatValue(1200, 0, "₹")).toBe("₹1,200")
    expect(formatValue(-2.5, 1, "₩")).toBe("-₩2.5")
    expect(formatValue(7, 0, "₺")).toBe("₺7")
    expect(formatValue(7, 0, "₦")).toBe("₦7")
    expect(formatValue(7, 0, "₱")).toBe("₱7")
    expect(formatValue(1200, 0, "R$")).toBe("R$1,200")
    expect(formatValue(43.2, 1, "R$M")).toBe("R$43.2M")
    expect(formatValue(1200, 0, "CHF")).toBe("CHF 1,200")
    expect(formatValue(-3, 0, "CHF")).toBe("-CHF 3")
    for (const unit of ["₹", "R$", "CHF", "₩"]) expect(axisUnit(unit), unit).toBeUndefined()
    expect(formatCompact(2_500_000_000, "₹")).toBe("₹2.5B")
    expect(formatCompact(2_500_000_000, "CHF")).toBe("CHF 2.5B")
  })

  it("attaches a percent sign and a lone multiplier letter to the number, as Excel does", () => {
    expect(formatValue(50, 0, "%")).toBe("50%")
    expect(formatValue(3000, 0, "%")).toBe("3,000%")
    expect(formatValue(43.2, 1, "M")).toBe("43.2M")
    expect(formatValue(12, 0, "K")).toBe("12K")
    expect(formatValue(3, 0, "B")).toBe("3B")
  })

  it("leaves a unit made of words off the number, for the axis to print once", () => {
    expect(formatValue(5, 0, "kg")).toBe("5")
    expect(formatValue(12, 0, "users")).toBe("12")
    expect(formatValue(43.2, 1, "thousand USD")).toBe("43.2")
    expect(formatValue(5, 0, "دولار")).toBe("5")
    expect(formatValue(5, 0, "$$")).toBe("5")
    expect(formatValue(5, 0, "$bn")).toBe("5")
    expect(formatValue(5, 0, "$M")).toBe("$5M")
  })

  it("shortens a long number with a letter, unless the unit already has one", () => {
    expect(formatCompact(987654321012.34)).toBe("987.7B")
    expect(formatCompact(1_000_000_000_000, "$")).toBe("$1T")
    expect(formatCompact(-2500, "%")).toBe("-2.5K%")
    expect(formatCompact(400_000_000, "thousand USD")).toBe("400M")
    expect(formatCompact(400, "$M")).toBeUndefined()
    expect(formatCompact(400, "K")).toBeUndefined()
  })

  it("prints one axis in one scale, with decimals from the step", () => {
    const trillion = niceAxis(0, 987654321012.34)
    expect(trillion.ticks.map(scaledTicks(trillion)!)).toEqual(["0", "0.2T", "0.4T", "0.6T", "0.8T", "1.0T"])
    expect(trillion.ticks.map(scaledTicks(trillion, "₹")!)).toContain("₹1.0T")
    const billions = niceAxis(-400_000_000, 1_600_000_000)
    expect(billions.ticks.map(scaledTicks(billions)!)).toEqual(["-0.5B", "0", "0.5B", "1.0B", "1.5B", "2.0B"])
    const thousands = niceAxis(0, 9_000)
    expect(thousands.ticks.map(scaledTicks(thousands)!)).toEqual(["0", "2K", "4K", "6K", "8K", "10K"])
    expect(scaledTicks(trillion, "$M")).toBeUndefined()
    expect(scaledTicks(niceAxis(0, 450))).toBeUndefined()
  })
})

describe("fitting a chart unit", () => {
  const typed = ["€".repeat(24), "😀".repeat(12), `${"x".repeat(23)}😀`, "x".repeat(30), "  $M  ", "ab\ncd", "\ud83d"]

  it("always fits what the deck reader accepts, cut by whole characters", () => {
    for (const words of typed) {
      const unit = fitAxisUnit(words)
      expect(bytesOf(unit)).toBeLessThanOrEqual(axisUnitBytes)
      if (unit !== "")
        expect(readChart({ kind: "pie", categories: ["a"], series: [{ name: "s", values: [1] }], unit })).toMatchObject(
          {
            unit,
          },
        )
    }
  })

  it("keeps as many whole characters as fit", () => {
    expect(fitAxisUnit("€".repeat(24))).toBe("€".repeat(8))
    expect(fitAxisUnit("😀".repeat(12))).toBe("😀".repeat(6))
    expect(fitAxisUnit(`${"x".repeat(23)}😀`)).toBe("x".repeat(23))
    expect(fitAxisUnit("x".repeat(30))).toBe("x".repeat(24))
    expect(fitAxisUnit("  $M  ")).toBe("$M")
    expect(fitAxisUnit("   ")).toBe("")
  })

  it("never cuts a joined emoji in the middle", () => {
    const family = "👨‍👩‍👧"
    expect(fitAxisUnit(`${"x".repeat(5)}${family}${family}`)).toBe(`${"x".repeat(5)}${family}`)
  })
})

describe("chart axis labels", () => {
  it("shares the series precision, and prints the unit on every number", () => {
    const words = wordsOf(derive(revenue as Chart))
    expect(words).toEqual(expect.arrayContaining(["$43.0M", "$48.2M"]))
    const ticks = words.filter((word) => /^-?\$\d+\.\dM$/.test(word))
    expect(ticks.length).toBeGreaterThan(0)
  })

  it("keeps whole numbers bare when every series value is whole", () => {
    const words = wordsOf(
      derive({ kind: "column", categories: ["Q1", "Q2"], series: [{ name: "Revenue", values: [10, 20] }] }),
    )
    expect(words).toContain("0")
    expect(words).not.toContain("0.0")
  })

  const tickWords = (values: readonly number[]) =>
    wordsOf(derive({ kind: "column", categories: ["A", "B"], series: [{ name: "N", values }] })).filter((word) =>
      /^-?\d/.test(word),
    )

  it("prints the half step when the series is 1 and 2", () => {
    expect(tickWords([1, 2])).toEqual(["0.0", "0.5", "1.0", "1.5", "2.0"])
  })

  it("prints the fifth step when the series is 0 and 1", () => {
    expect(tickWords([0, 1])).toEqual(["0.0", "0.2", "0.4", "0.6", "0.8", "1.0"])
  })

  it("uses the finer series when two series disagree", () => {
    const words = wordsOf(
      derive({
        kind: "line",
        categories: ["Q1"],
        series: [
          { name: "Plan", values: [1] },
          { name: "Actual", values: [10.25] },
        ],
        labels: true,
      }),
    )
    expect(words).toEqual(expect.arrayContaining(["1.00", "10.25"]))
    expect(words).not.toContain("1")
  })

  it("stores an axis unit on the chart and reads it back", () => {
    expect(readChart(revenue)).toMatchObject({ unit: "$M" })
    const doom = build(richDeck(), { op: "add", kind: "chart", slide: ids.slide, chart: revenue })
    const saved = [...doom.nodes.values()].flatMap((node) => {
      const chart = propOf(node, "chart")
      return chart === undefined ? [] : [chart]
    })
    expect(saved).toContainEqual(expect.objectContaining({ unit: "$M" }))
    expect(readForAgent(doom, "all")).toContain('"unit":"$M"')
  })

  it("fits a unit onto one line", () => {
    expect(fitAxisUnit("thousand\tUSD\r\nper share")).toBe("thousand USD per share")
  })

  it("names a non-text axis unit", () => {
    const chart = { ...revenue, unit: "$M" }
    const set = (unit: unknown) => readAgentChange({ op: "set", target: "t:3", chart: { ...chart, unit } })
    expect(set(4)).toMatchObject({ field: "chart.unit" })
    expect(set("$M")).not.toHaveProperty("refused")
  })
})
