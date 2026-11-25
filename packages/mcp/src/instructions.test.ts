import { componentLibrary } from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { kindInstructions } from "./index.js"

describe("kindInstructions", () => {
  const chartLine = kindInstructions()
    .split("\n")
    .find((line) => line.startsWith("Chart a series of numbers when it proves a slide's title"))

  it("names every chart in the library, so an agent charts a series of numbers", () => {
    const charts = [...componentLibrary.values()].filter(({ spec }) => spec.chart !== undefined).map(({ id }) => id)
    expect(charts.length).toBeGreaterThan(0)
    expect(chartLine).toBeDefined()
    for (const id of charts) expect(chartLine).toContain(id)
  })

  it("asks for one chart per slide and sets no chart count for the deck", () => {
    expect(chartLine).toContain("one chart per slide")
    expect(chartLine).not.toMatch(/one or two/)
  })
})
