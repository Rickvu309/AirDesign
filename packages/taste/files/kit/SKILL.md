---
name: kit
description: "Ready slide pieces drawn from plain layers that you copy into a slide and own. Read it before you draw a piece from scratch."
---

# Kit

Pieces of slide design drawn from plain layers. Copy one into a slide with `airdesign_execute`, then change its words and layers as your own. The copy has no link back to the kit.

```js
const [block] = copy({ from: "kit/title-block", parent: slide, box: { x: 120, y: 80 } })
const [title, caption] = get({ target: block }).children
update({ target: title, text: "Two new markets lifted revenue 18% in FY26" })
update({ target: caption, text: "Revenue by region, FY25 and FY26, $M" })
```

- `parent` is the slide or frame the piece lands in.
- `box` places the piece: `x` and `y` from the parent's top left. Add `w` and `h` to give it another size. Left out, it lands at the top left at its own size.
- A piece names only the deck's theme colours and text styles, so it takes the deck's look and follows a later theme change.
- Read the piece's layers with `get({ target })` before you change them.

## Pieces

Sizes are pixels on a 1920 by 1080 slide, in the neutral theme. Each frame grows with its words, so change the words freely and read the box again with `get` before you place what comes below. Paint only the one item the title talks about in `accent1`; to move the accent, give the new item `stroke: "accent1"` and the old one `stroke: "none"`. Panels land with square corners: give them the radius your style names.

Every slide:

- `kit/title-block` (1680 by 105): an assertion title over a muted caption. Place it at `x: 120, y: 80` on every content slide. `Title` is the claim, one sentence with a verb; `Caption` labels the exhibit: what it measures, the scope, the period and the unit.
- `kit/source-line` (1680 by 31): where the numbers come from, at `x: 120, y: 990`. Every slide with outside or derived numbers has one. Its one layer, `Source line`, reads "Source: " and the document, team or date.
- `kit/section-tracker` (480 by 41): the deck's sections, the current one underlined, on every body slide of a deck with three or more sections. Place it at `x: 1320, y: 80` and give the title block `box: { w: 1160 }`. Change the words of `Section 1`, `Section 2` and `Section 3`; mark the current one with `color: "text", stroke: "text"` and the others with `color: "text2", stroke: "none"`.

Openers:

- `kit/cover` (1440 by 368): the first slide: the deck's answer as its title, who it is for and the date. Place it at `x: 120, y: 320`. Change `Title`, `Audience` and `Date`.
- `kit/statement` (1440 by 318): one assertion set large, for a section opener or the closing ask. Place it at `x: 120, y: 320`. `Kicker` names the section or the ask, `Statement` makes the claim, and `Support` gives the number behind it.

Numbers:

- `kit/kpi` (480 by 205): one number, what it measures, and the reference that gives it meaning. Three side by side at `x: 120, 720, 1320` make a row. Change `Number`, `Measure` and `Reference`, a target, prior period or peer such as "vs 35% target"; give `Number` `color: "accent1"` when it is the number the title is about.
- `kit/share-box` (1680 by 131): a share of one whole as a bar, in place of a pie or donut. Set the width of `Share` to the share times 1680 (25% is 420), then change `Share label` and `Whole label`.
- `kit/driver-equation` (1680 by 188): a result as the product of its drivers, `Result` = `Driver 1` × `Driver 2` × `Driver 3`, at `x: 120, y: 420`. Change each part's `Name` and `Note`, its value and change. For two drivers remove `Times 2` and `Driver 3`; for four, copy `Driver 3`, then copy `Times 2` and move that copy after `Driver 3`, and keep each name to two short words.

Exhibits:

- `kit/two-by-two` (1680 by 499): options on the two dimensions that decide them, each quadrant named by the action it calls for. Place it at `x: 120, y: 260`. Change the axes `Y name` and `X name`, high at the arrow, and the `Action` and `Members` in `Top left`, `Top right`, `Bottom left` and `Bottom right`.
- `kit/numbered-callout` (720 by 86): a numbered marker beside the one claim it makes about an exhibit. Stack copies 40 apart beside or under the exhibit. Change `Marker` to 1, 2, 3 and `Claim` to the finding. To pin a number on the exhibit, copy its `Marker` and move the copy onto the spot with `move({ target, parent: slide, box: { x, y } })`.
- `kit/qa-plan-table` (1680 by 368): the work plan, one question per row with its hypothesis, the analysis that tests it, the source and the owner. Place it at `x: 120, y: 300`. Cells are named by column and row, from `Question 1` and `Hypothesis 1` to `Owner 3`; for two questions remove the row 3 cells and `Rule 2`.
- `kit/comparison` (1680 by 254): two options side by side, each a heading over two to four points. The first column's rule is the accent and marks the option the title favours. Change each column's `Heading` and `Points` (markdown bullets). For a third option, copy the second column with `copy({ targets: [column] })`: the three share the width.
- `kit/timeline-step` (420 by 216): one step of a timeline: a marker on a line, a date, what happens and a note. Copies placed side by side, 420 apart, make one continuous line: four at `x: 120, 540, 960, 1380`. Change `Date`, `Label` and `Note` in `Words`. Give the step the title is about `fill: "accent1"` on its `Marker`, and remove the last step's `Line`.

## Charts, tables and diagrams

A chart, table or diagram has a recipe skill instead of a piece: a script that draws it from your data, with the arithmetic done and every arrow attached to its boxes. Read the recipe, change its first lines to your data and run it in one `airdesign_execute` call.

- Ranked items that are not time: `charts/bar`.
- One number over periods: `charts/column`, or `charts/line` for many periods or a few series.
- Exact numbers across rows and columns: `charts/table`.
- Steps in order: `diagrams/process-flow`.
- A system's parts and how they connect: `diagrams/architecture`.
