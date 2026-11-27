# Layouts

Six slide layouts on the 1920 by 1080 slide. The `picker` skill says which one a slide needs. Each gives its intent, its grid in pixels, how much content it holds, and its rules. The style of the deck's theme says which colour does which job; a layout only says where things go.

## The frame every content slide shares

- Title band: copy `kit/title-block` at `x: 120, y: 80`. It grows with a two-line title; read its box and start the body 60 below its bottom.
- Body area: x 120 to 1800, y 280 to 960. The layout fills it; its lowest layer ends near y 960.
- Source line: copy `kit/source-line` at `x: 120, y: 990` on every slide with a number.
- Columns: full width is 1680. Two columns split 60 to 40: x 120 to 1100 and 1180 to 1800. Three columns are 520 wide with a 60 gap: x 120, 700, 1280.
- Too much content for the grid: split the slide or cut words. Never shrink text below the theme's styles.

## L1 One number

- Intent: one figure is the evidence, and the reader should remember it.
- Grid: copy `kit/kpi` at `box: { x: 120, y: 340, w: 840 }`. The reading on the right, x 1080 to 1800, from y 340: two or three takeaways in `body`, 40 apart.
- Content: one number with its unit; a label of up to 6 words; a comparison of up to 12 words (against target, last year or a peer); takeaways of up to 15 words each.
- Rules: the number takes the accent the style gives the one thing. Its comparison is never left out. Pieces: `kit/title-block`, `kit/kpi`, `kit/source-line`.

## L2 Numbers over evidence

- Intent: several headline numbers, and the chart or table that explains the one the title is about.
- Grid: three `kit/kpi` at y 280 and `x: 120, 720, 1320` (480 wide); four at `x: 120, 550, 980, 1410` with `w: 390`. Read the row's lowest box; the evidence starts 60 below it and runs to y 960, full width or split 60 to 40 with its reading.
- Content: two to four numbers, labels of up to 5 words, notes of up to 8. The evidence is one chart drawn from shapes or one table with up to six rows.
- Rules: the number row is a header, never the whole slide. The evidence plots the measure the title names, not a neighbour of it. Only the number the title talks about takes the accent. Pieces: `kit/title-block`, `kit/kpi`, `kit/source-line`.

## L3 Trend

- Intent: how one value moved over time, against a plan or target.
- Grid: the chart at x 120 to 1100, y 280 to 960: plot area x 200 to 1080 and y 320 to 880, value labels above each column, period labels in `label` from y 900. The reading at x 1180 to 1800 from y 320: two or three takeaways in `body`.
- Content: 4 to 12 periods as columns, more as a line drawn with `path`; one series, or two to three when they are compared; takeaways of up to 15 words.
- Rules: compute each column from its value: `h = 560 * value / max`, from a zero baseline. Label every column, or the first and last point and the one the title names. A target or plan is a dashed line across the plot with its value at the right end. The period the title is about takes the accent, the rest stay neutral. Pieces: `kit/title-block`, `kit/source-line`.

## L4 Ranking

- Intent: which items are biggest, or how parts add up to a total.
- Grid: horizontal bars at x 120 to 1100: labels in `body2` at x 120, 280 wide; bars from x 420, at most 560 long; each value in `body2` just right of its bar. Row pitch is `680 / items`, from 40 to 120; a bar is 60% of its row. The reading at x 1180 to 1800.
- Content: 3 to 16 items, largest first, every item shown. Labels of up to 3 words.
- Rules: compute each bar from its value: `w = 560 * value / max`. Same precision on every value. The items the title names take the accent. As a bridge: vertical columns across x 120 to 1100, the start and end totals from the baseline, each step floating from where the last ended, gains and losses in their two colours, every step labelled with its sign. Pieces: `kit/title-block`, `kit/source-line`.

## L5 Options

- Intent: two or three choices side by side, and which one the title favours.
- Grid: copy `kit/comparison` at `x: 120, y: 280`, 1680 wide; for a third option, copy its second column. Below it, 60 under its lowest box and down to y 960: the two to four numbers that decide between the options, one row each, aligned under their option's column.
- Content: two or three options, a heading of up to 4 words each, two to four points of up to 12 words.
- Rules: the favoured option is first and keeps the accent rule. Every option has the same number of points about the same things, in the same order. Pieces: `kit/title-block`, `kit/comparison`, `kit/source-line`.

## L6 Item rows

- Intent: a short list of things with the same parts: risks, recommendations, next steps, initiatives.
- Grid: rows fill y 280 to 960: row `i` starts at `280 + i * 680 / items`, its words centred in the row, a hairline between rows. Columns: a number in a small square at x 120 (56 wide); the lead in bold at x 220, 560 wide; the detail at x 820, 680 wide; one short tag (owner, date, impact) in `label` at x 1540, 260 wide. With four or more values per item, insert a `frame` with `rows` instead, header first, numbers right-aligned.
- Content: three to five items, six at most. Three items take the lead in `heading` and the detail in `body`; four to six take `body` and `body2`. Leads of up to 6 words; detail of up to 20 words; a table of up to eight rows and five columns.
- Rules: every item has the same parts in the same columns. A recommendation puts the ask first. A risk list puts the biggest risk first and gives it the accent. Pieces: `kit/title-block`, `kit/source-line`.
