---
name: bar
description: "Before you draw a bar chart to rank items, read the script for horizontal bars."
---

# Bar chart

Horizontal bars ranked from largest to smallest: a ranking, market shares, a comparison of items that are not time. Draw it yourself from rectangles and text; this guide gives the arithmetic.

## When

- Items with names, compared by one number. Never time: periods go on a `charts/column` or `charts/line`.
- 3 to 10 bars. Above 10, keep the top 9 and sum the rest into "Other", or show a table.
- Values of zero or more. A chart with losses is a `charts/waterfall` or a column chart with bars below a zero line.

## The rules

- Rank the bars from largest to smallest. "Other" goes last, whatever its size.
- Bars start at a zero line and the longest bar takes the whole track: length = value / largest × track.
- Label the data: each value sits just after its bar's end, so there is no value axis and no gridlines.
- Names sit left of the bars on one line, right-aligned to one edge. The name column is as wide as the longest name, up to 40% of the chart. A longer name needs fewer words.
- A bar takes 60% of its row, 64 px at most, so the gaps stay smaller than the bars.
- One bar in `accent1`, the one the title talks about, with its value in bold. The others are `text` at 20% opacity. With no single point, every bar is `accent1`.
- The unit lives once, in the header above the chart: "Revenue by market, $M". Values are bare numbers at one precision: whole numbers, or one decimal when the values are under 10.

## The script

Change the six values at the top: the slide, the chart's box on the slide, the header, the rows, the name to accent and how a value reads. The rest does the arithmetic and reads the deck's text sizes.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 620 }
const header = "**Revenue by market**, $M"
const rows = [
  ["France", 268],
  ["Germany", 412],
  ["Spain", 164],
  ["United Kingdom", 231],
  ["Italy", 120],
  ["Other", 96],
]
const accent = "Germany"
const shown = (value) => `${value}`

const { sizes } = variables({})
const wide = (words, size) => Math.ceil(words.replaceAll("*", "").length * size * 0.56)
const ranked = rows.toSorted((a, b) => (a[0] === "Other") - (b[0] === "Other") || b[1] - a[1])
const largest = Math.max(...ranked.map(([, value]) => value))
const top = 72
const nameW = Math.min(Math.round(box.w * 0.4), Math.max(...ranked.map(([name]) => wide(name, sizes.body2))))
const valueW = Math.ceil(Math.max(...ranked.map(([, value]) => wide(`**${shown(value)}**`, sizes.body2))) * 1.4) + 8
const barX = nameW + 24
const track = box.w - barX - 16 - valueW
const row = (box.h - top) / ranked.length
const thick = Math.min(64, Math.round(row * 0.6))
const muted = { fill: "text", opacity: 0.2 }

const chart = insert({ parent: slide, kind: "frame", layout: "none", name: "Bar chart", box })
insert({
  parent: chart,
  kind: "text",
  name: "Header",
  textStyle: "body2",
  text: header,
  box: { x: 0, y: 0, w: box.w, h: 40 },
})
ranked.forEach(([name, value], i) => {
  const y = Math.round(top + i * row)
  const h = Math.round(top + (i + 1) * row) - y
  const w = Math.max(2, Math.round((track * value) / largest))
  const lit = name === accent
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Name",
    padding: 0,
    textStyle: "body2",
    text: name,
    align: "right",
    alignV: "center",
    box: { x: 0, y, w: nameW, h },
  })
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Bar",
    radius: 0,
    ...(lit ? { fill: "accent1" } : muted),
    box: { x: barX, y: y + Math.round((h - thick) / 2), w, h: thick },
  })
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Value",
    padding: 0,
    textStyle: "body2",
    text: lit ? `**${shown(value)}**` : shown(value),
    align: "left",
    alignV: "center",
    box: { x: barX + w + 16, y, w: box.w - barX - w - 16, h },
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
  box: { x: barX - 2, y: top, w: 2, h: box.h - top },
})
get({ target: chart }).problems
```

## After the script

- `problems` is empty, or a name needs fewer words.
- Read the title again: the accented bar is the one it talks about.
- A source line sits below the chart, at y 990.
