# Technical

For engineering and data material: architecture and design reviews, incident reviews, specs, data findings, roadmaps for builders.

## Identity

Precise documentation. A cool off-white page, Geist throughout, everything on a grid. The reader is an engineer who wants the mechanism, with exact labels and numbers. Trust comes from precision, not polish.

## Layout

- Place things on a 12-column grid across the 1680 px body: columns 118 px wide with 24 px gaps.
- Diagrams flow in one direction (see parameters): boxes joined by `line` connectors with `route: "elbow"` and arrows, labels inside the boxes, eight boxes at most per slide.
- Name a group of boxes with a `label` above it and an outline frame around it.
- Put specs, limits and comparisons in tables.
- Code, commands and ids use Geist Mono (`font: "Geist Mono"`) at `body2` or `caption` size.

## Token map

- `background`: every slide.
- `text`: titles, box labels and body.
- `text2`: secondary words: connector labels, notes, the source line.
- `accent1`: the path or component the title talks about: its stroke, connectors and label. One per slide.
- `background2`: box fills.
- `text+80`: box strokes, group outlines, hairlines and table rules.
- `text+70`: every other bar or series.
- `accent2`: a second series, or new and healthy parts.
- `accent5`: a failing part or an incident path.
- `positive`, `negative`: status in tables.
- Type: `title`, `heading` for panel heads, `body`, `body2` for tables and box text, `caption` for the source, `label` for box and group headers, `bigNumber` for a key metric.

## Decoration

- Allowed: 2 px strokes, radius 8 on boxes, dashed lines for optional or async paths, a Lucide icon inside a box to name what it is (database, server, queue), the same icon set on every slide.
- Not allowed: shadows or any `effect`, gradients, filled colour blocks behind whole sections, decorative icons, illustrations, `accent3` (violet) as a highlight.

## Hierarchy

1. The title, which states what the diagram or data shows.
2. The highlighted path or component in the accent.
3. The other components, in neutral.
4. Annotations and source.

## Typography

- Titles in `title`: Geist at 52, sentence case, two lines at most.
- Box labels in `body2`; box headers in `label`. Sentence case everywhere, no upper case labels.
- Numbers carry units; metrics in `bigNumber` with a `caption` label.
- Nothing under `caption`.

## Parameters

- `accent`: the colour for the point that matters. Default `accent1`, blue. Use `accent2`, teal, when the point is a new or healthy part; `accent5`, rose, for a failure.
- `flow`: `across` (default): diagrams run left to right. `down`: top to bottom, for layered stacks.
- `density`: `standard` (default): `body`, up to four points. `dense`: `body2`, tables up to ten rows, for spec slides.
