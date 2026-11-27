import { expect } from "vitest"

import {
  drawsInEveryStyle,
  type Data,
  bottom,
  boxOf,
  charsOf,
  fillOf,
  named,
  near,
  sampleOf,
} from "./testing/chart-recipe.js"

const variants: Readonly<Record<string, Data>> = {
  sample: {
    periods: sampleOf("stacked-column", "periods"),
    parts: sampleOf("stacked-column", "parts"),
    accent: sampleOf("stacked-column", "accent"),
  },
  "3 rows": {
    periods: ["2024", "2025", "2026E"],
    parts: [
      ["Retail", [120, 131, 140]],
      ["Online", [40, 66, 95]],
      ["Wholesale", [80, 74, 70]],
    ],
    accent: "Online",
  },
  "10 rows": {
    periods: ["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026E"],
    parts: [
      ["Cloud", [4, 7, 11, 16, 22, 29, 37, 46, 56, 67]],
      ["Licences", [40, 41, 41, 40, 38, 36, 33, 30, 27, 24]],
      ["Services", [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]],
      ["Support", [8, 8, 9, 9, 9, 10, 10, 11, 11, 11]],
      ["Hardware", [20, 18, 16, 14, 12, 10, 9, 8, 7, 6]],
    ],
    accent: "Cloud",
  },
  "long labels": {
    periods: ["2023", "2024", "2025", "2026E"],
    parts: [
      ["Managed cloud services", [30, 42, 55, 70]],
      ["On-premise licences", [60, 54, 47, 40]],
      ["Professional services", [25, 26, 27, 28]],
    ],
    accent: "Managed cloud services",
  },
}

drawsInEveryStyle("stacked-column", variants, (fold, chart, data) => {
  const periods = data.periods as readonly string[]
  const parts = data.parts as readonly (readonly [string, readonly number[]])[]
  const stack = parts.toSorted((a, b) => Number(b[0] === data.accent) - Number(a[0] === data.accent))
  const totals = periods.map((_, i) => stack.reduce((sum, [, values]) => sum + values[i]!, 0))
  expect(named(fold, chart, "Name").map(charsOf)).toEqual(periods)
  expect(named(fold, chart, "Total").map(charsOf)).toEqual(totals.map(String))
  expect(named(fold, chart, "Part").map((part) => charsOf(part).replaceAll("*", ""))).toEqual(
    stack.map(([name]) => name),
  )
  const zero = boxOf(named(fold, chart, "Zero line")[0]!)
  const segments = named(fold, chart, "Segment")
  expect(segments).toHaveLength(periods.length * stack.length)
  const scale = Math.max(...totals) / (zero.y - Math.min(...segments.map((segment) => boxOf(segment).y)))
  periods.forEach((period, i) => {
    const column = segments.slice(i * stack.length, (i + 1) * stack.length)
    let level = zero.y
    let sum = 0
    column.forEach((segment, k) => {
      const box = boxOf(segment)
      const part = `${period} ${stack[k]![0]}`
      sum += stack[k]![1][i]!
      expect(level - bottom(box), part).toBe(k === 0 ? 0 : 2)
      near(box.y, zero.y - sum / scale, part)
      level = box.y
      expect(fillOf(segment) === "accent1", part).toBe(stack[k]![0] === data.accent)
      const label = charsOf(segment)
      if (label !== "") expect(label, part).toBe(String(stack[k]![1][i]))
    })
    near((zero.y - level) * scale, totals[i]!, `${period} total`)
    const total = boxOf(named(fold, chart, "Total")[i]!)
    expect(bottom(total), period).toBeLessThanOrEqual(level)
  })
  const fills = segments.map(fillOf)
  periods.forEach((_, i) =>
    expect(fills.slice(i * stack.length, (i + 1) * stack.length)).toEqual(fills.slice(0, stack.length)),
  )
})
