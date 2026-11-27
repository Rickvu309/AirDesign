---
name: line
description: "The arithmetic for a line chart: nice ticks, series named at their ends."
---

# Line chart

One or a few series over many periods: a trend, a share over time, our number against the market's. Draw it yourself from a path, rectangles and text; this guide gives the arithmetic. `kit/line-chart` is the same chart drawn on sample data, to copy and look at.

## When

- A number over 6 periods or more, in time order. With fewer, draw a `charts/column`.
- 1 to 3 series. With more, keep ours and the one comparison the title needs, or make two slides.

## The rules

- The scale starts at zero, or below zero when a value is negative. Ticks fall on nice steps, 1, 2, 2.5 or 5 times a power of ten, four or five of them, and the top tick is the first one at or above the largest value.
- Light gridlines at each tick, the zero line darker. Tick labels sit left of the plot, right-aligned.
- Each series is named at its line's end, with its last value in bold. No legend. When two end labels would touch, the lower one moves down until they clear.
- The series the title talks about is `accent1` at 4 px. Others are `text` at 40% opacity, 3 px.
- Period names sit under the plot. When they do not fit side by side, name every second or third period, always the first and the last. Never turn them on their side.
- Mark estimates in the period's name: "2027E".
- The header above the chart names what is measured and the unit: "Like-for-like sales growth, %".

## The script

Change the six values at the top: the slide, the chart's box on the slide, the header, the period names, the series with the one to accent first, and how a value reads.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 620 }
const header = "**Like-for-like sales growth**, %"
const periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const series = [
  ["Our stores", [1.2, 1.8, 2.6, 3.9, 4.8, 5.1, 5.6, 5.2, 5.9, 6.1, 6.4, 6.8]],
  ["Market", [1.5, 1.9, 2.1, 2.4, 2.2, 2.6, 2.9, 2.7, 3.0, 3.1, 2.8, 3.2]],
]
const shown = (value) => `${value.toFixed(1)}%`

const values = series.flatMap(([, line]) => line)
const rough = (Math.max(...values) - Math.min(0, ...values)) / 4
const power = 10 ** Math.floor(Math.log10(rough))
const step = [1, 2, 2.5, 5, 10].find((each) => each * power >= rough) * power
const low = Math.min(0, Math.floor(Math.min(...values) / step) * step)
const high = Math.ceil(Math.max(...values) / step) * step
const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + i * step)
const tickW = 88
const endW = 240
const plot = { x: tickW + 24, y: 96, w: box.w - tickW - 24 - endW, h: box.h - 96 - 72 }
const xOf = (i) => (plot.w * i) / (periods.length - 1)
const yOf = (value) => (plot.h * (high - value)) / (high - low)
const every = Math.ceil(96 / (plot.w / (periods.length - 1)))

const chart = insert({ parent: slide, kind: "frame", layout: "none", name: "Line chart", box })
insert({
  parent: chart,
  kind: "text",
  name: "Header",
  textStyle: "body2",
  text: header,
  box: { x: 0, y: 0, w: box.w, h: 40 },
})
ticks.forEach((tick) => {
  const y = plot.y + Math.round(yOf(tick))
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Gridline",
    radius: 0,
    fill: "text",
    opacity: tick === 0 ? 0.4 : 0.12,
    box: { x: plot.x, y: y - 1, w: plot.w, h: 2 },
  })
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Tick",
    padding: 0,
    textStyle: "caption",
    color: "text2",
    text: shown(tick).replace(".0", ""),
    align: "right",
    alignV: "center",
    box: { x: 0, y: y - 18, w: tickW, h: 36 },
  })
})
periods.forEach((name, i) => {
  if (i % every !== 0 && i !== periods.length - 1) return
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Period",
    padding: 0,
    textStyle: "caption",
    color: "text2",
    text: name,
    align: "center",
    alignV: "top",
    box: { x: plot.x + Math.round(xOf(i)) - 48, y: plot.y + plot.h + 16, w: 96, h: 40 },
  })
})
series.toReversed().forEach(([, line], r) => {
  const lit = r === series.length - 1
  const d = line
    .map((value, i) => `${i === 0 ? "M" : "L"}${(xOf(i) / plot.w).toFixed(4)} ${(yOf(value) / plot.h).toFixed(4)}`)
    .join(" ")
  const ink = lit ? { stroke: "accent1", strokeWidth: 4 } : { stroke: "text", strokeWidth: 3, opacity: 0.4 }
  insert({ parent: chart, kind: "path", name: "Series", d, fill: "none", ...ink, box: plot })
  const end = { x: plot.x + plot.w - 7, y: plot.y + Math.round(yOf(line.at(-1))) - 7, w: 14, h: 14 }
  insert({
    parent: chart,
    kind: "shape",
    shape: "ellipse",
    name: "End",
    ...(lit ? { fill: "accent1" } : { fill: "text", opacity: 0.4 }),
    box: end,
  })
})
let below = -Infinity
series
  .map(([name, line]) => ({ name, last: line.at(-1), y: plot.y + Math.round(yOf(line.at(-1))) }))
  .toSorted((a, b) => a.y - b.y)
  .forEach(({ name, last, y }) => {
    const top = Math.max(y - 64, below + 8)
    below = top + 128
    insert({
      parent: chart,
      kind: "shape",
      fill: "none",
      name: "Label",
      padding: 0,
      textStyle: "body2",
      text: `**${shown(last)}**\n${name}`,
      align: "left",
      alignV: "center",
      box: { x: plot.x + plot.w + 24, y: top, w: endW - 24, h: 128 },
    })
  })
get({ target: chart }).problems
```

## After the script

- `problems` is empty, or a series name needs fewer words.
- Read the title again: the accented line is the series it talks about.
- A source line sits below the chart, at y 990.
