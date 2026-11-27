# Column chart

Vertical columns over periods: quarters, months, years. Draw it yourself from rectangles and text; this guide gives the arithmetic. `kit/column-chart` is the same chart drawn on sample data, to copy and look at.

## When

- One number over 3 to 12 periods, in time order. Above 12 periods, draw a `charts/line`.
- Items that are not time go on a `charts/bar`, ranked.
- Values of zero or more.

## The rules

- Periods run left to right, oldest first. Never sort them.
- Columns start at zero on one baseline, and the tallest column takes the whole height: height = value / largest × plot height.
- Value labels sit just above each column, so no value axis and no gridlines.
- Each period's name sits under its column, centred in the column's slot, in up to two lines. Never turn a name on its side: shorten it instead, "Q1 25" rather than "First quarter 2025", or name the year once in the header.
- The gap between columns is smaller than a column: a column takes 60% of its slot, 120 px at most.
- One column in `accent1`, the period the title talks about, often the latest, with its value in bold. The others are `text` at 20% opacity. Mark an estimate in its name: "2027E".
- The header above the chart names what is measured and the unit: "Revenue, $M".
- One precision for all values.

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
const shown = (value) => `$${value}M`

const largest = Math.max(...rows.map(([, value]) => value))
const nameH = 72
const base = box.h - nameH - 16
const plotTop = 128
const slot = box.w / rows.length
const wide = Math.min(120, Math.round(slot * 0.6))
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
  const h = Math.round(((base - plotTop) * value) / largest)
  const lit = name === accent
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Column",
    radius: 0,
    ...(lit ? { fill: "accent1" } : muted),
    box: { x: x + Math.round((w - wide) / 2), y: base - h, w: wide, h },
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
    padding: 0,
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
