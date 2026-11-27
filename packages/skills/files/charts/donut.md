# Donut chart

Shares of one whole: revenue by segment, a budget by team. Draw it yourself from paths, rectangles and text; this guide gives the arithmetic. `kit/donut-chart` is the same chart drawn on sample data, to copy and look at.

## When

- One whole split into 2 to 5 parts that add up to it. With more parts, sum the smallest into "Other", or draw a `charts/bar`.
- One donut per slide. To compare shares across years or groups, draw stacked columns or a bar chart per group instead.

## The rules

- Slices run clockwise from 12 o'clock, largest first. "Other" goes last, whatever its size.
- Each slice's angle is its value / the total × 360°. A thin gap of background separates slices.
- Shares are whole percents that add up to 100: round down, then give the leftover points to the parts with the largest remainders.
- The total sits in the hole, the parts in a column beside the ring, in slice order, each with a square in its slice's colour and its share in bold.
- The slice the title talks about is `accent1`. The others are `text` in tints that fade with each slice, so the column's squares still match them.
- The header above the chart names the whole and the unit: "Revenue by segment, FY26, $M".

## The script

Change the six values at the top: the slide, the chart's box on the slide, the header, the parts, the part to accent and how the total reads.

```js
const slide = "<slide id>"
const box = { x: 420, y: 300, w: 1080, h: 620 }
const header = "**Revenue by segment**, FY26, $M"
const rows = [
  ["Mid-market", 13.4],
  ["Enterprise", 22.1],
  ["SMB", 8.2],
  ["Public sector", 3.1],
  ["Other", 1.4],
]
const accent = "Enterprise"
const shown = (value) => `$${value.toFixed(1)}M`

const parts = rows.toSorted((a, b) => (a[0] === "Other") - (b[0] === "Other") || b[1] - a[1])
const total = parts.reduce((sum, [, value]) => sum + value, 0)
const exact = parts.map(([, value]) => (value * 100) / total)
const shares = exact.map(Math.floor)
exact
  .map((share, i) => [share - shares[i], i])
  .toSorted((a, b) => b[0] - a[0])
  .slice(0, 100 - shares.reduce((sum, share) => sum + share, 0))
  .forEach(([, i]) => (shares[i] += 1))

const size = Math.min(480, box.h - 96)
const ring = { x: 0, y: 96 + Math.round((box.h - 96 - size) / 2), w: size, h: size }
const hole = 0.6
const gap = 4 / size
const at = (angle, r) => `${(0.5 + r * Math.cos(angle)).toFixed(4)} ${(0.5 + r * Math.sin(angle)).toFixed(4)}`
const tints = [0.5, 0.34, 0.22, 0.14]
let tint = 0
let from = -Math.PI / 2

const chart = insert({ parent: slide, kind: "frame", layout: "none", name: "Donut chart", box })
insert({
  parent: chart,
  kind: "text",
  name: "Header",
  textStyle: "body2",
  text: header,
  box: { x: 0, y: 0, w: box.w, h: 40 },
})
const listX = size + 80
const rowH = 88
const listY = ring.y + Math.round((size - parts.length * rowH) / 2)
parts.forEach(([name, value], i) => {
  const to = from + (value / total) * 2 * Math.PI
  const large = to - from > Math.PI ? 1 : 0
  const outer = [from + gap, to - gap]
  const inner = [from + gap / hole, to - gap / hole]
  const d = `M${at(outer[0], 0.5)} A0.5 0.5 0 ${large} 1 ${at(outer[1], 0.5)} L${at(inner[1], 0.5 * hole)} A${0.5 * hole} ${0.5 * hole} 0 ${large} 0 ${at(inner[0], 0.5 * hole)} Z`
  const ink =
    name === accent ? { fill: "accent1" } : { fill: "text", opacity: tints[Math.min(tint++, tints.length - 1)] }
  insert({ parent: chart, kind: "path", name: "Slice", d, stroke: "none", ...ink, box: ring })
  const y = listY + i * rowH
  insert({
    parent: chart,
    kind: "shape",
    shape: "rect",
    name: "Key",
    radius: 0,
    ...ink,
    box: { x: listX, y: y + 32, w: 24, h: 24 },
  })
  insert({
    parent: chart,
    kind: "shape",
    fill: "none",
    name: "Part",
    padding: 0,
    textStyle: "body2",
    text: `**${shares[i]}%** ${name}`,
    align: "left",
    alignV: "center",
    box: { x: listX + 44, y, w: box.w - listX - 44, h: rowH },
  })
  from = to
})
const middle = ring.y + size / 2
insert({
  parent: chart,
  kind: "shape",
  fill: "none",
  name: "Total",
  padding: 0,
  textStyle: "heading",
  text: `**${shown(total)}**`,
  align: "center",
  alignV: "bottom",
  box: { x: size / 2 - 120, y: middle - 52, w: 240, h: 52 },
})
insert({
  parent: chart,
  kind: "shape",
  fill: "none",
  name: "Total label",
  padding: 0,
  textStyle: "caption",
  color: "text2",
  text: "Total",
  align: "center",
  alignV: "top",
  box: { x: size / 2 - 120, y: middle + 4, w: 240, h: 36 },
})
get({ target: chart }).problems
```

## After the script

- `problems` is empty, or a part's name needs fewer words.
- The shares in the column add up to 100.
- A source line sits below the chart, at y 990.
