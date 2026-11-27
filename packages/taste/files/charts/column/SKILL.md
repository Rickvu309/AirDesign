---
name: column
description: "Before you draw a column chart to compare periods, read the script for vertical columns."
---

# Column chart

Vertical columns over periods: quarters, months, years. Draw it yourself from rectangles and text; this guide gives the arithmetic.

## When

- One number over 3 to 12 periods, in time order. Above 12 periods, draw a `charts/line`.
- Items that are not time go on a `charts/bar`, ranked. Parts of each period's total go on a `charts/stacked-column`.
- Values of zero or more.

## The rules

- Periods run left to right, oldest first. Never sort them.
- Columns start at one zero line and the tallest column takes the whole height: height = value / largest × plot height.
- Label the data: each value sits just above its column, so there is no value axis and no gridlines.
- Each period's name sits under its column, centred in the column's slot, in up to two lines. Never turn a name on its side: shorten it instead, "Q1 25" rather than "First quarter 2025", or name the year once in the header.
- A column takes 60% of its slot, 120 px at most, so the gaps stay smaller than the columns.
- One column in `accent1`, the period the title talks about, often the latest, with its value in bold. The others are `text` at 20% opacity. Mark an estimate in its name: "2027E".
- The unit lives once, in the header above the chart: "Revenue, $M". Values are bare numbers at one precision.

## The script

Change the six values at the top: the slide, the chart's box on the slide, the header, the periods in order, the period to accent and how a value reads.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 620 }
const header = "**Revenue**, $M"
const rows = [
  ["Q1 25", 38],
  ["Q2 25", 41],
  ["Q3 25", 43],
  ["Q4 25", 46],
  ["Q1 26", 48],
  ["Q2 26", 52],
  ["Q3 26", 55],
  ["Q4 26", 59],
]
const accent = "Q4 26"
const shown = (value) => `${value}`

const { sizes } = variables({})
const wide = (words, size) => Math.ceil(words.replaceAll("*", "").length * size * 0.56)
const largest = Math.max(...rows.map(([, value]) => value))
const slot = box.w / rows.length
const lines = rows.some(([name]) => wide(name, sizes.body2) > slot - 8) ? 2 : 1
const nameH = Math.ceil(lines * sizes.body2 * 1.4)
const base = box.h - nameH - 16
const plotTop = 128
const thick = Math.min(120, Math.round(slot * 0.6))
const muted = { fill: "text", opacity: 0.2 }

const chart = insert({ parent: slide, kind: "frame", layout: "none", name: "Column chart", box })
insert({
  parent: chart,
  kind: "text",
  name: "Header",
  textStyle: "body2",
  text: header,
  box: { x: 0, y: 0, w: box.w, h: 40 },
})
rows.forEach(([name, value], i) => {
  const x = Math.round(i * slot)
  const w = Math.round((i + 1) * slot) - x
  const h = Math.max(2, Math.round(((base - plotTop) * value) / largest))
  const lit = name === accent
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Column",
    radius: 0,
    ...(lit ? { fill: "accent1" } : muted),
    box: { x: x + Math.round((w - thick) / 2), y: base - h, w: thick, h },
  })
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Value",
    padding: 0,
    textStyle: "body2",
    text: lit ? `**${shown(value)}**` : shown(value),
    align: "center",
    alignV: "bottom",
    box: { x, y: base - h - 60, w, h: 48 },
  })
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Name",
    padding: { t: 0, r: 4, b: 0, l: 4 },
    textStyle: "body2",
    color: "text2",
    text: name,
    align: "center",
    alignV: "top",
    box: { x, y: base + 16, w, h: nameH },
  })
})
insert({
  parent: chart,
  kind: "shape",
  shape: "rect",
  name: "Zero line",
  radius: 0,
  fill: "text",
  opacity: 0.4,
  box: { x: 0, y: base, w: box.w, h: 2 },
})
get({ target: chart }).problems
```

## After the script

- `problems` is empty, or a period's name needs fewer words.
- Read the title again: the accented column is the period it talks about.
- A source line sits below the chart, at y 990.
