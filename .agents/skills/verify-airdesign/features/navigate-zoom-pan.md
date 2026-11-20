# Zoom and pan the slide

A person zooms and pans slide view as in Figma Slides. Ctrl or Command with the scroll wheel, or a trackpad pinch, zooms about the cursor. While the gesture goes on the slide scales as one picture; when it rests the slide is laid out once at the new zoom, so text is sharp. Holding Space and dragging pans. Shift+2 zooms to the selection, Shift+1 zooms to fit, and Shift+0 or Ctrl+0 zooms to 100%. The words are in `zoom.md`.

## Sub-features

- `wheel` Ctrl+scroll over a point zooms in and keeps that point of the slide under the cursor.
- `safari-pinch` Safari `gesturestart`, `gesturechange` and `gestureend` events zoom about the cursor through the same zoom path, prevent default so the page does not zoom, and ignore interleaved `wheel` with `ctrlKey`.
- `pan` holding Space shows the hand over the canvas; a drag moves the view and nothing on the slide. Space types a space while editing text.
- `selection` Shift+2 fills the canvas with the selected layers, 48 px in from its edges, and centres them.
- `fit` Shift+1 goes back to zoom to fit.
- `drag` after a zoom, a drag moves the layer by what the pointer moved, in slide units.

## How to get to it (user POV)

- An open deck `/deck/<id>`: hold Ctrl or Command and scroll over the slide, or pinch on a trackpad.
- Keyboard: Shift+2 with a layer selected, Shift+1, Shift+0, Ctrl+= and Ctrl+-. Hold Space and drag to pan.

## Driving it with verify-airdesign

- **Run it.** `$V journey <run> navigate-zoom-pan`. Prints `"passed":true` and the evidence dir.
- **Zoom about the cursor.** Imports `scripts/pptx-fixtures/clean.pptx`, Ctrl+scrolls five turns over the text box's middle. The readout passes 1.5 times fit and the point stays within 1 px. Evidence `NN-zoomed-about-cursor`.
- **Pan.** Space down, drag by -120,-60, Space up. `[data-canvas-stage]` scrolled by 120,60. Evidence `NN-panned`.
- **Zoom to selection.** Click the text, Escape, Shift+2. `[data-selection]` is centred within 1 px and 48 px in from the canvas sides. Evidence `NN-zoom-to-selection`.
- **Fit.** Shift+1 gives back the fit percent and the 800 px slide. Evidence `NN-back-to-fit`.
- **Safari pinch.** Dispatches `gesturestart`, `gesturechange` (1.25 then 1.6) and `gestureend` over the text box's middle. Every event has `defaultPrevented === true`, the slide scales to 1.6x within 1 px, and the point stays within 1 px. Evidence `NN-safari-pinch`.
- **Drag at a zoom.** Ctrl+scroll three turns, drag the frame's bottom edge by 40,70. Poll `post(deckRoutes.open, { deck })` until the last box row of `256.2` is within one pixel of the pointer. Evidence `NN-dragged-at-zoom`.

## Gotchas

- A Ctrl+scroll scales the slide as one picture and lays it out 150 ms after the last wheel event. Read the readout, not the slide's box, to know the zoom has settled.
- A press inside a text box's text places the caret; drag by the frame's edge.
- The 10% to 400% range is AirDesign's; Figma Slides' limits depend on the window.
