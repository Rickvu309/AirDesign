# Slide paint

An opened deck shows its current slide as a canvas with the deck's own aspect ratio. Each shape, text box, picture, table, connector, SmartArt diagram and chart paints at its place from the PowerPoint, including shapes in groups, shapes and pictures the layout and master draw, and titles that take their box from the layout. Text paints with its paragraphs, bullets and numbering, in fonts with the same widths as PowerPoint's. The slide list on the left shows a painted thumbnail of every slide.

## Sub-features

- `paint-canvas` `[data-slide-paint]` has the deck's aspect ratio at the shell's slide width.
- `paint-place` each `[data-canvas-element="<key>"]` sits inside the canvas at its PowerPoint box.
- `paint-text` imported text shows in its box (`Hello` for `clean.pptx`).
- `paint-slides` `[data-slide-entry="<n>"]` switches the open slide (`aria-current="true"`); only that slide's elements are on the canvas. Thumbnails are `[data-thumb-paint]` and hold no `[contenteditable]`, but their tables, diagrams and charts paint there too (`[data-canvas-table]`, `[data-diagram-shape]`, `svg[data-chart]`), so scope element queries to `[data-slide-paint]` or to one `[data-slide-entry]`.
- `paint-kinds` pictures (painted on the canvas, checked by pixels in `tests/browser/picture-paint.spec.ts`), preset and custom shapes and connectors (`[data-canvas-path]`, `[data-canvas-line]`), tables (`[data-canvas-table] [data-table-cell]`), paragraphs (`[data-paragraph]`, with `--bullet` for bullets and numbering) and runs (`[data-run]`).
- `paint-diagrams` a SmartArt diagram paints from the drawing PowerPoint saved with it: each shape is a `[data-diagram-shape]` with its text, on the canvas and in the thumbnail.
- `paint-charts` a chart paints from the values PowerPoint cached with it as `svg[data-chart="<kind>"]` (pie, doughnut, bar, column and line; clustered, stacked or percent-stacked) with its title, legend, axes and data labels as `[data-chart-text]`. On the canvas the svg is `role="img"` named `<Kind> chart: <title>`, such as `Pie chart: Housing Tenure Status`; in a thumbnail it is hidden from screen readers.
- `paint-unshown` a chart it cannot paint truthfully (area, scatter, radar, 3D, a mix of kinds, trendlines, error bars, a missing cached value, a picture fill) and any other kept frame keeps a box; a box at least 1,800,000 by 450,000 EMU says `Chart or diagram can't be shown here` (a picture it cannot draw says `<FORMAT> picture can't be shown here`) in `[data-unshown-label]`.
- `paint-read-only` diagrams and charts cannot be selected, moved, resized or typed in: a click passes through to the slide, Delete leaves them, and the export writes their parts and frames byte for byte. A duplicate gets its own copy of each chart, diagram and notes part, and an export where two slides point at one such part fails the PowerPoint check; after the original slide is deleted, its copy points at the original parts (`slide-charts` exports 7 chart parts, every one the original's bytes).
- `paint-device` a deck this browser opened before paints from the device copy before the server answers. See `keep-typed-text.md`.
- `paint-fonts` Calibri, Cambria, Arial, Helvetica and Times New Roman fall back to Carlito, Caladea, Arimo and Tinos, which have the same widths, and a single line is 1.2 times the size, so lines break where PowerPoint breaks them.
- `paint-prompts` an empty placeholder shows its prompt, such as `Click to add title` or `Click to add subtitle`, in `[data-placeholder-prompt]` with a dashed outline. Thumbnails show no prompts.
- `paint-sections` a deck with sections lists `[data-section-head]` headings, each named from the PowerPoint, above its slides, and numbers the slides straight through. A heading collapses its section to one row with the range of its slides, such as `1 to 2` and opens again; it opens by itself for the slide in view. `scripts/pptx-fixtures/sections-before.pptx` has two sections, `Opening` and `Numbers`; `tests/browser/slide-sections.spec.ts` proves the rest.

## How to get to it (user POV)

- Import a PowerPoint on Home; the deck opens on slide 1.
- Open a deck from Home or `/deck/<id>`.
- Choose a slide in the left slide list.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> slide-paint`. Prints `"passed":true`.
- **Open.** Sign in and import `clean.pptx` from Home. The URL becomes `/deck/<id>`.
- **Canvas.** `[data-slide-paint]` is visible.
- **Elements inside.** Every `[data-slide-paint] [data-canvas-element]` box lies within the canvas box, within 1 px. Evidence `NN-painted-slide` and the `proof.md` line with the canvas size and element count.
- **Text.** `[contenteditable="true"]` reads `Hello`.
- **Fonts.** `$V journey <run> dynamic-fonts`: sets Montserrat through MCP, holds the font response and checks the canvas waits, checks two loaded FontFace styles and same-origin requests, exports Montserrat in the slide XML, and imports that export. Measured 2026-11-17. Unknown names keep fallback and report it. The `font-catalog` look state opens an imported Montserrat slide.
- **Charts and diagrams.** `$V journey <run> slide-charts`: imports `census-updating-spm.pptx`, checks slide 19 paints 3 `svg[data-chart=pie]` on the canvas and in its thumbnail and slide 5 paints `[data-diagram-shape]`s, that a click on a pie selects nothing and Delete leaves it, duplicates slide 19 (Ctrl/Cmd+D, the copy is current and focused), deletes the original, undoes and redoes the delete, exports, and checks every `ppt/charts/*` and `ppt/embeddings/*` part is byte for byte the original's and the copy's rels still name the charts. Evidence `NN-chart-slide`, `NN-diagram-slide`, `NN-chart-slide-deleted`, the exported file in the journey's folder.
- **Exact places.** Not in the journey. The repo's `tests/browser/slide-paint.spec.ts` compares each element to its box from the parts; for a paint change, run `pnpm exec playwright test tests/browser/slide-paint.spec.ts` as well and attach a screenshot from this journey.

## Gotchas

- `clean.pptx` has one slide and one text box. For the other kinds import `scripts/pptx-fixtures/doe-heat-pumps.pptx`: slide 4 has pictures, slide 9 preset shapes and connectors, slides 10, 11 and 40 tables, slide 7 bullets and slide 16 numbering. It runs in Calibri, so `[data-run]` reads `Calibri, Carlito, ...`. Prompts need a blank deck: `New deck` > `Blank deck`.
- `scripts/pptx-fixtures/census-updating-spm.pptx` has a diagram on slide 5 (`ppt/slides/slide5.xml#6`) and three pies on slide 19 (`ppt/slides/slide19.xml#11`); the deck has 26 slides, so wait for `[data-slide-entry="19"]` before you count entries. `tests/browser/chart-export.spec.ts` and `diagram-export.spec.ts` judge an edit and a duplicate through the PowerPoint check; the look states are `slide-chart` and `slide-diagram`.
- A chart or diagram ignores the pointer, so Playwright's `click()` on one times out with `[data-slide-paint]` intercepting it; use `click({ force: true })` to prove the click selects nothing.
- The journey's export after a duplicate and a delete gave Microsoft's validator (`scripts/pptx-judge`) the same 12 schema findings as the original file and no new one.
- The canvas has no `img` for pictures; check a picture by its `[data-canvas-element]` screenshot, as `tests/browser/picture-paint.spec.ts` does.
- A screenshot shows the paint but not the places. Assert boxes, then capture.
- The canvas width depends on the viewport. `$V journey` uses the design's 1470x923; the repo's browser tests use 1600x1000, where the canvas is 800 px wide.
