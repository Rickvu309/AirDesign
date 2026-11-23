# Zoom and pan the slide

A person zooms and pans the slide as in Figma Slides. Ctrl or Command with the scroll wheel, or a trackpad pinch in Chrome (which sends it as a Ctrl wheel), zooms about the cursor. Holding Space and dragging pans, and so does the hand tool (H, or Hand tool in the toolbar's Move menu). Shift+2 zooms to the selection, Shift+1 zooms to fit, Shift+0 or Ctrl+0 zooms to 100%, and Ctrl+= and Ctrl+- step the zoom. The readout in the right column shows the percent and opens the zoom menu. The words are in `zoom.md`.

## Sub-features

- `wheel` Ctrl/Cmd+scroll over a point zooms and keeps that point of the slide under the cursor (`wheelScale` in `apps/web/src/doom-editor/canvas-view.ts`).
- `keys` Shift+0 and Ctrl/Cmd+0 go to 100%, `+`, `-`, Ctrl/Cmd+= and Ctrl/Cmd+- step through 10, 25, 50, 75, 100, 150, 200, 300 and 400%, and Shift+1 goes back to fit. The range is 10% to 400% (`zoomRange` in `apps/web/src/editor/canvas-zoom.ts`). The keys are the `view` rows of `gestures` in `packages/render/src/gestures.ts`.
- `selection` Shift+2 fills the canvas with the selected layers and centres them.
- `pan` holding Space, or the hand tool, shows the grab cursor; a drag scrolls the view and moves nothing on the slide. V goes back to Move. Space types a space while editing text.
- `zoom-menu` a click on `[data-zoom-readout]` opens the zoom menu: a percent or Fit zooms the slide. Agent and Design share one zoom.

## How to get to it (user POV)

- An open deck `/s/<id>`: hold Ctrl or Command and scroll over the slide, or pinch on a trackpad.
- Keyboard: Shift+2 with a layer selected, Shift+1, Shift+0, Ctrl+= and Ctrl+-. Hold Space and drag to pan, or press H.
- The percent in the right column.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/doom-editor-view.spec.ts` drives the zoom keys, Shift+2 on a selected layer, the hand tool from the Move menu, V and a Ctrl+wheel zoom, reading `[data-zoom-readout]` and the scroll of `[data-doom-stage]`. `tests/browser/doom-editor-page.spec.ts` picks 100% and Fit from the zoom menu and checks Agent and Design keep one zoom.
- **States for look.** `zoom-selection` (a text box after Shift+2) and `zoom-menu` (the menu open).

## Gotchas

- Read the readout, not the slide's box, to know the zoom.
- The canvas scrolls once the slide is larger than the room: `[data-doom-stage]` has `scrollWidth > clientWidth` after Shift+0 on a 1920-wide slide.
- A press inside a text that is being edited places the caret; Space there types.
