import { expect } from "vitest"

import {
  drawsInEveryStyle,
  type Data,
  type Rows,
  bottom,
  boxOf,
  charsOf,
  fillOf,
  named,
  near,
  sampleOf,
} from "./testing/chart-recipe.js"

const variants: Readonly<Record<string, Data>> = {
  sample: { rows: sampleOf("column", "rows"), accent: sampleOf("column", "accent") },
  "3 rows": {
    rows: [
      ["2024", 61],
      ["2025", 940],
      ["2026E", 880],
    ],
    accent: "2025",
  },
  "10 rows": {
    rows: [
      ["2017", 12],
      ["2018", 48],
      ["2019", 95],
      ["2020", 61],
      ["2021", 230],
      ["2022", 377],
      ["2023", 503],
      ["2024", 618],
      ["2025", 940],
      ["2026E", 880],
    ],
    accent: "2025",
  },
  "long labels": {
    rows: [
      ["First half 2024", 230],
      ["Second half 2024", 377],
      ["First half 2025", 503],
      ["Second half 2025E", 618],
    ],
    accent: "First half 2025",
  },
}

drawsInEveryStyle("column", variants, (fold, chart, data) => {
  const rows = data.rows as Rows
  expect(named(fold, chart, "Name").map(charsOf)).toEqual(rows.map(([name]) => name))
  expect(named(fold, chart, "Value").map(charsOf)).toEqual(rows.map(([, value]) => String(value)))
  const columns = named(fold, chart, "Column").map(boxOf)
  const zero = boxOf(named(fold, chart, "Zero line")[0]!)
  const largest = Math.max(...rows.map(([, value]) => value))
  const tallest = Math.max(...columns.map((column) => column.h))
  rows.forEach(([name, value], i) => {
    expect(bottom(columns[i]!), name).toBe(zero.y)
    near(columns[i]!.h, (tallest * value) / largest, name)
  })
  expect(named(fold, chart, "Column").map((column) => fillOf(column) === "accent1")).toEqual(
    rows.map(([name]) => name === data.accent),
  )
})
