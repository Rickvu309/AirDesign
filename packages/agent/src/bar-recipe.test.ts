import * as doom from "@airdesign/doom"
import { expect } from "vitest"

import {
  drawsInEveryStyle,
  type Data,
  type Rows,
  boxOf,
  charsOf,
  fillOf,
  named,
  near,
  ranked,
  right,
  sampleOf,
} from "./testing/chart-recipe.js"

const estimate = doom.measureWith({})
const long = (name: string) => `${name} and the wider region`

const variants: Readonly<Record<string, Data>> = {
  sample: { rows: sampleOf("bar", "rows"), accent: sampleOf("bar", "accent") },
  "3 rows": {
    rows: [
      ["Canada", 940],
      ["Japan", 377],
      ["Brazil", 12],
    ],
    accent: "Japan",
  },
  "10 rows": {
    rows: [
      ["Brazil", 12],
      ["Canada", 940],
      ["Japan", 377],
      ["Other", 55],
      ["South Africa", 61],
      ["Mexico", 503],
      ["India", 218],
      ["France", 268],
      ["Spain", 164],
      ["Italy", 120],
    ],
    accent: "India",
  },
  "long labels": {
    rows: [
      ["North America", 940],
      ["Asia Pacific", 377],
      ["Latin America", 120],
      ["Middle East", 61],
    ].map(([name, value]) => [long(name as string), value]),
    accent: long("Asia Pacific"),
  },
  "bold percentages": {
    rows: [
      ["Search", 100],
      ["Reports", 38],
      ["Alerts", 29],
      ["Exports", 24],
    ],
    accent: "Search",
    shown: (value: number) => `${value}%`,
  },
}

drawsInEveryStyle("bar", variants, (fold, chart, data) => {
  const rows = data.rows as Rows
  const order = ranked(rows)
  expect(named(fold, chart, "Name").map(charsOf)).toEqual(order.map(([name]) => name))
  const shown = (data.shown as ((value: number) => string) | undefined) ?? String
  expect(named(fold, chart, "Value").map(charsOf)).toEqual(order.map(([, value]) => shown(value)))
  const { theme } = doom.deckOf(fold)
  for (const value of named(fold, chart, "Value")) {
    const text = { ...doom.propOf(value, "text")!, paras: [{}] }
    const line = estimate(text, theme, null).w
    expect(boxOf(value).w, charsOf(value)).toBeGreaterThanOrEqual(line * 1.35)
  }
  const bars = named(fold, chart, "Bar").map(boxOf)
  const values = named(fold, chart, "Value").map(boxOf)
  const zero = boxOf(named(fold, chart, "Zero line")[0]!)
  const largest = order[0]![1]
  order.forEach(([name, value], i) => {
    expect(bars[i]!.x, name).toBe(right(zero))
    near(bars[i]!.w, (bars[0]!.w * value) / largest, name)
    expect(values[i]!.x, name).toBeGreaterThan(right(bars[i]!))
    expect(right(values[i]!), name).toBeLessThanOrEqual(boxOf(chart).w)
  })
  expect(named(fold, chart, "Bar").map((bar) => fillOf(bar) === "accent1")).toEqual(
    order.map(([name]) => name === data.accent),
  )
})
