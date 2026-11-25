import { describe, expect, it } from "vitest"
import { type Chart, type Resolved, deriveChart, nodeId } from "./index.js"
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

describe("chart axis labels", () => {
  it("shares the series precision, and prints the unit on the axis", () => {
    const words = wordsOf(derive(revenue as Chart))
    expect(words).toEqual(expect.arrayContaining(["43.0", "48.2"]))
    expect(words).not.toContain("43")
    const ticks = words.filter((word) => word.endsWith(" $M"))
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.every((word) => /^-?\d+\.\d \$M$/.test(word))).toBe(true)
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
          { name: "Plan", values: [10] },
          { name: "Actual", values: [10.25] },
        ],
        labels: true,
      }),
    )
    expect(words).toEqual(expect.arrayContaining(["10.00", "10.25"]))
    expect(words).not.toContain("10")
  })
})
