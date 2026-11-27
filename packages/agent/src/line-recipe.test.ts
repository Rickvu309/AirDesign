import * as doom from "@airdesign/doom"
import { expect } from "vitest"

import {
  drawsInEveryStyle,
  type Data,
  bottom,
  boxOf,
  charsOf,
  named,
  near,
  right,
  sampleOf,
  strokeOf,
} from "./testing/chart-recipe.js"

const variants: Readonly<Record<string, Data>> = {
  sample: {
    periods: sampleOf("line", "periods"),
    series: sampleOf("line", "series"),
    marker: sampleOf("line", "marker"),
  },
  "3 rows": {
    periods: ["2024", "2025", "2026E"],
    series: [
      ["Our platform", [210, 560, 940]],
      ["Market", [150, 300, 450]],
    ],
    marker: null,
  },
  "10 rows": {
    periods: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10"],
    series: [
      ["Test stores", [4.1, 4.0, 4.2, 4.1, 5.6, 6.0, 6.2, 6.1, 6.4, 6.5]],
      ["Control stores", [4.0, 4.1, 4.1, 4.0, 4.2, 4.1, 4.3, 4.2, 4.2, 4.3]],
    ],
    marker: { at: "W5", text: "Pilot starts" },
  },
  "long labels": {
    periods: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
    series: [
      ["Stores in the pilot region", [2.1, 2.0, 2.2, 3.4, 3.9, 4.1, 4.4, 4.6]],
      ["Matched control stores", [2.0, 2.1, 2.1, 2.2, 2.1, 2.3, 2.2, 2.4]],
      ["All other stores nationwide", [1.6, 1.7, 1.7, 1.8, 1.8, 1.9, 1.9, 2.0]],
    ],
    marker: { at: "Apr", text: "Loyalty pilot starts" },
  },
}

drawsInEveryStyle("line", variants, (fold, chart, data) => {
  const periods = data.periods as readonly string[]
  const series = data.series as readonly (readonly [string, readonly number[]])[]
  const marker = data.marker as { at: string; text: string } | null
  const paths = named(fold, chart, "Series")
  expect(paths.map(strokeOf)).toEqual([...series.map((_, i) => (i === 0 ? "accent1" : "text")).toReversed()])
  const plot = boxOf(paths[0]!)
  const xOf = (i: number) => plot.x + (plot.w * i) / (periods.length - 1)
  const ticks = named(fold, chart, "Tick").map((tick) => Number(charsOf(tick)))
  const [low, high] = [Math.min(...ticks), Math.max(...ticks)]
  const step = ticks[1]! - ticks[0]!
  expect([1, 2, 2.5, 5]).toContain(Number((step / 10 ** Math.floor(Math.log10(step))).toFixed(6)))
  expect(high - step).toBeLessThan(Math.max(...series.flatMap(([, values]) => values)))
  series.toReversed().forEach(([name, values], s) => {
    const d = (doom.propOf(paths[s]!, "geometry") as { d: string }).d
    const at = [...d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map(([, x, y]) => ({
      x: plot.x + Number(x) * plot.w,
      y: plot.y + Number(y) * plot.h,
    }))
    expect(at, name).toHaveLength(periods.length)
    values.forEach((value, i) => {
      near(at[i]!.x, xOf(i), `${name} ${periods[i]!}`)
      near(at[i]!.y, plot.y + (plot.h * (high - value)) / (high - low), `${name} ${periods[i]!}`)
    })
  })
  const labels = named(fold, chart, "Label").map(charsOf).join("\n")
  for (const [name] of series) expect(labels).toContain(name)
  expect(named(fold, chart, "Legend")).toEqual([])
  const stacked = [...named(fold, chart, "Label"), ...named(fold, chart, "Gap label")]
    .map(boxOf)
    .toSorted((a, b) => a.y - b.y)
  stacked
    .slice(1)
    .forEach((box, i) => expect(box.y, "end labels clear each other").toBeGreaterThanOrEqual(bottom(stacked[i]!)))
  if (marker !== null) {
    const line = boxOf(named(fold, chart, "Marker")[0]!)
    near(line.x + line.w / 2, xOf(periods.indexOf(marker.at)), "marker")
    expect(line.y).toBe(plot.y)
    expect(bottom(line)).toBe(bottom(plot))
    expect(named(fold, chart, "Marker label").map(charsOf)).toEqual([marker.text])
  }
  if (series.length === 2) {
    const gap = series[0]![1].at(-1)! - series[1]![1].at(-1)!
    expect(named(fold, chart, "Gap label").map((node) => charsOf(node))).toEqual([
      `${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)} pts`,
    ])
    const bracket = boxOf(named(fold, chart, "Gap")[0]!)
    expect(bracket.x).toBeGreaterThanOrEqual(right(plot))
    const ends = named(fold, chart, "End")
      .map(boxOf)
      .map((end) => end.y + end.h / 2)
    near(bracket.y, Math.min(...ends), "gap top")
    near(bottom(bracket), Math.max(...ends), "gap bottom")
  }
})
