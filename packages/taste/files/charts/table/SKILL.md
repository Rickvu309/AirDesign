---
name: table
description: "Before you draw a table for readers to look up exact numbers, read how to insert it from rows and mark its focus row."
---

# Table

Exact numbers the reader looks up or compares across rows and columns. `insert` draws the whole table from a list of rows; this guide sizes it and marks the row the title talks about.

## When

- Several numbers per item, or numbers the reader needs exactly. One number per item is a `charts/bar`.
- 2 to 8 body rows and 2 to 6 columns. Up to ten rows fit in the `dense` density of your style; past that, keep the rows the title needs and total the rest in one row.

## The rules

- Rules only where they help: a heavier rule under the header, hairlines between rows, a heavier rule over the total. No grid, no vertical rules, no fills in the header or the cells. `insert` draws exactly these.
- The first row is the header: what each column holds and its unit, "FY26, $M".
- The first column names the rows. Numbers are right-aligned, so their digits line up.
- A last row starting with "Total" becomes the total: bold, with a rule above it. Check that it is the sum of the rows above. If the parts do not add up, say so in a note under the table.
- Order the rows on purpose: by size, or in the groups the story uses. Never alphabetically by default.
- One focus row, the one the title talks about, named by its first cell: its words turn `accent1`. Nothing else in the table takes a colour. Leave `focus` as `null` when the title talks about the whole table.
- One precision per column. Every cell holds a value; write "n/a" rather than leave one empty.
- About 68 px a row: the script sizes the table's box from its rows, so the cells take `body` or `body2`. When a long name breaks badly, it tries 60 and then 52 px a row, a size smaller each time. Place what explains the table below it, or a takeaway beside it.

## The script

Change the four values at the top: the slide, the box (its height is the most the table may take), the rows with the header first, and the first cell of the focus row.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 620 }
const rows = [
  ["Segment", "FY25, $M", "FY26, $M", "Growth"],
  ["Enterprise", "15.8", "18.6", "18%"],
  ["Mid-market", "13.1", "14.9", "14%"],
  ["Online", "1.9", "2.6", "37%"],
  ["Public sector", "2.4", "2.9", "21%"],
  ["SMB", "7.6", "7.9", "4%"],
  ["Partners", "3.2", "3.0", "−6%"],
  ["Total", "44.0", "49.9", "13%"],
]
const focus = "Online"

let table
for (const rowH of [68, 60, 52]) {
  if (table !== undefined) remove({ target: table })
  table = insert({
    parent: slide,
    kind: "frame",
    name: "Table",
    rows,
    box: { ...box, h: Math.min(box.h, rows.length * rowH) },
  })
  if (get({ target: table }).problems.length === 0) break
}
const cells = get({ target: table })
  .layers.split("\n")
  .map((line) => /^\s*(\S+) text @[\d.]+,([\d.]+) .* text="(.*)"$/.exec(line))
  .filter((found) => found !== null)
const row = cells.find(([, , , words]) => words.replaceAll("*", "") === focus)?.[2]
cells.filter(([, , y]) => y === row).forEach(([, id]) => update({ target: id, color: "accent1" }))
get({ target: table }).problems
```

## After the script

- `problems` is empty, or a cell needs fewer words.
- The total row equals the sum above it, column by column.
- The focus row is the one the title names.
- A source line sits below the table, at y 990.
