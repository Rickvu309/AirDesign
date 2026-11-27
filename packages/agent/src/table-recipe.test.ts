import * as doom from "@airdesign/doom"
import { expect } from "vitest"

import { drawsInEveryStyle, type Data, charsOf, sampleOf } from "./testing/chart-recipe.js"

const variants: Readonly<Record<string, Data>> = {
  sample: { rows: sampleOf("table", "rows"), focus: sampleOf("table", "focus") },
  "3 rows": {
    rows: [
      ["Region", "Stores", "Sales, $M"],
      ["North", "212", "940.0"],
      ["South", "130", "377.5"],
      ["West", "18", "12.0"],
      ["Total", "360", "1,329.5"],
    ],
    focus: "South",
  },
  "10 rows": {
    rows: [
      ["Market", "Stores", "Sales, $M", "Growth"],
      ...["France", "Germany", "Spain", "Italy", "Poland", "Sweden", "Norway"].map((name, i) => [
        name,
        String(40 + i * 7),
        (120 - i * 9.5).toFixed(1),
        `${String(12 - i)}%`,
      ]),
      ["Total", "715", "772.5", "7%"],
    ],
    focus: "Poland",
  },
  "long labels": {
    rows: [
      ["Segment", "FY25, $M", "FY26, $M"],
      ["Public sector and education", "2.4", "2.9"],
      ["Large enterprise accounts", "15.8", "18.6"],
      ["Small and medium business", "7.6", "7.9"],
      ["Total", "25.8", "29.4"],
    ],
    focus: "Large enterprise accounts",
  },
}

drawsInEveryStyle("table", variants, (fold, chart, data) => {
  const rows = data.rows as readonly (readonly string[])[]
  const focus = rows.findIndex((row) => row[0] === data.focus)
  expect(focus).toBeGreaterThan(0)
  const colour = (node: doom.Node) => {
    const color = doom.propOf(node, "text")?.spans[0]?.color
    return typeof color === "object" ? color.var : color
  }
  const cells = doom.childrenOf(fold, chart.id).filter((node) => charsOf(node) !== "")
  const lit = cells.filter((node) => colour(node) === "accent1").map(charsOf)
  expect(lit).toEqual(rows[focus]!.filter((cell) => cell !== ""))
  expect(cells.map(charsOf)).toEqual(rows.flat())
  rows.slice(1).forEach((row, r) =>
    row.forEach((words, c) => {
      const text = doom.propOf(cells[(r + 1) * row.length + c]!, "text")!
      expect(text.paras[0]?.align, words).toBe(c === 0 ? undefined : "right")
      expect(text.spans[0]?.bold, words).toBe(c === 0 || r === rows.length - 2)
    }),
  )
})
