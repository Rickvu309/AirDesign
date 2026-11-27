# Table

Exact numbers the reader looks up or compares across rows and columns. `insert` draws the whole table from a list of rows; `kit/table` is the same table on sample data, to copy and look at.

## When

- Several numbers per item, or numbers the reader needs exactly. One number per item is a `charts/bar`.
- 2 to 8 body rows and 2 to 6 columns. More rows go on an appendix slide in the `dense` density of your style.

## The rules

- The first row is the header: what each column holds and its unit, "FY26, $M". It needs no fill.
- The first column names the rows. Numbers are right-aligned, so their digits line up.
- A last row starting with "Total" becomes the total: bold, with a rule above it. Check that it is the sum of the rows above. If the parts do not add up, say so in a note under the table.
- One precision per column. Every cell holds a value; write "n/a" rather than leave one empty.
- The table's text takes the largest size that fits its box. Give it about 68 px a row: the cells then take `body` or `body2`. A taller box sets them in `heading`, too large for a table. Place what explains the table below it, or a takeaway beside it.

## The script

Change the three values at the top: the slide, the box and the rows, header first.

```js
const slide = "<slide id>"
const box = { x: 120, y: 300, w: 1680, h: 544 }
const rows = [
  ["Segment", "FY25, $M", "FY26, $M", "Growth"],
  ["Enterprise", "15.8", "18.6", "18%"],
  ["Mid-market", "13.1", "14.9", "14%"],
  ["SMB", "7.6", "7.9", "4%"],
  ["Public sector", "2.4", "2.9", "21%"],
  ["Partners", "3.2", "3.0", "−6%"],
  ["Online", "1.9", "2.6", "37%"],
  ["Total", "44.0", "49.9", "13%"],
]

const table = insert({ parent: slide, kind: "frame", name: "Table", rows, box })
get({ target: table }).problems
```

## After the script

- `problems` is empty, or a cell needs fewer words.
- The total row equals the sum above it, column by column.
- A source line sits below the table, at y 990.
