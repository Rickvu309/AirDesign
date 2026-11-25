# Component spec operators

A component spec evaluates expressions to produce ordinary Doom nodes. Layout uses pixels in the component frame. Data keeps its original units and precision.

## Measured text

| Expression                          | Result                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `["textWidth", chars, style]`       | Natural width at the theme's named text style. For several paragraphs, this is the widest one. |
| `["textWidth", chars, style, size]` | Natural width at the named style with an explicit size from 1 to 2,000 px.                     |
| `["flowText", items, options]`      | `{ items, rows, size }`, the placed items, number of occupied rows, and shared text size.      |

Both operators use the same supplied `Measure` as text fit. Each probe charges the expansion budget before it calls the measure. Text takes at most 512 UTF-8 bytes per string.

Each input item is a record with `chars` and any fields the spec needs, such as an ID and fill. Pass these options to `flowText`.

| Option      | Meaning                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `width`     | Available width per row.                                                                               |
| `rows`      | Maximum row count, from 0 to 100. A chart legend can allow up to 2 according to the room in the frame. |
| `rowHeight` | Available height for a one-line label.                                                                 |
| `leading`   | Width before the label inside an item. For a legend, this is the swatch plus its gap.                  |
| `gap`       | Space between two items in a row.                                                                      |
| `style`     | Named theme text style.                                                                                |
| `smaller`   | Second size to try, from 1 to 2,000 px and capped at the style's original size.                        |

Items flow in input order. The operator first uses the original size and wraps at item boundaries. If space runs out, it repeats at the smaller size. Any item that cannot fit at the selected size is omitted. Later items can still fit in the remaining room. Blank and multiline labels are also omitted. One `flow-omitted` finding lists the omitted zero-based input indices.

A placement is `{ item, x, row, w }`. The row is zero-based and `x` starts at the left edge of that row. The label starts at `x + leading` and has width `w`, rounded up to a whole pixel. Repeat over the placements to emit both the mark and the label. Use the original item ID in their part keys. Set the text emission's optional `size` to the flow's shared size. Explicit-size emissions use an unwrapped box and require the spec to supply its geometry.

## Numeric display

`["decimals", values, scale]` returns one precision for the entire data set. It skips nulls, divides by the positive display scale, and rounds to one decimal. It returns one decimal when the largest rounded magnitude is below 10 and at least one rounded value is fractional. All other lists give zero decimals.

Column uses this default when its `digits` token is `"auto"`. A spec or instance may choose 0 to 12 digits explicitly. A theme can supply the `number.digits` preference. Column uses that preference when its `digits` token is automatic.

When an axis uses a whole step in display units, use zero decimals for its ticks. For example, `["if", ["isInteger", ["div", ["get", "step"], ["get", "token.scale"]]], 0, ["get", "axisDigits"]]` selects the tick precision.

`format` emits a `rounded-to-zero` finding when a nonzero input becomes zero at the selected scale and digits. The finding records the source value, scale, and digits. Expression findings name their spec field and use the emitting part's key when evaluated inside an emission. Other expressions use the root key.

## Focus and series colors

The optional instance property `focus` holds up to 100 category or series IDs. Omission and an empty list both give the default colors. Use stable data IDs as keys. Duplicate IDs collapse. A focus that matches no plotted mark keeps the default colors and reports a `focus-missing` finding. A linked instance retains focus when its data changes, and undo can restore it. In MCP, set focus on the linked frame with `{"op":"set","target":"<frame id>","focus":["<category id>"]}`. Send an empty list to clear it.

| Expression                                                           | Result                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `["includes", list, value]`                                          | True when the list holds the value. Use it inside `if` to give focused marks the accent.                                               |
| `["matchingFocus", requested, markIdsOrRows, idField?, valueField?]` | Matches requested IDs with plotted marks. An optional value field excludes rows with missing values. Reports missing IDs.              |
| `["rampSlots", rows, focus, arrangement?]`                           | Maps rows to an accent or grey slot for marks and legend swatches. Reports when the chart needs more colours than the ramp has.        |
| `["rampFold", rows, focus, other]`                                   | Keeps the rows the ramp can tell apart and sums the rest into the `other` row. Returns `rows`, `folded` IDs, `slots` and `count`.      |
| `["rampCapacity"]`                                                   | How many colours the theme's ramp tells apart: the accent and its greys.                                                               |
| `["paletteRamp", index, count, accent, neutral, labelled?]`          | Accent at index zero, followed by neutral shades stepping away from the background. The count is 1 to 100 and the index is zero-based. |

