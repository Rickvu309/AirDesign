# Slide paint

An opened deck shows its current slide as a canvas with the deck's own aspect ratio. Each shape, text box, picture, table and connector paints at its place from the PowerPoint, including shapes in groups, shapes and pictures the layout and master draw, and titles that take their box from the layout. Text paints with its paragraphs, bullets and numbering, in fonts with the same widths as PowerPoint's. The slide list on the left shows a painted thumbnail of every slide.

## Sub-features

- `paint-canvas` `[data-slide-paint]` has the deck's aspect ratio at the shell's slide width.
- `paint-place` each `[data-canvas-element="<key>"]` sits inside the canvas at its PowerPoint box.
- `paint-text` imported text shows in its box (`Hello` for `clean.pptx`).
- `paint-slides` `[data-slide-entry="<n>"]` switches the open slide (`aria-current="true"`); only that slide's elements are on the canvas. Thumbnails are `[data-thumb-paint]` and hold no `[contenteditable]`, but their tables do carry `[data-canvas-element]` and `[data-canvas-table]`, so scope element queries to `[data-slide-paint]`.
- `paint-kinds` pictures (painted on the canvas, checked by pixels in `tests/browser/picture-paint.spec.ts`), preset and custom shapes and connectors (`[data-canvas-path]`, `[data-canvas-line]`), tables (`[data-canvas-table] [data-table-cell]`), paragraphs (`[data-paragraph]`, with `--bullet` for bullets and numbering) and runs (`[data-run]`). Charts and other kept frames paint as a grey box.
- `paint-fonts` Calibri, Cambria, Arial, Helvetica and Times New Roman fall back to Carlito, Caladea, Arimo and Tinos, which have the same widths, and single line spacing is 1.2 times the size, so lines break where PowerPoint breaks them.
- `paint-prompts` an empty placeholder shows its prompt, such as `Add a title` or `Add a subtitle`, in `[data-placeholder-prompt]` with a dashed outline. Thumbnails show no prompts.
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
- **Exact places.** Not in the journey. The repo's `tests/browser/slide-paint.spec.ts` compares each element to its box from the parts; for a paint change, run `pnpm exec playwright test tests/browser/slide-paint.spec.ts` as well and attach a screenshot from this journey.

## Gotchas

- `clean.pptx` has one slide and one text box. For the other kinds import `scripts/pptx-fixtures/doe-heat-pumps.pptx`: slide 4 has pictures, slide 9 preset shapes and connectors, slides 10, 11 and 40 tables, slide 7 bullets and slide 16 numbering. It runs in Calibri, so `[data-run]` reads `Calibri, Carlito, ...`. Prompts need a blank deck: `New deck` > `Blank deck`.
- The canvas has no `img` for pictures; check a picture by its `[data-canvas-element]` screenshot, as `tests/browser/picture-paint.spec.ts` does.
- A screenshot shows the paint but not the places. Assert boxes, then capture.
- The canvas width depends on the viewport. `$V journey` uses the design's 1470x923; the repo's browser tests use 1600x1000, where the canvas is 800 px wide.
