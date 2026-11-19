# Select layers on a slide

Selecting layers on the slide behaves as Figma Slides does: dragging a marquee from empty slide space or the canvas surround selects every touched layer, Shift+marquee adds to the selection, Cmd/Ctrl+marquee and Cmd/Ctrl+click deep-select inside groups and frames, double-click steps in, Escape and Shift+Enter step up to the parent, Enter selects children, Tab and Shift+Tab cycle siblings, and hovering draws a 1 px blue hover outline.

## Sub-features

- `marquee` dragging from empty slide area or the grey canvas surround paints a translucent blue `[data-slide-marquee]` overlay without re-rendering layers, selecting touched layers live (using rotated box intersection for turned layers). Escape cancels and restores the prior selection.
- `shift-marquee` holding Shift while dragging a marquee preserves the existing selection and adds newly touched layers.
- `deep-select` Cmd/Ctrl+click and Cmd/Ctrl+marquee bypass groups and frames to select leaf layers directly (never selecting a frame's backdrop). Shift+Cmd/Ctrl+click toggles a deep-selected layer.
- `traverse` double-click steps one level into a group or frame; Enter selects direct non-backdrop children; Escape steps back to the parent group (or clears selection at top level); Shift+Enter selects the parent; Tab and Shift+Tab cycle direct siblings and wrap around without stealing keys from text editing or open menus.
- `hover-outline` hovering with a mouse paints a 1 px blue `[data-hover-outline]` around the layer a click would select (or the deep leaf while Cmd/Ctrl is held) without re-rendering layers.

## How to get to it (user POV)

- Open any deck at `/deck/<id>`.
- Hover a layer to see the hover outline, drag from empty slide area or the surround to draw a marquee, hold Shift to add, hold Cmd/Ctrl to deep-select inside a group or frame, press Escape/Shift+Enter/Enter/Tab to traverse layers.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> canvas-select`. Prints `"passed":true`. Listed in `tests/journeys/journeys.spec.ts`.
- **Journey.** Hover a shape (`NN-hover-outline`), drag a marquee from the surround across three shapes (`NN-marquee-dragging`, `NN-marquee-three`), Shift-marquee a fourth (`NN-shift-marquee-four`), group two (`NN-grouped`), Cmd/Ctrl+click deep-select inside the group (`NN-deep-selected`), Escape back to the group (`NN-escaped-to-group`), drag the group and verify the landed box on the server (`deckRoutes.open`) and after reload (`NN-group-dragged`, `NN-reloaded`), and traverse with Enter, Tab and Shift+Enter.
- **States for look.** `canvas-marquee`, `canvas-hover`, `two-selected`, `grouped`.

## Gotchas

- `canvas-marquee` and `canvas-hover` run cleanly on a base build without marquee or hover outline so `before-after` renders both sides.
- Touch pointers skip marquee and hover outline so touch scrolling stays intact.