Read the instance property with `["get", "focus"]`. Column tests each plotted row ID with `includes` and uses a single ramp shade for every muted mark. The neutral base is `text2`, and the main accent is `accent1`. Theme references follow the deck's theme. The ramp tints toward white on light backgrounds and shades toward black on dark backgrounds.

The first grey targets 3:1 against the background, or 2.2:1 when the optional fifth argument is true for direct labels. The second grey is the nearest darker shade of the same grey that is at least 15 OKLab ΔE (×100) from both the first grey and the accent, the normal-vision floor in the dataviz skill's palette validator, and no heavier than the accent against the background. When none fits, the first grey moves away from the background, no heavier than the accent and still 15 ΔE from it, until a second grey fits. When no pair exists, every muted slot takes the first grey and the ramp holds two colours. Every grey keeps 3:1 on the background, so a mark never needs its label to be seen. Of the built-in themes, consulting and neutral have two greys, and editorial, midnight and technical have one.

`rampFold` gives each row with its own `color` and each focused row its own colour, and gives the rest the greys. When the rest need more greys than the theme has, it keeps one fewer and sums the others into the `other` row, which takes the last grey, and reports `series-folded` advice with the fix. Stacked columns use it, so each series they show has its own colour in the plot and the legend. A clustered chart shows at most `["rampCapacity"]` series, never more than three, and drops the rest with a finding, because a summed bar would compare a sum with single series.

`rampSlots` alternates the greys it has. With no arrangement, it reports a `many-series` finding when the chart needs more colours than the theme's ramp holds. The optional third argument names a chart whose marks are labelled directly, so they can share a grey without a finding:

- `"labelled"`: lines that carry their own labels.
- `"circular"`: pie slices. The greys alternate around the ring from the focus, so neighbours differ where the theme has two greys. Pie slices are also separated by a background seam.

Stacked segments that touch are parted by the same 2 px background seam, taken from the segment that sits further from the baseline. The seam is left out where either segment is shorter than 4 px, and every nonzero segment is at least 1 px tall.

## Signed color roles

Theme colors `positive`, `negative`, and `total` are available as ordinary theme color references, such as `{ "var": "positive" }`. Put the sign or meaning in text or geometry as well. Column uses the series accent by default. Set the `legend` variant and supply `seriesLabel` to show a series key. A missing label produces `legend-label-missing` advice. Set `signed` to enable sign colors and key entries for the signs present, with labels from `positiveLabel` and `negativeLabel`. A focus that matches a plotted mark takes precedence over the signed variant. Waterfall specs can use `total` for a balance bar. The color picker lists the palette colors.

## Paint check

Run the `component-column` journey with `verify-airdesign` to check saved parts, canvas, filmstrip, and PDF. Set `AIRDESIGN_COLUMN_POPPLER=1` with Poppler installed to extract the PDF text and rasterize the page for comparison.

## Text overflow

Set `overflow: "ellipsis"` on a text emit to paint an ellipsis when its text exceeds the available width or height. The saved shape keeps all its text. A fit rule still reports a `text-fit` finding when the label cannot fit at its configured size. If the emit omits `overflow`, a failed fit rule omits the text part. Fill controls the shape’s appearance.

Structured copy accepts a list of paragraph records. A paragraph can set `maxLines` from 1 to 16 on an ellipsis text part. It treats line breaks inside that paragraph as spaces. Text parts without ellipsis ignore the line limit. When the paragraph exceeds that limit, its last visible line ends in an ellipsis and later paragraphs keep their place in the flow. Use `wrap: "none"` for a paragraph that must stay on one line.

## Groups

A part with `children` can set `group` to a key expression. Its layers land in one frame that hugs them, the same frame Group makes in the editor, so they move as one after Remove auto layout. Give a card and the layers that sit on it one group, such as a process step's card and duration or a matrix quadrant's tile, label and items. Groups nest. A group takes its first layer's place in paint order and in its frame's auto layout. Each layer keeps its box in the component frame, and the landed layer's box is relative to its group. A group that keeps fewer than two layers, for example after a fit omits a label, is left out and its layer stands alone. A group key must differ from every emitted key. A linked instance keeps its parts flat inside the generated frame and matches its edits, deletions and connector ends to parts by key, so adding a group to a spec keeps every part's key, such as `step-group` around `step` and `duration`.

## Connector attachments

A connector endpoint can use `["site", partKey, side]` to attach to the default site. An endpoint record with `key`, `site`, and an optional `along` fraction can attach anywhere along a rectangular edge. Fractions run from left to right on top and bottom edges and from top to bottom on left and right edges. Channel coordinates are relative to the component frame.

