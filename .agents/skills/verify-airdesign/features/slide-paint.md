# Slide paint

An opened deck shows its current slide on the canvas at the deck's own size and aspect ratio, and a painted thumbnail of every slide in the slide list and on the deck's Home card. Each layer paints at its box from the deck: shapes and their fills, gradients, pictures, strokes and line ends, text broken into lines with each run's look, frames with their children, icons, charts, effects, rotation and flips. Text waits for its font face, loaded by name from AirDesign's font server, so lines break where they will stay.

## Sub-features

- `paint-canvas` `[data-slide-box]` holds the slide inside `[data-doom-stage]`; the painted slide is `[data-doom-slide][data-slide-paint]`, scaled from the deck's size to the width it is given (`DoomSlide` in `packages/render/src/doom-slide.tsx`).
- `paint-place` each layer is `[data-slide-box] [data-node="<id>"]`, placed by its box, turned by its rotation and mirrored by its flips; `data-geometry` names its shape (`packages/render/src/node-art.tsx`).
- `paint-kinds` fills in order (solid, gradient, image), a PowerPoint preset's outline, strokes inside, centred or outside with dashes and arrow ends, lines along their route, text lines (`[data-line]`) of runs (`[data-run]`), frames that nest and clip their children, Lucide icons, charts from their data, shadows and layer blur (`packages/render/src/node-art.test.ts`). States `slide-effects`, `slide-group-effects`, `slide-line-styles`, `slide-line-and-gradient`, `slide-text-fit`, `slide-chart`, `shape-faces`.
- `paint-fonts` a text's faces come from `fontRoutes.family` and `fontRoutes.file`; while a slide's face loads, the slide holds `[data-fonts-pending]`, and print and capture wait for it. An unknown name or a failed load falls back and is reported (`packages/render/src/font-load.test.ts`, `font-wait.test.ts`). State `font-catalog`.
- `paint-waiting` a picture whose bytes this device does not hold yet says it is still uploading in its box (`[data-unshown-label]`); a thumbnail says nothing. State `picture-uploading`, spec `tests/browser/doom-slide-picture.spec.ts`.
- `paint-slides` `[data-slide-entry="<n>"]` in the slide list switches the open slide (`aria-current="true"`); only that slide's layers are in `[data-slide-box]`. Thumbnails paint only while the list can see them (`packages/render/src/filmstrip.test.ts`).
- `paint-device` a deck this browser opened before paints from the device copy before the server answers. See `keep-typed-text.md`.

## How to get to it (user POV)

- Open a deck from Home or `/s/<id>`.
- Choose a slide in the left slide list.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Unit tests.** `pnpm exec vitest run packages/render/src` holds each kind's paint, the fonts and the thumbnails.
- **Spec.** `tests/browser/doom-editor.spec.ts` opens a new deck at `/s/<id>`, checks its title paints at its saved box, and finds it in the same place after a reload.
- **States for look.** Most states above open a deck with its layers already landed (`openDoomDeck` and `landNodes` in `../look/doom-deck.mjs`) and capture the slide; run `$V look <run> <state>` before and after a paint change and read the images.
- **Exact places.** In a scratch journey, compare each `[data-slide-box] [data-node]` box with its saved `box` from `doomRoutes.open`, scaled by the slide box's width over the deck's width.

## Gotchas

- A screenshot shows the paint but not the places. Assert boxes, then capture.
- Wait for `[data-fonts-pending]` to leave before you measure text or capture.
- The canvas width depends on the viewport. `$V journey` uses the design's 1470x923; the repo's browser tests use 1600x1000.
