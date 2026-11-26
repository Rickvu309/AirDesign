# Review a deck before you stop

Run this list on every slide when the deck is done. Fix what you find, then read the slide again. The flaw groups follow SlideAudit's taxonomy of slide design flaws (arXiv 2508.03630); each line says how to see the flaw in AirDesign.

## Story, from the titles

Read the titles alone, in order.

- Each title states a takeaway with a verb, in two lines at most.
- Together they tell the argument and end with the ask or the recommendation.
- No two titles make the same point. Merge slides that do.
- 5 to 8 slides, unless the person asked for another count.

## Layout

`get({ target: slide })` in `airdesign_execute` reports these as problems. Fix every one.

- Content cut off or running out of its box: `overflow`.
- One layer covering another: `overlap`.
- A layer outside the slide: `off-slide`.

Read the boxes in the same answer for these:

- Unbalanced space: the lowest layer ends well above y 960, or one side is crowded while the other is empty.
- Alignment: layers in a row share a top edge, layers in a column share a left edge, and every slide starts its content at x 120.
- Clutter: more than about six separate blocks in the body area.

Only a picture shows these. Call `screenshot({ target: slide })` when a tab is open:

- Hierarchy: the eye lands on the title, then on the one thing that proves it.
- A label crossing a bar or a line, or words too close to an edge.

## Type

Problems report these:

- Text under the readable size: `small-text`.
- A size or a font outside the theme: `off-scale`, `off-font`.

Check these in the words and styles yourself:

- Every title uses `title`, every source line `caption`. No raw sizes or line spacing.
- Bold marks one lead phrase at most per point. No random italics or underlines.
- No block over five bullets or about 40 words.

## Colour

Problems report a colour outside the theme: `off-palette`.

Check these yourself:

- One accent per slide, on the thing the title names. Everything else in text, `text2` or neutral fills.
- Text on a fill uses the colour made for it: `text` on light fills, `background` on dark ones.
- Green and red mean good and bad, and nothing else.

## Charts, tables and pictures

- Each chart proves its slide's title and names its unit.
- Bars rank from high to low; time runs left to right.
- Number columns in tables align right, and a total row comes last.
- A picture relates to the point and is large enough to read, or it goes.

## Numbers

- Every number traces to the material or one step of arithmetic on it.
- Every slide with a number has a source line.
- A total that does not equal its parts carries a note.
