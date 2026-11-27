---
name: line
description: "Before you draw a line chart to show a trend over many periods or a test against its control, read the script for ticks, end labels and the intervention marker."
---

# Line chart

One or a few series over many periods: a trend, a share over time, our number against the market's, or a test group against its control after a change. Draw it yourself from paths, rectangles and text; this guide gives the arithmetic.

## When

- A number over 6 periods or more, in time order. With fewer, draw a `charts/column`.
- 1 to 3 series. With more, keep ours and the one comparison the title needs, or make two slides.
- A claim that a change caused a lift: draw the test group and a matched control that did not get the change, and mark the date the change started. Without a control, the title says the number rose, not that the change raised it.

## The rules

- The scale starts at zero, or below zero when a value is negative. Ticks fall on nice steps, 1, 2, 2.5 or 5 times a power of ten, four or five of them, and the top tick is the first one at or above the largest value. Tick labels carry the step's decimals and no more: 0, 2, 4, 6 or 0, 2.5, 5, 7.5.
- Light gridlines at each tick, the zero line darker. Tick labels sit left of the plot, right-aligned.
- Name each series at its line's end, with its last value in bold. No legend. When two end labels would touch, the lower one moves down until they clear. With a gap label between two series, the upper label moves up and the lower one down to make room for it.
- The series the title talks about, the test group, goes first: `accent1` at 4 px. The others, the control among them, are `text` at 40% opacity, 3 px.
- With two series, a bracket in `accent1` joins their last points and the gap between them is labelled beside it, with its sign: "+2.2 pts".
- The intervention is a dashed vertical marker at its period, named above the plot: "Pilot starts". The lines before it should run close together; if they do not, the control is not a match.
- Period names sit under the plot. When they do not fit side by side, name every second or third period, always the first and the last. Never turn them on their side.
- Mark estimates in the period's name: "2027E".
- The header above the chart names what is measured and the unit: "Store conversion rate, %".

## The script

Change the eight values at the top: the slide, the chart's box on the slide, the header, the period names, the series with the one to accent first, the marker (or `null` for none), how a value reads and how the gap reads.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 620 }
const header = "**Store conversion rate**, %"
const periods = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10", "W11", "W12"]
const series = [
  ["Pilot stores", [3.1, 3.0, 3.2, 3.1, 3.2, 3.1, 3.9, 4.2, 4.3, 4.4, 4.3, 4.5]],
  ["Control stores", [3.0, 3.1, 3.1, 3.0, 3.2, 3.1, 3.2, 3.3, 3.2, 3.3, 3.2, 3.3]],
]
const marker = { at: "W7", text: "Pilot starts" }
const shown = (value) => value.toFixed(1)
const gapShown = (gap) => `${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)} pts`

