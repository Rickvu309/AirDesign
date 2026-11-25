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

## Signed color roles

Theme colors `positive`, `negative`, and `total` are available as ordinary theme color references, such as `{ "var": "positive" }`. Put the sign or meaning in text or geometry as well. Column uses the series accent by default. Set the `legend` variant to show a series key labeled by `seriesLabel`. Set `signed` to enable sign colors and key entries for the signs present, with labels from `positiveLabel` and `negativeLabel`. Waterfall specs can use `total` for a balance bar. The color picker lists the palette colors.

## Paint check

Run the `component-column` journey with `verify-airdesign` to check saved parts, canvas, filmstrip, and PDF. Set `AIRDESIGN_COLUMN_POPPLER=1` with Poppler installed to extract the PDF text and rasterize the page for comparison.

## Text overflow

Set `overflow: "ellipsis"` on a text emit to paint an ellipsis when its text exceeds the available width or height. The saved shape keeps all its text. A fit rule still reports a `text-fit` finding when the label cannot fit at its configured size. If the emit omits `overflow`, a failed fit rule omits the text part. Fill controls the shape’s appearance.

Structured copy accepts a list of paragraph records. A paragraph can set `maxLines` from 1 to 16 on an ellipsis text part. It treats line breaks inside that paragraph as spaces. Text parts without ellipsis ignore the line limit. When the paragraph exceeds that limit, its last visible line ends in an ellipsis and later paragraphs keep their place in the flow. Use `wrap: "none"` for a paragraph that must stay on one line.

## Connector attachments

A connector endpoint can use `["site", partKey, side]` to attach to the default site. An endpoint record with `key`, `site`, and an optional `along` fraction can attach anywhere along a rectangular edge. Fractions run from left to right on top and bottom edges and from top to bottom on left and right edges. Channel coordinates are relative to the component frame.

## Advice

The optional top-level `advice` list contains records with a `code`, a `when` expression, and a `note` that gives the reader a fix. A matching record adds a finding to the root and expansion proceeds.

The process template accepts an optional `tokens.focus` step ID. The first step carries the accent when the ID is omitted or does not match a step.

Use `["advise", code, message]` to report advice while evaluating an expression. An optional fourth item names the affected data row. Put the expression inside an `if` to report only when the condition holds.

## Lists and colors

| Expression                                  | Result                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `["sortBy", rows, field, ...fields]`        | Sorts by ascending numeric fields in priority order. Tied rows keep their input order.                                                                                                        |
| `["groupBy", rows, "field"]`                | Indexes records by a string field. Records within each group keep their input order.                                                                                                          |
| `["lookup", index, key, fallback]`          | Reads a key from a record, or returns the optional fallback. The default fallback is null.                                                                                                    |
| `["cycle", list, index]`                    | Reads a nonnegative index modulo the list length. An empty list returns null.                                                                                                                 |
| `["round", value, digits]`                  | Rounds a number to 0–12 decimal places without formatting it.                                                                                                                                 |
| `["readableInk", fill]`                     | Chooses black or white according to which has greater contrast against the resolved fill.                                                                                                     |
| `["contrastTint", fill, background, ratio]` | Blends the resolved fill toward the background until it reaches the requested contrast ratio, from 1 to 21. If the fill already meets or falls below that ratio, it keeps the supplied color. |

A collection field of type `"color?"` accepts a hex value, a theme color reference, or null. Missing fields become null.

## Label fit

Use `"fit": { "minWidth": expression }` to omit a text part and report a finding when its box is narrower than the minimum. Text that clears the minimum still goes through measured fit.

In a grouped text fit with thinning enabled, set `keep` to a boolean expression to retain essential labels while thinning the others. A retained label that cannot fit still reports a finding.
