---
name: waterfall
description: "Before you draw a waterfall chart to walk from one total to another through the steps between, read the script for floating bars."
---

# Waterfall chart

A bridge from a starting total to an ending total through the steps that moved it: last year's profit to this year's by driver, a budget to the forecast. Each step floats at the running total, so the reader sees how much each driver added or took away. Draw it yourself from rectangles and text; this guide gives the arithmetic.

## When

- One total that changed, and 3 to 10 named drivers that explain the change.
- Each driver is one signed number in the total's unit. Values that are not parts of one change go on a `charts/bar`.

## The rules

- The first bar is the starting total and the last bar the ending total, both standing on the zero line. The script computes the ending total as the start plus every step, so the bridge always adds up.
- Each step floats from the running total before it to the running total after it.
- Colours carry meaning only: steps up are `positive`, steps down are `negative`, the two totals are `total`.
- A thin rule joins each bar to the next at the running total, so the eye can follow the level across.
- Label the data: every value sits above its bar, steps with their sign ("+64", "−12", with a true minus), totals without one and in bold. No value axis, no gridlines.
- Order the steps the way the story runs, usually the largest effects first. Group the small ones as "Other" just before the ending total.
- The unit lives once, in the header above the chart: "Operating profit, FY25 to FY26, $M". Values are bare numbers at one precision.

## The script

Change the seven values at the top: the slide, the chart's box on the slide, the header, the starting total, the steps, the ending total's name and how a value reads.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 620 }
const header = "**Operating profit**, FY25 to FY26, $M"
const first = ["FY25", 412]
const steps = [
  ["Volume", 64],
  ["Price", 38],
  ["Mix", -12],
  ["Input costs", -71],
  ["Productivity", 45],
  ["Currency", -9],
]
const last = "FY26"
const shown = (value) => `${value}`

const { sizes } = variables({})
const wide = (words, size) => Math.ceil(words.replaceAll("*", "").length * size * 0.56)
const signed = (value) => (value >= 0 ? `+${shown(value)}` : `−${shown(-value)}`)
let level = first[1]
const bars = [
  { name: first[0], from: 0, to: level, fill: "total", text: `**${shown(level)}**` },
  ...steps.map(([name, value]) => {
    const from = level
    level += value
    return { name, from, to: level, fill: value >= 0 ? "positive" : "negative", text: signed(value) }
  }),
  { name: last, from: 0, to: level, fill: "total", text: `**${shown(level)}**` },
]
const lineH = Math.ceil(sizes.body2 * 1.4)
const slot = box.w / bars.length
const lines = bars.some(({ name }) => wide(name, sizes.body2) > slot - 8) ? 2 : 1
const nameH = lines * lineH
const low = Math.min(0, ...bars.map(({ to }) => to))
const high = Math.max(...bars.map(({ from, to }) => Math.max(from, to)))
const plotTop = 64 + lineH + 12
const plotBottom = box.h - nameH - 16
const yOf = (value) => plotBottom - Math.round(((value - low) * (plotBottom - plotTop)) / (high - low))
const thick = Math.min(120, Math.round(slot * 0.6))
const xOf = (i) => Math.round(i * slot + (slot - thick) / 2)

const chart = insert({ parent: slide, kind: "frame", layout: "none", name: "Waterfall chart", box })
insert({
  parent: chart,
  kind: "text",
  name: "Header",
  textStyle: "body2",
  text: header,
  box: { x: 0, y: 0, w: box.w, h: 40 },
})
bars.forEach(({ name, from, to, fill, text }, i) => {
  const top = yOf(Math.max(from, to))
  const h = Math.max(2, yOf(Math.min(from, to)) - top)
  const left = Math.round(i * slot)
  const w = Math.round((i + 1) * slot) - left
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Bar",
    radius: 0,
    fill,
    box: { x: xOf(i), y: top, w: thick, h },
  })
  insert({
    parent: chart,
    kind: "text",
    name: "Value",
    padding: 0,
    textStyle: "body2",
    text,
    align: "center",
    box: { x: left, y: top - 8 - lineH, w, h: lineH },
  })
  insert({
    parent: chart,
    kind: "text",
    name: "Name",
    padding: { t: 0, r: 4, b: 0, l: 4 },
    textStyle: "body2",
    color: "text2",
    text: name,
    align: "center",
    alignV: "top",
    box: { x: left, y: plotBottom + 16, w, h: nameH },
  })
  if (i === 0) return
  const y = yOf(bars[i - 1].to)
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Connector",
    radius: 0,
    fill: "text",
    opacity: 0.4,
    box: { x: xOf(i - 1) + thick, y: y - 1, w: xOf(i) - xOf(i - 1) - thick, h: 2 },
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
  box: { x: 0, y: yOf(0), w: box.w, h: 2 },
})
get({ target: chart }).problems
```

## After the script

- `problems` is empty, or a step's name needs fewer words.
- The ending total is the number the title quotes. If it is not, a step is missing or wrong.
- A source line sits below the chart, at y 990.