const { sizes } = variables({})
const wide = (words, size) => Math.ceil(words.replaceAll("*", "").length * size * 0.56)
const lineH = Math.ceil(sizes.body2 * 1.4)
const values = series.flatMap(([, line]) => line)
const rough = (Math.max(...values) - Math.min(0, ...values)) / 4
const power = 10 ** Math.floor(Math.log10(rough))
const step = [1, 2, 2.5, 5, 10].find((each) => each * power >= rough) * power
const low = Math.min(0, Math.floor(Math.min(...values) / step) * step)
const high = Math.ceil(Math.max(...values) / step) * step
const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + i * step)
const places = (`${+step.toPrecision(6)}`.split(".")[1] ?? "").length
const tickW = Math.max(...ticks.map((tick) => wide(tick.toFixed(places), sizes.caption))) + 8
const labelOf = ([name, line]) => `**${shown(line.at(-1))}** ${name}`
const endW = Math.min(Math.round(box.w * 0.3), Math.max(...series.map((each) => wide(labelOf(each), sizes.body2))))
const plotY = marker === null ? 72 : 72 + lineH + 16
const plot = { x: tickW + 24, y: plotY, w: box.w - tickW - 24 - 40 - endW, h: box.h - plotY - 72 }
const xOf = (i) => (plot.w * i) / (periods.length - 1)
const yOf = (value) => (plot.h * (high - value)) / (high - low)
const every = Math.ceil(
  Math.max(96, ...periods.map((name) => wide(name, sizes.caption) + 16)) / (plot.w / (periods.length - 1)),
)

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
    text: tick.toFixed(places),
    align: "right",
    alignV: "center",
    box: { x: 0, y: y - 18, w: tickW, h: 36 },
  })
})
periods.forEach((name, i) => {
  if (i % every !== 0 && i !== periods.length - 1) return
  if (i !== periods.length - 1 && periods.length - 1 - i < every) return
  const w = Math.max(96, wide(name, sizes.caption) + 16)
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
    box: { x: plot.x + Math.round(xOf(i) - w / 2), y: plot.y + plot.h + 16, w, h: 40 },
  })
})
if (marker !== null) {
  if (!periods.includes(marker.at)) throw new Error(`The marker's period ${marker.at} is not in periods`)
  const x = plot.x + Math.round(xOf(periods.indexOf(marker.at)))
  const w = wide(marker.text, sizes.caption) + 16
  insert({
    parent: chart,
    kind: "path",
    name: "Marker",
    d: "M0.5 0 L0.5 1",
    fill: "none",
    stroke: "text2",
    strokeWidth: 2,
    dash: "dash",
    box: { x: x - 1, y: plot.y, w: 2, h: plot.h },
  })
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Marker label",
    padding: 0,
    textStyle: "caption",
    color: "text2",
    text: marker.text,
    align: "center",
    alignV: "bottom",
    box: {
      x: Math.max(plot.x, Math.min(x - Math.round(w / 2), plot.x + plot.w - w)),
      y: plot.y - 12 - lineH,
      w,
      h: lineH,
    },
  })
}
series.toReversed().forEach(([, line], r) => {
  const lit = r === series.length - 1
  const d = line
    .map((value, i) => `${i === 0 ? "M" : "L"}${(xOf(i) / plot.w).toFixed(4)} ${(yOf(value) / plot.h).toFixed(4)}`)
    .join(" ")
  const ink = lit ? { stroke: "accent1", strokeWidth: 4 } : { stroke: "text", strokeWidth: 3, opacity: 0.4 }
  insert({ parent: chart, kind: "path", name: "Series", d, fill: "none", ...ink, box: plot })
  insert({
    parent: chart,
    kind: "shape",
    shape: "ellipse",
    name: "End",
    ...(lit ? { fill: "accent1" } : { fill: "text", opacity: 0.4 }),
    box: { x: plot.x + plot.w - 7, y: plot.y + Math.round(yOf(line.at(-1))) - 7, w: 14, h: 14 },
  })
})
const ends = series.map(([, line]) => plot.y + Math.round(yOf(line.at(-1))))
const tall = (text) => Math.ceil((wide(text, sizes.body2) * 1.15) / endW) * lineH
const labels = series.map((each, i) => ({ name: "Label", text: labelOf(each), y: ends[i] }))
const placed = []
if (series.length === 2) {
  const [top, bottom] = [Math.min(...ends), Math.max(...ends)]
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Gap",
    radius: 0,
    fill: "accent1",
    box: { x: box.w - endW - 18, y: top, w: 2, h: Math.max(2, bottom - top) },
  })
  const gap = {
    name: "Gap label",
    text: `**${gapShown(series[0][1].at(-1) - series[1][1].at(-1))}**`,
    color: "accent1",
  }
  const middle = Math.round((top + bottom) / 2 - lineH / 2)
  const [upper, lower] = labels.toSorted((a, b) => a.y - b.y)
  const upperH = tall(upper.text)
  placed.push(
    { ...upper, top: Math.min(upper.y - Math.round(upperH / 2), middle - 4 - upperH), h: upperH, alignV: "bottom" },
    { ...gap, top: middle, h: lineH },
    {
      ...lower,
      top: Math.max(lower.y - Math.round(tall(lower.text) / 2), middle + lineH + 4),
      h: tall(lower.text),
      alignV: "top",
    },
  )
} else {
  let below = -Infinity
  labels
    .toSorted((a, b) => a.y - b.y)
    .forEach((label) => {
      const h = tall(label.text)
      const top = Math.max(label.y - Math.round(h / 2), below + 4)
      below = top + h
      placed.push({ ...label, top, h, alignV: "top" })
    })
}
placed.forEach(({ name, text, color, top, h, alignV = "center" }) =>
  insert({
    parent: chart,
    kind: "text",
    name,
    padding: 0,
    textStyle: "body2",
    ...(color === undefined ? {} : { color }),
    text,
    align: "left",
    alignV,
    box: { x: box.w - endW, y: top, w: endW, h },
  }),
)
get({ target: chart }).problems
```

## After the script

- `problems` is empty, or a series name needs fewer words.
- Read the title again: the accented line is the series it talks about, and a causal title has its control and marker on the chart.
- A source line sits below the chart, at y 990.