## Advice

Use `["advise", code, note]` to report advice while evaluating an expression. An optional fourth item prefixes the note with the affected data row. Put the expression inside an `if` to report only when the condition holds.

The process template accepts an optional `tokens.focus` step ID. The first step carries the accent when the ID is omitted or does not match a step.

## Hierarchies

`["hierarchy", rows, focus]` lays out a list of records with `id` and `parent`. A blank parent denotes a root. The result has `rows` in depth-first order and totals for `levels`, `leaves`, `roots`, and `broken` relationships. Each placed row carries its original `index`, zero-based `depth`, centered leaf `slot`, immediate `children` count, and `focused` flag. Focus includes the named row and its ancestors. Unknown parents and cycles create roots and increment `broken` so a spec can suggest a fix while drawing the remaining relationships.

## Consulting diagrams

- `matrix` takes titled axes with IDs `x` and `y`. Use the quadrant IDs `upper-left`, `upper-right`, `lower-left`, and `lower-right`, each with a short action label. Items take a quadrant ID and an optional nonnegative `size`. Bubble area follows size within a bounded range for legibility. Set `tokens.sizeLabel` to the metric shown by bubble size, such as `Revenue`. Set `tokens.focus` to the quadrant ID to emphasize it.
- `tree` takes nodes with a label and an optional parent ID. Start with one root and a binary first split. Set `tokens.focus` to the node at the end of the path to emphasize. Child cards stay attached to their parent. Crowded, deep, and overflowing branches generate findings.

## Lists and colors

| Expression                                                 | Result                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `["sortBy", rows, field, ...fields]`                       | Sorts by ascending numeric fields in priority order. Tied rows keep their input order.                                                                                                                                                                        |
| `["groupBy", rows, "field"]`                               | Indexes records by a string field. Records within each group keep their input order.                                                                                                                                                                          |
| `["lookup", index, key, fallback]`                         | Reads a key from a record, or returns the optional fallback. The default fallback is null.                                                                                                                                                                    |
| `["cycle", list, index]`                                   | Reads a nonnegative index modulo the list length. An empty list returns null.                                                                                                                                                                                 |
| `["round", value, digits]`                                 | Rounds a number to 0–12 decimal places without formatting it.                                                                                                                                                                                                 |
| `["readableInk", fill]`                                    | Chooses black or white according to which has greater contrast against the resolved fill.                                                                                                                                                                     |
| `["contrastTint", fill, background, ratio]`                | Blends the resolved fill toward the background until it reaches the requested contrast ratio, from 1 to 21. If the fill already meets or falls below that ratio, it keeps the supplied color.                                                                 |
| `["contrastGrey", background, accent, step, ratio, apart]` | Tints the step colour's theme colour toward the ratio against the background, heavier than the step and at least `apart` from the step and the accent. It returns a theme colour with a tint, so it recolours with the theme; a raw hex step gives a raw hex. |

A collection field of type `"color?"` accepts a hex value, a theme color reference, or null. Missing fields become null.

## Label fit

Use `"fit": { "minWidth": expression }` to omit a text part and report a finding when its box is narrower than the minimum. Text that clears the minimum still goes through measured fit.

In a grouped text fit with thinning enabled, set `keep` to a boolean expression to retain essential labels while thinning the others. A retained label that cannot fit still reports a finding.

In a grouped text fit with thinning enabled, set `advise` to one sentence that tells the agent how to make room, such as `"Show fewer categories or widen the frame."`. The group's `text-fit` finding carries it as `advice` whenever labels are thinned, and MCP ends the finding's note with it.

## Frame and work limits

`minFrame` is `{ w, h }` in pixels, each from 1 to 20,000: the smallest frame the template draws in. A spec may not set its own work or part limit. `library.ts` sets a larger `workLimit` (default 80,000 work units) or `partLimit` (default 499 parts) for the built-in templates that need one.

`minFrame` is a hard floor for a linked instance. A canvas resize stops at it, Figma-style, and a resize of a group or a selection keeps the chart at its minimum. Placing or resizing an instance below it is refused, and the refusal names the minimum, such as "Needs a size of at least 140 × 160 px." An instance saved smaller than its minimum, by an older build or by undoing a resize, paints at its minimum from its stored corner on the canvas, filmstrip, captures and PDF, and expands at the minimum with `frame-too-small` advice. Nothing is written when a deck opens. A person's resize from any handle starts from the painted size, so the stored box comes back to at least the minimum as an ordinary undoable edit.
