import * as doom from "@airdesign/doom"
import { expect } from "vitest"

import {
  drawsInEveryStyle,
  type Box,
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
  const paths = stack.map(([name]) => named(fold, chart, name))
  for (const path of paths) expect(path).toHaveLength(1)
  const rects = paths.map(([path]) => {
    const at = boxOf(path!)
    const d = (doom.propOf(path!, "geometry") as { d: string }).d
    return [...d.matchAll(/M(\S+) (\S+) L(\S+) \S+ L\S+ (\S+) L\S+ \S+ Z/g)].map(([, x, y, r, b]) => ({
      x: at.x + Number(x) * at.w,
      y: at.y + Number(y) * at.h,
      w: (Number(r) - Number(x)) * at.w,
      h: (Number(b) - Number(y)) * at.h,
    }))
  })
  for (const part of rects) expect(part).toHaveLength(periods.length)
  const values = named(fold, chart, "Segment value")
  const scale = Math.max(...totals) / (zero.y - Math.min(...rects.flat().map((rect) => rect.y)))
  periods.forEach((period, i) => {
    let level = zero.y
    let sum = 0
    stack.forEach(([name, numbers], k) => {
      const box = rects[k]![i]!
      const part = `${period} ${name}`
      sum += numbers[i]!
      near(level - bottom(box), k === 0 ? 0 : 2, part)
      near(box.y, zero.y - sum / scale, part)
      level = box.y
      const label = values.find((value) => near2(boxOf(value), box))
      if (label !== undefined) expect(charsOf(label), part).toBe(String(numbers[i]))
    })
    near((zero.y - level) * scale, totals[i]!, `${period} total`)
    const total = boxOf(named(fold, chart, "Total")[i]!)
    expect(bottom(total), period).toBeLessThanOrEqual(level + 1)
  })
  expect(paths.map(([path]) => fillOf(path!) === "accent1")).toEqual(stack.map(([name]) => name === data.accent))
})

const near2 = (a: Box, b: Box) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1
