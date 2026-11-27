---
name: stacked-column
description: "Before you draw a stacked column chart to split each period's total into parts, read the script for stacked columns."
---

# Stacked column chart

Columns over periods, each split into the parts that make its total: revenue by product line per year, headcount by function per quarter. It shows two things at once, the total's path and the mix under it. Draw it yourself from one shape per part and text; this guide gives the arithmetic.

## When

- A total over 3 to 10 periods, in time order, where the message is about one part or about the mix shifting under the total.
- 2 to 5 parts. Above 5, keep the 4 that matter and sum the rest into "Other", on top.
- Values of zero or more. A single total over time is a `charts/column`; steps from one total to another are a `charts/waterfall`.

## The rules

- Every column stacks the parts in the same order. The part the title talks about sits at the bottom, on the zero line, so its growth reads against a flat base. "Other" goes on top.
- Height = value / largest total × plot height, so each column is exactly as tall as its total and the segments add up to it.
- Label the data: each segment's value sits inside it when it fits, and each column's total sits above it. No value axis, no gridlines.
- Name the parts once, beside the latest column, level with their segments. No legend.
- One part in `accent1`, the one the title talks about, named in bold. The other parts are `text` at falling opacity, lighter towards the top, split by a 2 px gap, so they stay grey in a light or a dark style. Values sit on the part in `text`, or `background` on the accent.
- The unit lives once, in the header above the chart: "Revenue by product line, $M". Values are bare numbers at one precision, and each total equals the sum of its parts as shown.

## The script

Change the seven values at the top: the slide, the chart's box on the slide, the header, the periods, the parts with their value per period, the part to accent and how a value reads.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 620 }
const header = "**Revenue by product line**, $M"
const periods = ["2022", "2023", "2024", "2025", "2026E"]
const parts = [
  ["Cloud", [12, 21, 33, 46, 60]],
  ["Licences", [41, 39, 36, 32, 29]],
  ["Services", [18, 19, 20, 21, 22]],
  ["Support", [9, 10, 10, 11, 11]],
]
const accent = "Cloud"
const shown = (value) => `${value}`

const { sizes } = variables({})
const wide = (words, size) => Math.ceil(words.replaceAll("*", "").length * size * 0.56)
const shades = [0.38, 0.28, 0.19, 0.1]
const stack = parts
  .toSorted((a, b) => (b[0] === accent) - (a[0] === accent))
  .map(([name, values], k, all) => {
    const shade = shades[all.slice(0, k).filter(([other]) => other !== accent).length]
    const look = name === accent ? { fill: "accent1" } : { fill: "text", opacity: shade }
    return { name, values, look, ink: name === accent ? "background" : "text" }
  })
const totals = periods.map((_, i) => stack.reduce((sum, part) => sum + part.values[i], 0))
const lineH = Math.ceil(sizes.body2 * 1.4)
const partW = Math.min(Math.round(box.w * 0.25), Math.max(...stack.map(({ name }) => wide(`**${name}**`, sizes.body2))))
const plotW = box.w - partW - 24
const slot = plotW / periods.length
const lines = periods.some((name) => wide(name, sizes.body2) > slot - 8) ? 2 : 1
const nameH = lines * lineH
const base = box.h - nameH - 16
const plotTop = 64 + lineH + 12
const scale = (base - plotTop) / Math.max(...totals)
const thick = Math.min(140, Math.round(slot * 0.6))
const fits = (words, w, h) => h >= Math.ceil(sizes.caption * 1.4) && wide(words, sizes.caption) <= w - 8

const chart = insert({ parent: slide, kind: "frame", layout: "none", name: "Stacked column chart", box })
const lastRight = Math.round((periods.length - 1) * slot) + Math.round((slot + thick) / 2)
const plot = { x: 0, y: 0, w: lastRight, h: base }
const corner = (x, y) => `${((x - plot.x) / plot.w).toFixed(5)} ${((y - plot.y) / plot.h).toFixed(5)}`
const cells = periods.map((_, i) => {
  const left = Math.round(i * slot)
  const x = left + Math.round((Math.round((i + 1) * slot) - left - thick) / 2)
  let sum = 0
  return stack.map((part, k) => {
    const below = base - Math.round(sum * scale)
    sum += part.values[i]
    const top = base - Math.round(sum * scale)
    return { x, y: top, w: thick, h: Math.max(1, below - top - (k === 0 ? 0 : 2)), mid: Math.round((top + below) / 2) }
  })
})
stack.forEach((part, k) => {
  const d = cells
    .map((column) => column[k])
    .map(({ x, y, w, h }) => `M${corner(x, y)} L${corner(x + w, y)} L${corner(x + w, y + h)} L${corner(x, y + h)} Z`)
    .join(" ")
  insert({ parent: chart, kind: "path", name: part.name, d, ...part.look, box: plot })
})
insert({
  parent: chart,
  kind: "text",
  name: "Header",
  textStyle: "body2",
  text: header,
  box: { x: 0, y: 0, w: box.w, h: 40 },
})
periods.forEach((period, i) => {
  const left = Math.round(i * slot)
  const w = Math.round((i + 1) * slot) - left
  stack.forEach((part, k) => {
    const { mid, ...cell } = cells[i][k]
    const words = shown(part.values[i])
    if (fits(words, thick, cell.h))
      insert({
        parent: chart,
        kind: "shape",
        fill: "none",
        name: "Segment value",
        padding: 0,
        textStyle: "caption",
        color: part.ink,
        text: words,
        box: cell,
      })
  })
  insert({
    parent: chart,
    kind: "text",
    name: "Total",
    padding: 0,
    textStyle: "body2",
    text: shown(totals[i]),
    align: "center",
    box: { x: left, y: cells[i].at(-1).y - 8 - lineH, w, h: lineH },
  })
  insert({
    parent: chart,
    kind: "text",
    name: "Name",
    padding: { t: 0, r: 4, b: 0, l: 4 },
    textStyle: "body2",
    color: "text2",
    text: period,
    align: "center",
    alignV: "top",
    box: { x: left, y: base + 16, w, h: nameH },
  })
})
const mids = cells.at(-1).map(({ mid }) => mid)
let below = box.h
stack
  .map((part, k) => ({ ...part, y: mids[k] - Math.round(lineH / 2) }))
  .forEach(({ name, y }) => {
    const at = Math.min(y, below - lineH)
    below = at
    insert({
      parent: chart,
      kind: "text",
      name: "Part",
      padding: 0,
      textStyle: "body2",
      text: name === accent ? `**${name}**` : name,
      align: "left",
      box: { x: lastRight + 24, y: at, w: box.w - lastRight - 24, h: lineH },
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
  box: { x: 0, y: base, w: plotW, h: 2 },
})
get({ target: chart }).problems
```

## After the script

- `problems` is empty, or a part's or period's name needs fewer words.
- Read the title again: the accented part is the one it talks about, and it sits on the zero line.
- A source line sits below the chart, at y 990.
