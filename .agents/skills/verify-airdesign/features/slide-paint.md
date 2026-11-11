# Slide paint

An opened deck shows its current slide as a canvas with the deck's own aspect ratio. Each shape, text box and picture paints at its place from the PowerPoint, including shapes in groups and titles that take their box from the layout. Only the open slide's elements are on the page.

## Sub-features

- `paint-canvas` `[data-slide-paint]` has the deck's aspect ratio at the shell's slide width.
- `paint-place` each `[data-canvas-element="<key>"]` sits inside the canvas at its PowerPoint box.
- `paint-text` imported text shows in its box (`Hello` for `clean.pptx`).
- `paint-slides` `[data-slide-entry="<n>"]` switches the open slide; only that slide's elements are painted.

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
- **Elements inside.** Every `[data-canvas-element]` box lies within the canvas box, within 1 px. Evidence `NN-painted-slide` and the `proof.md` line with the canvas size and element count.
- **Text.** `[contenteditable="true"]` reads `Hello`.
- **Exact places.** Not in the journey. The repo's `tests/browser/slide-paint.spec.ts` compares each element to its box from the parts; for a paint change, run `pnpm exec playwright test tests/browser/slide-paint.spec.ts` as well and attach a screenshot from this journey.

## Gotchas

- `clean.pptx` has one slide and one text box. `paint-slides` needs a deck with more slides; pick one from `scripts/pptx-fixtures/` and say which.
- A screenshot shows the paint but not the places. Assert boxes, then capture.
- The canvas width depends on the viewport. The journey uses 1600x1000, the same as the repo's browser tests.
