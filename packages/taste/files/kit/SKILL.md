---
name: kit
description: "Ready slide pieces drawn from plain layers that you copy into a slide and own. Read it before you draw a piece from scratch."
---

# Kit

Pieces of slide design drawn from plain layers. Copy one into a slide with `airdesign_execute`, then change its words and layers as your own. The copy has no link back to the kit.

```js
const [block] = copy({ from: "kit/title-block", parent: slide, box: { x: 120, y: 80 } })
const [title, context] = get({ target: block }).children
update({ target: title, text: "Revenue grew 18% on two new markets" })
```

- `parent` is the slide or frame the piece lands in.
- `box` places the piece: `x` and `y` from the parent's top left. Add `w` and `h` to give it another size. Left out, it lands at the top left at its own size.
- A piece names only the deck's theme colours and text styles, so it takes the deck's look and follows a later theme change.
- Read the piece's layers with `get({ target })` before you change them.

## Pieces

Sizes are pixels on a 1920 by 1080 slide, in the neutral theme. Each frame grows with its words, so change the words freely and read the box again with `get` before you place what comes below. Paint only the one item the title talks about in `accent1`; the rest stay as they land.

- `kit/title-block` (1680 by 121): the slide's title over one line of context. Place it at `x: 120, y: 80` on every content slide. Change `Title`, the takeaway in one sentence with a verb, and `Subtitle`, the scope, period or unit. Remove `Subtitle` when the title needs no context.
- `kit/kpi` (480 by 213): one number under a thin rule, with what it measures and its comparison. Three side by side at `x: 120, 720, 1320` make a row; put the chart or table that explains them below. Change `Number`, `Label` and `Note`; give `Number` `color: "accent1"` when it is the number the title is about.
- `kit/comparison` (1680 by 254): two options side by side, each a heading over two to four points. The first column's rule is the accent and marks the option the title favours. Change each column's `Heading` and `Points` (markdown bullets). For a third option, copy the second column with `copy({ targets: [column] })`: the three share the width.
- `kit/timeline-step` (420 by 216): one step of a timeline: a marker on a line, a date, what happens and a note. Copies placed side by side, 420 apart, make one continuous line: four at `x: 120, 540, 960, 1380`. Change `Date`, `Label` and `Note` in `Words`. Give the step the title is about `fill: "accent1"` on its `Marker`, and remove the last step's `Line`.
- `kit/source-line` (1680 by 31): where the numbers come from, at `x: 120, y: 990`. Every slide with a number has one. Change its text: "Source: " and the document, team or date.

## Charts, tables and diagrams

A chart, table or diagram has a recipe skill instead of a piece: a script that draws it from your data, with the arithmetic done and every arrow attached to its boxes. Read the recipe, change its first lines to your data and run it in one `airdesign_execute` call.

- Ranked items that are not time: `charts/bar`.
- One number over periods: `charts/column`, or `charts/line` for many periods or a few series.
- Exact numbers across rows and columns: `charts/table`.
- Steps in order: `diagrams/process-flow`.
- A system's parts and how they connect: `diagrams/architecture`.
