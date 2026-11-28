# Select layers on a slide

Selecting layers on the slide behaves as Figma Slides does: a click takes a layer, or a group whole; Shift+click adds or takes away; Cmd/Ctrl+click reaches inside a group or frame; a double-click or Enter steps one level in. Shift+Enter or `\` selects the parent, and Escape clears. A marquee from empty slide space selects every layer it touches, and Shift+marquee adds to the selection. Ctrl/Cmd+A selects unlocked layers at the current depth. Hovering draws a 1 px outline around the layer a click would take. A locked layer lets the click pass through, and a hidden one is not painted. The words are in `select.md`.

## Sub-features

- `select` a click picks the top layer under the pointer, a group whole (`[data-selection-outline]` names the group's node). After a double-click has stepped inside a group, a click on a sibling picks the sibling.
- `select-add` Shift+click adds a layer to the selection, and Shift+click on a selected layer takes it away.
- `deep-select` Cmd/Ctrl+click picks the layer inside a group or frame at once.
- `step-in` a double-click or Enter steps one level into a group or frame. Shift+Enter (or `\`) selects the parent. Escape clears the selection.
- `marquee` dragging from empty slide space paints `[data-marquee]` and selects every layer it touches; Shift keeps the selection and adds to it. Moving a group that a marquee or click took moves what is inside it.
- `select-all` Ctrl/Cmd+A selects unlocked layers at the current depth.
- `hover-outline` hovering paints `[data-hover-outline]` around the layer a click would select.
- `lock` Ctrl/Cmd+Shift+L locks or unlocks the selection (the node's `locked` prop). A locked layer takes no click on the slide: the click passes through to what is under it.
- `hide` Ctrl/Cmd+Shift+H hides or shows the selection (the node's `hidden` prop); the slide stops painting it.

## How to get to it (user POV)

- An open deck `/s/<id>`.
- Hover a layer to see the outline, drag from empty slide space to draw a marquee, hold Shift to add, hold Cmd/Ctrl to reach inside a group or frame, double-click or Enter to step in, Shift+Enter or `\` to step out, and Escape to clear.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/editor-select.spec.ts`: a click takes a group whole, double-click and Enter step in, Shift+Enter selects the parent and Escape clears. Shift adds and takes away, Cmd/Ctrl reaches inside a frame, and a locked layer passes the click through. It covers a marquee and Shift+marquee, and a moved group carries what is inside it, read from `doomRoutes.open`. `tests/browser/editor-arrange.spec.ts` locks with Ctrl+Shift+L, finds the click passes through, and hides with Ctrl+Shift+H.
- **States for look.** `canvas-marquee`, `canvas-hover`, `two-selected`, `group-stepped-in`, `group-layer-selected`.

## Gotchas

- `selectedIds` in `tests/browser/editor-deck.ts` reads the selection from `[data-selection-outline]`, one per selected layer.
