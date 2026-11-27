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
  right,
  sampleOf,
} from "./testing/chart-recipe.js"

const variants: Readonly<Record<string, Data>> = {
  sample: {
    first: sampleOf("waterfall", "first"),
    steps: sampleOf("waterfall", "steps"),
    last: sampleOf("waterfall", "last"),
  },
  "3 rows": {
    first: ["FY25", 200],
    steps: [
      ["Price", 30],
      ["Costs", -45],
      ["Volume", 12],
    ],
    last: "FY26",
  },
  "10 rows": {
    first: ["FY25", 412],
    steps: [
      ["Volume", 64],
      ["Price", 38],
      ["Mix", -12],
      ["Inputs", -71],
      ["Labour", -24],
      ["Freight", 9],
      ["Savings", 45],
      ["FX", -9],
      ["Other", 6],
      ["Tax", -18],
    ],
    last: "FY26",
  },
  "long labels": {
    first: ["Operating profit FY25", 412],
    steps: [
      ["Higher volume in retail", 64],
      ["Raw material inflation", -71],
      ["Productivity programme", 45],
    ],
    last: "Operating profit FY26",
  },
}

drawsInEveryStyle("waterfall", variants, (fold, chart, data) => {
  const [startName, startValue] = data.first as readonly [string, number]
  const steps = data.steps as Rows
  const end = startValue + steps.reduce((sum, [, value]) => sum + value, 0)
  const bars = named(fold, chart, "Bar")
  expect(named(fold, chart, "Name").map(charsOf)).toEqual([startName, ...steps.map(([name]) => name), data.last])
  expect(named(fold, chart, "Value").map(charsOf)).toEqual([
    String(startValue),
    ...steps.map(([, value]) => (value >= 0 ? `+${String(value)}` : `−${String(-value)}`)),
    String(end),
  ])
  expect(bars.map(fillOf)).toEqual([
    "total",
    ...steps.map(([, value]) => (value >= 0 ? "positive" : "negative")),
    "total",
  ])
  const zero = boxOf(named(fold, chart, "Zero line")[0]!)
  const first = boxOf(bars[0]!)
  const last = boxOf(bars.at(-1)!)
  expect(bottom(first)).toBe(zero.y)
  expect(bottom(last)).toBe(zero.y)
  const scale = startValue / first.h
  near(last.h * scale, end, "end bar")
  const connectors = named(fold, chart, "Connector").map(boxOf)
  expect(connectors).toHaveLength(steps.length + 1)
  let level = startValue
  const yOf = (value: number) => zero.y - value / scale
  ;[...steps, ["end", 0] as const].forEach(([name, value], i) => {
    const bar = boxOf(bars[i + 1]!)
    const from = level
    level += value
    near(connectors[i]!.y + connectors[i]!.h / 2, yOf(from), `connector into ${name}`)
    expect(connectors[i]!.x, `connector into ${name}`).toBe(right(boxOf(bars[i]!)))
    expect(right(connectors[i]!), `connector into ${name}`).toBe(bar.x)
    if (name === "end") return
    near(bar.y, yOf(Math.max(from, level)), `${name} top`)
    near(bottom(bar), yOf(Math.min(from, level)), `${name} bottom`)
  })
})
